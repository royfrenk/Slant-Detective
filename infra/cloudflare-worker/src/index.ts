/**
 * sd-telemetry Cloudflare Worker
 *
 * Accepts aggregate-only telemetry batches from Slant Detective extensions.
 * Strips the IP before any write — it is used only for in-memory rate-limiting.
 * Source: public (AGPL-3.0). Audit trail: grep for writeDataPoint — IP never appears.
 *
 * POST /v1/ingest        → 204 (valid) | 400 (invalid schema) | 413 (too large) | 405 (wrong method)
 * POST /v1/score-sample  → 204 (accepted) | 400 (invalid schema) | 413 (too large) | 429 (rate-limited) [SD-041]
 * POST /v1/report-bug    → 204 (forwarded) | 400 (invalid) | 413 (too large) | 429 (rate-limited) | 502 (Resend error)
 */

export interface Env {
  TELEMETRY: AnalyticsEngineDataset
  RESEND_API_KEY: string
  BUG_REPORT_RECIPIENT: string
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface TelemetryBatch {
  schema_version: 1
  extension_version: string
  period_start: string
  period_end: string
  counters: Counters
  domain_counts: Record<string, number>
}

interface Counters {
  analyze_started: number
  analyze_layer1_ok: number
  analyze_layer2_ok: number
  analyze_extraction_failed: number
  analyze_too_short: number
  analyze_llm_timeout: number
  analyze_invalid_key: number
  analyze_rate_limit: number
  key_saved: number
  key_rejected: number
}

interface BugReport {
  url?: string
  screenshot_data_url?: string
  description?: string
}

// SD-041: Score sample event
interface ScoreSample {
  event: 'score_sample'
  domain_etld1: string
  overall: number
  word_choice: number
  framing: number
  headline_slant: number
  source_mix: number
  direction: string
  provider: string
  rubric_version: string
}

// ── Rate-limit (in-memory, best-effort abuse guard) ───────────────────────────

interface RateLimitEntry {
  count: number
  windowStart: number
}

// Ingest: 1 batch per 10 minutes per IP (SD-030 spec)
const INGEST_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const INGEST_RATE_LIMIT_MAX = 1

// Bug reports: 5 per minute per IP
const BUG_RATE_LIMIT_WINDOW_MS = 60_000
const BUG_RATE_LIMIT_MAX = 5

// Score samples: 120 per minute per IP (one per article analysis, generous headroom)
const SCORE_SAMPLE_RATE_LIMIT_WINDOW_MS = 60_000
const SCORE_SAMPLE_RATE_LIMIT_MAX = 120

// LRU is overkill for an abuse guard; simple Maps are fine.
// Workers are single-threaded and short-lived — Maps reset on cold start.
const ingestRateLimitMap = new Map<string, RateLimitEntry>()
const bugRateLimitMap = new Map<string, RateLimitEntry>()
const scoreSampleRateLimitMap = new Map<string, RateLimitEntry>()

function isRateLimited(
  map: Map<string, RateLimitEntry>,
  windowMs: number,
  max: number,
  ip: string,
  now: number,
): boolean {
  const entry = map.get(ip)
  if (!entry || now - entry.windowStart > windowMs) {
    map.set(ip, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= max) return true
  map.set(ip, { ...entry, count: entry.count + 1 })
  return false
}

function isIngestRateLimited(ip: string, now: number): boolean {
  return isRateLimited(ingestRateLimitMap, INGEST_RATE_LIMIT_WINDOW_MS, INGEST_RATE_LIMIT_MAX, ip, now)
}

function isBugRateLimited(ip: string, now: number): boolean {
  return isRateLimited(bugRateLimitMap, BUG_RATE_LIMIT_WINDOW_MS, BUG_RATE_LIMIT_MAX, ip, now)
}

function isScoreSampleRateLimited(ip: string, now: number): boolean {
  return isRateLimited(
    scoreSampleRateLimitMap,
    SCORE_SAMPLE_RATE_LIMIT_WINDOW_MS,
    SCORE_SAMPLE_RATE_LIMIT_MAX,
    ip,
    now,
  )
}

// ── Validation ────────────────────────────────────────────────────────────────

const VERSION_RE = /^\d+\.\d+\.\d+$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const COUNTER_KEYS: ReadonlyArray<keyof Counters> = [
  'analyze_started',
  'analyze_layer1_ok',
  'analyze_layer2_ok',
  'analyze_extraction_failed',
  'analyze_too_short',
  'analyze_llm_timeout',
  'analyze_invalid_key',
  'analyze_rate_limit',
  'key_saved',
  'key_rejected',
]

function isNonNegativeInt(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0
}

function validatePayload(raw: unknown): TelemetryBatch | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>

  if (obj['schema_version'] !== 1) return null
  if (typeof obj['extension_version'] !== 'string' || !VERSION_RE.test(obj['extension_version'])) return null
  if (typeof obj['period_start'] !== 'string' || !DATE_RE.test(obj['period_start'])) return null
  if (typeof obj['period_end'] !== 'string' || !DATE_RE.test(obj['period_end'])) return null

  const counters = obj['counters']
  if (typeof counters !== 'object' || counters === null) return null
  const c = counters as Record<string, unknown>
  for (const key of COUNTER_KEYS) {
    if (!isNonNegativeInt(c[key])) return null
  }

  const dc = obj['domain_counts']
  if (typeof dc !== 'object' || dc === null || Array.isArray(dc)) return null
  const domainCounts = dc as Record<string, unknown>
  for (const val of Object.values(domainCounts)) {
    if (!isNonNegativeInt(val)) return null
  }

  return obj as unknown as TelemetryBatch
}

function validateBugReport(raw: unknown): BugReport | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>

