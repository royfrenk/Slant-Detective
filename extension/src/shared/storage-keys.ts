// Kept temporarily for the migration helper in service-worker/index.ts.
// Deleted once all users are migrated to PROVIDERS_KEY / ACTIVE_PROVIDER_KEY.
export const ANTHROPIC_API_KEY = 'anthropicApiKey' as const

export const CACHE_PREFIX = 'sd_cache_' as const
export const CACHE_MAX_ENTRIES = 200 as const

// SD-031: Multi-provider storage keys
export const PROVIDERS_KEY = 'providers' as const
export const ACTIVE_PROVIDER_KEY = 'activeProvider' as const

// SD-030: Aggregate-only telemetry keys
export const TELEMETRY_ENABLED = 'telemetryEnabled' as const
export const TELEMETRY_COUNTERS = 'telemetryCounters' as const
export const TELEMETRY_LAST_EMIT = 'telemetryLastEmit' as const
export const TELEMETRY_DAILY_SALT = 'telemetryDailySalt' as const
export const TELEMETRY_SALT_DATE = 'telemetrySaltDate' as const
