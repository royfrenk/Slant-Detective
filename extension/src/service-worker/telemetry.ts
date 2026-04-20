/**
 * SD-030: Aggregate-only telemetry emitter
 *
 * - bump(): accumulates counters in chrome.storage.local. No-op when disabled.
 * - maybeEmit(): sends one batch per day to the Worker. Called from the
 *   'telemetry_emit' alarm handler (every 6 h) and on service-worker startup.
 *
 * Privacy invariants (audit checklist):
 *   ✅ No distinct_id, device_id, install_id, session_id
 *   ✅ No raw URLs — only SHA-256(domain+dailySalt).slice(0,12) hashes
 *   ✅ Daily salt rotates at UTC midnight (client-side only)
 *   ✅ domain_counts capped at 50 entries; overflow → __other__
 *   ✅ Counters cleared only on 204 — retained on network failure
 */

import {
  TELEMETRY_ENABLED,
  TELEMETRY_COUNTERS,
  TELEMETRY_LAST_EMIT,
  TELEMETRY_DAILY_SALT,
  TELEMETRY_SALT_DATE,
  TELEMETRY_INGEST_URL,
} from '../shared/storage-keys'

// ── Types ──────────────────────────────────────────────────────────────────────

export type CounterKey =
  | 'analyze_started'
  | 'analyze_layer1_ok'
  | 'analyze_layer2_ok'
  | 'analyze_extraction_failed'
  | 'analyze_too_short'
  | 'analyze_llm_timeout'
  | 'analyze_invalid_key'
  | 'analyze_rate_limit'
  | 'key_saved'
  | 'key_rejected'

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
  domain_counts: Record<string, number>
}

interface TelemetryBatch {
  schema_version: 1
  extension_version: string
  period_start: string
  period_end: string
  counters: Omit<Counters, 'domain_counts'>
  domain_counts: Record<string, number>
}

