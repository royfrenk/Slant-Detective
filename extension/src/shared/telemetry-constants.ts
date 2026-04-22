// SD-030: Telemetry constants (non-storage).
// Kept separate from storage-keys.ts because these are remote URLs, not
// chrome.storage.local keys.
export const TELEMETRY_INGEST_URL =
  'https://sd-telemetry.rabbit-factory.workers.dev/v1/ingest' as const

// SD-041: Score sample endpoint — receives individual score_sample events.
export const TELEMETRY_SCORE_SAMPLE_URL =
  'https://sd-telemetry.rabbit-factory.workers.dev/v1/score-sample' as const
