// SD-030: Telemetry constants (non-storage).
// Kept separate from storage-keys.ts because this is a remote URL, not a
// chrome.storage.local key.
export const TELEMETRY_INGEST_URL =
  'https://sd-telemetry.rabbit-factory.workers.dev/v1/ingest' as const
