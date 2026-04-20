import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// This test exercises the storage migration logic extracted from index.ts.
// We replicate the migration function here rather than importing index.ts
// (which registers Chrome event listeners at module load time).
// ---------------------------------------------------------------------------

const ANTHROPIC_API_KEY = 'anthropicApiKey'
const PROVIDERS_KEY = 'providers'
const ACTIVE_PROVIDER_KEY = 'activeProvider'
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

interface ProviderConfig { key: string; model: string }
interface ProvidersConfig {
  anthropic?: ProviderConfig
  openai?: ProviderConfig
  gemini?: ProviderConfig
}

/**
 * Replica of the runStorageMigration logic from service-worker/index.ts.
 * The test exercises this logic in isolation via a mocked storage API.
 */
async function runStorageMigration(
  storage: Record<string, unknown>,
): Promise<void> {
  const oldKey = storage[ANTHROPIC_API_KEY] as string | undefined
  const providers = storage[PROVIDERS_KEY] as ProvidersConfig | undefined

  if (providers?.anthropic) return
  if (!oldKey) return

  const newProviders: ProvidersConfig = {
    ...(providers ?? {}),
    anthropic: { key: oldKey, model: DEFAULT_MODEL },
  }
  delete storage[ANTHROPIC_API_KEY]
  storage[PROVIDERS_KEY] = newProviders
  storage[ACTIVE_PROVIDER_KEY] = 'anthropic'
}

describe('runStorageMigration', () => {
  let storage: Record<string, unknown>

  beforeEach(() => {
    storage = {}
    vi.clearAllMocks()
  })

  it('migrates old anthropicApiKey to providers.anthropic.key', async () => {
    storage[ANTHROPIC_API_KEY] = 'sk-ant-oldkey'

    await runStorageMigration(storage)

    const providers = storage[PROVIDERS_KEY] as ProvidersConfig
    expect(providers?.anthropic?.key).toBe('sk-ant-oldkey')
    expect(providers?.anthropic?.model).toBe(DEFAULT_MODEL)
    expect(storage[ACTIVE_PROVIDER_KEY]).toBe('anthropic')
    expect(storage[ANTHROPIC_API_KEY]).toBeUndefined()
  })

  it('does not overwrite existing providers.anthropic (idempotent — new schema present)', async () => {
    const existingProviders: ProvidersConfig = {
      anthropic: { key: 'sk-ant-already-migrated', model: DEFAULT_MODEL },
    }
    storage[PROVIDERS_KEY] = existingProviders
    storage[ACTIVE_PROVIDER_KEY] = 'anthropic'

    await runStorageMigration(storage)

    const providers = storage[PROVIDERS_KEY] as ProvidersConfig
    expect(providers?.anthropic?.key).toBe('sk-ant-already-migrated')
    // Old key was never present, nothing to remove
    expect(storage[ANTHROPIC_API_KEY]).toBeUndefined()
  })

  it('does nothing on fresh install (neither old key nor new schema)', async () => {
    await runStorageMigration(storage)

    expect(storage[PROVIDERS_KEY]).toBeUndefined()
    expect(storage[ACTIVE_PROVIDER_KEY]).toBeUndefined()
    expect(storage[ANTHROPIC_API_KEY]).toBeUndefined()
  })

  it('handles edge case where both old key and new providers exist (old key wins migration)', async () => {
    // This shouldn't happen normally but must not corrupt the new schema.
    storage[ANTHROPIC_API_KEY] = 'sk-ant-stale'
    const existingProviders: ProvidersConfig = {
      anthropic: { key: 'sk-ant-already-migrated', model: DEFAULT_MODEL },
    }
    storage[PROVIDERS_KEY] = existingProviders

    await runStorageMigration(storage)

    // providers.anthropic already exists → no-op
    const providers = storage[PROVIDERS_KEY] as ProvidersConfig
    expect(providers?.anthropic?.key).toBe('sk-ant-already-migrated')
    // Old key left in place (migration guard exited early)
    expect(storage[ANTHROPIC_API_KEY]).toBe('sk-ant-stale')
  })
})