  if ('url' in obj) {
    if (typeof obj['url'] !== 'string' || obj['url'].length > 2048) return null
  }

  if ('screenshot_data_url' in obj) {
    if (
      typeof obj['screenshot_data_url'] !== 'string' ||
      !obj['screenshot_data_url'].startsWith('data:image/png;base64,') ||
      obj['screenshot_data_url'].length > 900_000
    ) {
      return null
    }
  }

  if ('description' in obj) {
    if (typeof obj['description'] !== 'string' || obj['description'].length > 500) return null
  }

  return obj as BugReport
}

// SD-041: score_sample validation ─────────────────────────────────────────────

// Accepts: "v1.1" (Anthropic), "rubric_v1.1-openai", "rubric_v1.1-gemini"
// Loose regex — must NOT exact-match; provider version strings vary.
const RUBRIC_VERSION_RE = /^(rubric_)?v\d+\.\d+(-\w+)?$/

const VALID_DIRECTIONS = new Set([
  'left', 'left-center', 'center', 'right-center', 'right', 'mixed',
])

const VALID_PROVIDERS = new Set(['anthropic', 'openai', 'gemini'])

// Known extra fields that must NOT appear in the payload
const SCORE_SAMPLE_ALLOWED_KEYS = new Set([
  'event', 'domain_etld1', 'overall', 'word_choice', 'framing',
  'headline_slant', 'source_mix', 'direction', 'provider', 'rubric_version',
])

function isScore(v: unknown): boolean {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10
}

function validateScoreSample(raw: unknown): ScoreSample | null {
  if (typeof raw !== 'object' || raw === null) return null

  const obj = raw as Record<string, unknown>

  // Reject extra fields (privacy: ensure client sends exactly 9 fields)
  for (const key of Object.keys(obj)) {
    if (!SCORE_SAMPLE_ALLOWED_KEYS.has(key)) return null
  }

  if (obj['event'] !== 'score_sample') return null

  // domain_etld1: non-empty string, no slashes/paths, max 253 chars (DNS limit)
  if (
    typeof obj['domain_etld1'] !== 'string' ||
    obj['domain_etld1'].length === 0 ||
    obj['domain_etld1'].length > 253 ||
    obj['domain_etld1'].includes('/') ||
    obj['domain_etld1'].includes('?') ||
    obj['domain_etld1'].includes('#')
  ) return null

  // Score fields: integer 0–10
  if (!isScore(obj['overall'])) return null
  if (!isScore(obj['word_choice'])) return null
  if (!isScore(obj['framing'])) return null
  if (!isScore(obj['headline_slant'])) return null
  if (!isScore(obj['source_mix'])) return null

  // direction: one of the known values
  if (typeof obj['direction'] !== 'string' || !VALID_DIRECTIONS.has(obj['direction'])) return null

  // provider: one of the known providers
  if (typeof obj['provider'] !== 'string' || !VALID_PROVIDERS.has(obj['provider'])) return null

  // rubric_version: loose regex (accepts all 3 provider formats)
  if (typeof obj['rubric_version'] !== 'string' || !RUBRIC_VERSION_RE.test(obj['rubric_version'])) return null

  return obj as unknown as ScoreSample
}

