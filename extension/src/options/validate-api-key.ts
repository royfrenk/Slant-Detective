// Thin shim for backward compatibility with existing tests and callers.
// The real implementation lives in providers/anthropic.ts.
export type { ApiKeyTestResult } from '../service-worker/providers/types'
import { getProvider } from '../service-worker/providers/index'

export async function validateApiKey(key: string): Promise<import('../service-worker/providers/types').ApiKeyTestResult> {
  return getProvider('anthropic').validateKey(key)
}