type StoredCounters = Counters & {
  period_start: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const EMIT_INTERVAL_MS = 24 * 60 * 60 * 1000 // 24 hours
const DOMAIN_COUNT_CAP = 50

// Deferred to avoid module-init errors in test environments where
// chrome.runtime.getManifest is not yet available.
function getExtensionVersion(): string {
  return chrome.runtime.getManifest().version
}

// ── UTC date helpers ──────────────────────────────────────────────────────────

function utcDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

// ── Daily salt management ─────────────────────────────────────────────────────

async function getDailySalt(): Promise<string> {
  const today = utcDateString()
  const stored = await chrome.storage.local.get([TELEMETRY_DAILY_SALT, TELEMETRY_SALT_DATE])
  const storedDate = stored[TELEMETRY_SALT_DATE] as string | undefined
  const storedSalt = stored[TELEMETRY_DAILY_SALT] as string | undefined

  if (storedDate === today && storedSalt) {
    return storedSalt
  }

  // Day has flipped (or first run) — rotate the salt
  const newSalt = Array.from(
    crypto.getRandomValues(new Uint8Array(16)),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('')

  await chrome.storage.local.set({
    [TELEMETRY_DAILY_SALT]: newSalt,
    [TELEMETRY_SALT_DATE]: today,
  })

  return newSalt
}

// ── Domain hashing ────────────────────────────────────────────────────────────

/**
 * Returns a 12-char hex prefix of SHA-256(domain + dailySalt).
 * The daily salt prevents cross-day correlation of a specific domain to a device.
 */
async function hashDomain(domain: string, salt: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(domain + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12)
}

/**
 * Extracts the registrable domain from a URL hostname.
 * Strips leading www. and returns the bare hostname (eTLD+1 approximation).
 */
function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname
    return hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ── Counter storage helpers ───────────────────────────────────────────────────

const ZERO_COUNTERS: Readonly<Omit<Counters, 'domain_counts'>> = {
  analyze_started: 0,
  analyze_layer1_ok: 0,
  analyze_layer2_ok: 0,
  analyze_extraction_failed: 0,
  analyze_too_short: 0,
  analyze_llm_timeout: 0,
  analyze_invalid_key: 0,
  analyze_rate_limit: 0,
  key_saved: 0,
  key_rejected: 0,
}

async function readCounters(): Promise<StoredCounters> {
  const stored = await chrome.storage.local.get(TELEMETRY_COUNTERS)
  const raw = stored[TELEMETRY_COUNTERS] as StoredCounters | undefined
  if (!raw) {
    return { ...ZERO_COUNTERS, domain_counts: {}, period_start: utcDateString() }
  }
  return raw
}

async function writeCounters(counters: StoredCounters): Promise<void> {
  await chrome.storage.local.set({ [TELEMETRY_COUNTERS]: counters })
}

async function clearCounters(): Promise<void> {
  const today = utcDateString()
  await chrome.storage.local.set({
    [TELEMETRY_COUNTERS]: { ...ZERO_COUNTERS, domain_counts: {}, period_start: today },
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Bumps a telemetry counter by delta (default 1).
 * No-op when TELEMETRY_ENABLED is false.
 * Silently no-ops on any error (telemetry must never break the main extension flow).
 *
 * Pass pageUrl when bumping 'analyze_started' to record domain hash.
 */
export async function bump(key: CounterKey, delta = 1, pageUrl?: string): Promise<void> {
  try {
    await bumpInternal(key, delta, pageUrl)
  } catch {
    // Telemetry errors are non-fatal — swallow silently
  }
}

async function bumpInternal(key: CounterKey, delta: number, pageUrl?: string): Promise<void> {
  const stored = await chrome.storage.local.get(TELEMETRY_ENABLED)
  const enabled = stored[TELEMETRY_ENABLED] as boolean | undefined
  // Default true (set by onInstalled); treat undefined as true until onInstalled fires
  if (enabled === false) return

  const counters = await readCounters()
  const updated: StoredCounters = { ...counters, [key]: counters[key] + delta }

  if (key === 'analyze_started' && pageUrl) {
    const domain = extractDomain(pageUrl)
    if (domain) {
      const salt = await getDailySalt()
      const hash = await hashDomain(domain, salt)
      const domainCounts = { ...counters.domain_counts }

      if (hash in domainCounts) {
        domainCounts[hash] = domainCounts[hash] + 1
      } else if (Object.keys(domainCounts).length < DOMAIN_COUNT_CAP) {
        domainCounts[hash] = 1
      } else {
        // Overflow: bucket into __other__
        domainCounts['__other__'] = (domainCounts['__other__'] ?? 0) + 1
      }

      const result: StoredCounters = { ...updated, domain_counts: domainCounts }
      await writeCounters(result)
      return
    }
  }

  await writeCounters(updated)
}

/**
 * Called from the telemetry_emit alarm (6h cadence) and on service-worker startup.
 * Emits a batch if 24+ hours have elapsed since last successful emit.
 * Clears counters on 204. Retains counters on failure (retry next cycle).
 * No-op when TELEMETRY_ENABLED is false — discards any pending counters.
 * Silently no-ops on any error (telemetry must never break the main extension flow).
 */
export async function maybeEmit(): Promise<void> {
  try {
    await maybeEmitInternal()
  } catch {
    // Telemetry errors are non-fatal — swallow silently
  }
}

async function maybeEmitInternal(): Promise<void> {
  const stored = await chrome.storage.local.get([TELEMETRY_ENABLED, TELEMETRY_LAST_EMIT])
  const enabled = stored[TELEMETRY_ENABLED] as boolean | undefined
  if (enabled === false) {
    // Opt-out: discard pending counters and exit
    await clearCounters()
    return
  }

  const lastEmit = stored[TELEMETRY_LAST_EMIT] as number | undefined
  const now = Date.now()

  if (lastEmit !== undefined && now - lastEmit < EMIT_INTERVAL_MS) {
    return
  }

  const counters = await readCounters()
  const today = utcDateString()

  // Nothing to report if all counters are zero
  const hasActivity = Object.values(ZERO_COUNTERS).some(
    (_, i) => (counters[Object.keys(ZERO_COUNTERS)[i] as keyof typeof ZERO_COUNTERS] ?? 0) > 0,
  )
  const hasDomains = Object.keys(counters.domain_counts).length > 0
  if (!hasActivity && !hasDomains) return

  const { domain_counts, period_start, ...counterValues } = counters

  const batch: TelemetryBatch = {
    schema_version: 1,
    extension_version: getExtensionVersion(),
    period_start: period_start ?? today,
    period_end: today,
    counters: counterValues,
    domain_counts,
  }

  try {
    const response = await fetch(TELEMETRY_INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    })

    if (response.status === 204) {
      await clearCounters()
      await chrome.storage.local.set({ [TELEMETRY_LAST_EMIT]: now })
    }
    // Non-204: retain counters for next cycle (silent retry)
  } catch {
    // Network failure: retain counters, will retry next alarm cycle
  }
}
