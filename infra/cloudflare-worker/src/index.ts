/**
 * sd-telemetry Cloudflare Worker
 *
 * Accepts aggregate-only telemetry batches from Slant Detective extensions.
 * Strips the IP before any write — it is used only for in-memory rate-limiting.
 * Source: public (AGPL-3.0). Audit trail: grep for writeDataPoint — IP never appears.
 *
 * POST /v1/ingest  → 204 (valid) | 400 (invalid schema) | 413 (too large) | 405 (wrong method)
 */

export interface Env {
  TELEMETRY: AnalyticsEngineDataset
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

// ── Rate-limit (in-memory, best-effort abuse guard) ───────────────────────────

interface RateLimitEntry {
  count: number
  windowStart: number
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000 // 10 minutes
const RATE_LIMIT_MAX = 1 // max requests per IP per window (1 batch / 10 min per SD-030 spec)

// LRU is overkill for an abuse guard; simple Map is fine.
// Workers are single-threaded and short-lived — Map resets on cold start.
const rateLimitMap = new Map<string, RateLimitEntry>()

function isRateLimited(ip: string, now: number): boolean {
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  rateLimitMap.set(ip, { ...entry, count: entry.count + 1 })
  return false
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

    if (path !== '/v1/ingest') {
      console.log('404')
      return new Response('Not Found', { status: 404 })
    }

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

    // rate-limit bucket key only — never persisted
    const clientIp = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    const now = Date.now()
    if (isRateLimited(clientIp, now)) {
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
  },
}
