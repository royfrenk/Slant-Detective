/**
 * eval/providers/index.mjs — Provider factory for the eval harness
 *
 * Usage:
 *   const provider = getProvider('openai')   // returns openai driver module
 *   const apiKey   = getApiKey('openai')     // reads OPENAI_API_KEY, exits 1 if missing
 *
 * Each driver module exports:
 *   { id, DEFAULT_MODEL, validateKey, complete, parseTokenUsage,
 *     extractText (OpenAI + Gemini only), RUBRIC_VERSION,
 *     input_price_per_million, output_price_per_million }
 */

import * as anthropic from './anthropic.mjs'
import * as openai from './openai.mjs'
import * as gemini from './gemini.mjs'

// ─── Provider registry ────────────────────────────────────────────────────────

export const PROVIDER_NAMES = /** @type {const} */ (['anthropic', 'openai', 'gemini'])

/** @type {Record<string, object>} */
const PROVIDERS = {
  anthropic,
  openai,
  gemini,
}

/** @type {Record<string, string>} */
export const DEFAULT_MODELS = {
  anthropic: anthropic.DEFAULT_MODEL,
  openai: openai.DEFAULT_MODEL,
  gemini: gemini.DEFAULT_MODEL,
}

/** @type {Record<string, string>} */
const ENV_VARS = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Return the driver module for the named provider.
 * Throws a named ProviderError if the name is not recognised.
 *
 * @param {string} name
 * @returns {object} - Driver module
 */
export function getProvider(name) {
  const driver = PROVIDERS[name]
  if (!driver) {
    const valid = PROVIDER_NAMES.join(', ')
    const err = new Error(
      `Unknown provider "${name}". Valid providers: ${valid}`
    )
    err.name = 'ProviderError'
    throw err
  }
  return driver
}

/**
 * Read the API key for the named provider from the environment.
 * Calls process.exit(1) with a clear error message if the env var is missing.
 *
 * @param {string} name - Provider name
 * @returns {string} - API key
 */
export function getApiKey(name) {
  const envVar = ENV_VARS[name]
  if (!envVar) {
    const err = new Error(`No env var mapping for provider "${name}"`)
    err.name = 'ProviderError'
    throw err
  }

  const apiKey = process.env[envVar]
  if (!apiKey || apiKey.trim() === '') {
    process.stderr.write(
      `Error: ${envVar} is not set. ` +
      `Set it before running: ${envVar}=<your-key> node eval/run.mjs --provider ${name}\n`
    )
    process.exit(1)
  }

  return apiKey
}