// ── Analytics Engine write ────────────────────────────────────────────────────

function writeTelemetryRow(env: Env, batch: TelemetryBatch): void {
  const c = batch.counters
  // Blobs: string fields (max 20)
  // Doubles: numeric counters (max 20)
  // Indexes: single high-cardinality index used for efficient queries (max 1)
  env.TELEMETRY.writeDataPoint({
    blobs: [
      batch.extension_version,  // blob1: version
      batch.period_start,        // blob2: day bucket start
      batch.period_end,          // blob3: day bucket end
      JSON.stringify(batch.domain_counts), // blob4: domain hash→count map
      // IP is NOT included here — it is used only as a rate-limit bucket key
    ],
    doubles: [
      c.analyze_started,
      c.analyze_layer1_ok,
      c.analyze_layer2_ok,
      c.analyze_extraction_failed,
      c.analyze_too_short,
      c.analyze_llm_timeout,
      c.analyze_invalid_key,
      c.analyze_rate_limit,
      c.key_saved,
      c.key_rejected,
    ],
    indexes: [batch.extension_version],
  })
}

// SD-041: Write score sample to Analytics Engine ──────────────────────────────

function writeScoreSampleDataPoint(env: Env, sample: ScoreSample): void {
  // IP is NOT included — used only for in-memory rate-limiting above.
  // All 9 payload fields are written; nothing beyond that.
  env.TELEMETRY.writeDataPoint({
    blobs: [
      sample.domain_etld1,   // blob1: eTLD+1 domain (e.g. "nytimes.com")
      sample.direction,       // blob2: bias direction
      sample.provider,        // blob3: provider id
      sample.rubric_version,  // blob4: rubric version string
    ],
    doubles: [
      sample.overall,         // double1
      sample.word_choice,     // double2
      sample.framing,         // double3
      sample.headline_slant,  // double4
      sample.source_mix,      // double5
    ],
    indexes: [sample.provider], // index1: provider (grouping key per SD-041 drift audit)
  })
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleIngest(request: Request, env: Env, clientIp: string, now: number): Promise<Response> {
  // Reject large bodies before parsing (Content-Length check + byte count)
  const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10)
  if (contentLength > 4096) {
    console.log('413 content-length header')
    return new Response('Payload Too Large', { status: 413 })
  }

  if (request.headers.get('Content-Type') !== 'application/json') {
    console.log('400 content-type')
    return new Response('Bad Request: Content-Type must be application/json', { status: 400 })
  }

  // Read body — cap at 4096 bytes
  const bodyBytes = await request.arrayBuffer()
  if (bodyBytes.byteLength > 4096) {
    console.log('413 body size')
    return new Response('Payload Too Large', { status: 413 })
  }

  if (isIngestRateLimited(clientIp, now)) {
    console.log('429 rate-limited')
    return new Response('Too Many Requests', { status: 429 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bodyBytes))
  } catch {
    console.log('400 json parse error')
    return new Response('Bad Request: invalid JSON', { status: 400 })
  }

  const batch = validatePayload(parsed)
  if (batch === null) {
    console.log('400 schema validation failed')
    return new Response('Bad Request: schema validation failed', { status: 400 })
  }

  writeTelemetryRow(env, batch)
  console.log('204')
  return new Response(null, { status: 204 })
}

async function handleReportBug(request: Request, env: Env, clientIp: string, now: number): Promise<Response> {
  // Reject large bodies before parsing (1 MB cap)
  const BODY_LIMIT = 1_048_576
  const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10)
  if (contentLength > BODY_LIMIT) {
    console.log('413 content-length header')
    return new Response('Payload Too Large', { status: 413 })
  }

  // Read body — cap at 1 MB
  const bodyBytes = await request.arrayBuffer()
  if (bodyBytes.byteLength > BODY_LIMIT) {
    console.log('413 body size')
    return new Response('Payload Too Large', { status: 413 })
  }

  if (isBugRateLimited(clientIp, now)) {
    console.log('429 rate-limited')
    return new Response('Too Many Requests', { status: 429 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bodyBytes))
  } catch {
    console.log('400 json parse error')
    return new Response('Bad Request: invalid JSON', { status: 400 })
  }

  const report = validateBugReport(parsed)
  if (report === null) {
    console.log('400 bug report validation failed')
    return new Response('Bad Request: invalid bug report', { status: 400 })
  }

  // Build Resend email payload — never log the report body
  const htmlParts: string[] = ['<h2>Slant Detective Bug Report</h2>']
  if (report.url) {
    htmlParts.push(`<p><strong>Page URL:</strong> <a href="${escapeHtml(report.url)}">${escapeHtml(report.url)}</a></p>`)
  }
  if (report.description) {
    htmlParts.push(`<p><strong>Description:</strong></p><p>${escapeHtml(report.description).replace(/\n/g, '<br>')}</p>`)
  }

  const emailBody: Record<string, unknown> = {
    from: 'Slant Detective <onboarding@resend.dev>',
    to: [env.BUG_REPORT_RECIPIENT],
    subject: '[Slant Detective] Bug report',
    html: htmlParts.join('\n'),
  }

  // Attach screenshot as base64 if present
  if (report.screenshot_data_url) {
    // Strip the data URL prefix to get raw base64
    const base64Content = report.screenshot_data_url.replace('data:image/png;base64,', '')
    emailBody['attachments'] = [{ filename: 'screenshot.png', content: base64Content }]
  }

  let resendResponse: Response
  try {
    resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    })
  } catch {
    console.log('502 resend fetch failed')
    return new Response('Bad Gateway', { status: 502 })
  }

  if (!resendResponse.ok) {
    console.log(`502 resend upstream ${resendResponse.status}`)
    return new Response('Bad Gateway', { status: 502 })
  }

  console.log('204 bug report forwarded')
  return new Response(null, { status: 204 })
}

// SD-041: Min-count threshold for (domain_etld1, day) bucket
// The Worker logs dropped-bucket counts so the threshold can be tuned without redeployment.
// Actual per-(domain,day) aggregation and threshold enforcement happen in Analytics Engine
// queries (read side). The Worker writes every valid sample — the read side applies N=10.
// We log a note here so that the query author can filter accordingly.
const SCORE_SAMPLE_MIN_COUNT_NOTE =
  'min_count_threshold=10: filter (domain_etld1,day) buckets with count < 10 on the read side.'

async function handleScoreSample(
  request: Request,
  env: Env,
  clientIp: string,
  now: number,
): Promise<Response> {
  // 2 KB cap — score_sample payload is tiny (9 scalar fields)
  const BODY_LIMIT = 2048
  const contentLength = parseInt(request.headers.get('Content-Length') ?? '0', 10)
  if (contentLength > BODY_LIMIT) {
    return new Response('Payload Too Large', { status: 413 })
  }

  if (request.headers.get('Content-Type') !== 'application/json') {
    return new Response('Bad Request: Content-Type must be application/json', { status: 400 })
  }

  const bodyBytes = await request.arrayBuffer()
  if (bodyBytes.byteLength > BODY_LIMIT) {
    return new Response('Payload Too Large', { status: 413 })
  }

  if (isScoreSampleRateLimited(clientIp, now)) {
    return new Response('Too Many Requests', { status: 429 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(bodyBytes))
  } catch {
    return new Response('Bad Request: invalid JSON', { status: 400 })
  }

  const sample = validateScoreSample(parsed)
  if (sample === null) {
    return new Response('Bad Request: schema validation failed', { status: 400 })
  }

  // Write to Analytics Engine — IP is NOT included per privacy invariants
  writeScoreSampleDataPoint(env, sample)

  // Log threshold note for query authors (no payload fields logged)
  console.log(`score_sample accepted: provider=${sample.provider} ${SCORE_SAMPLE_MIN_COUNT_NOTE}`)

  return new Response(null, { status: 204 })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Fetch handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { method, url } = request
    const path = new URL(url).pathname

    // Log method + path only — never request body, never IP
    console.log(`${method} ${path}`)

    if (method !== 'POST') {
      console.log('405')
      return new Response('Method Not Allowed', { status: 405 })
    }

    // rate-limit bucket key only — never persisted
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const now = Date.now()

    if (path === '/v1/ingest') {
      return handleIngest(request, env, clientIp, now)
    }

    if (path === '/v1/score-sample') {
      return handleScoreSample(request, env, clientIp, now)
    }

    if (path === '/v1/report-bug') {
      return handleReportBug(request, env, clientIp, now)
    }

    console.log('404')
    return new Response('Not Found', { status: 404 })
  },
}
