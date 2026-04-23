import type { ContentScriptResult, InboundMessage } from '../shared/messages';
import {
  ANTHROPIC_API_KEY,
  PROVIDERS_KEY,
  ACTIVE_PROVIDER_KEY,
  TELEMETRY_ENABLED,
} from '../shared/storage-keys';
import type { ProviderId } from './providers/types';
import { ProviderApiError } from './providers/types';
import { GeminiSafetyError } from './providers/gemini';
import { getProvider } from './providers/index';
import { runLayer2Analysis } from './layer2-pipeline';
import { resolveCanonicalUrl } from './canonical-url';
import { RubricValidationError } from './response-validator';
import { bump, maybeEmit, emitScoreSample } from './telemetry';
import { RUBRIC_MODEL } from './rubric-prompt';

// Shape stored at PROVIDERS_KEY
interface ProviderConfig {
  key: string
  model: string
}
interface ProvidersConfig {
  anthropic?: ProviderConfig
  openai?: ProviderConfig
  gemini?: ProviderConfig
}

/**
 * One-time idempotent migration from the old flat `anthropicApiKey` storage key
 * to the new nested `providers` / `activeProvider` schema.
 *
 * Runs on every SW startup (cheap no-op after first run) and on `onInstalled`.
 */
async function runStorageMigration(): Promise<void> {
  const stored = await chrome.storage.local.get([ANTHROPIC_API_KEY, PROVIDERS_KEY]);
  const oldKey = stored[ANTHROPIC_API_KEY] as string | undefined;
  const providers = stored[PROVIDERS_KEY] as ProvidersConfig | undefined;

  // Already migrated — nothing to do.
  if (providers?.anthropic) return;

  // Fresh install with no old key — nothing to do.
  if (!oldKey) return;

  // Migrate: write new schema and delete old flat key.
  const newProviders: ProvidersConfig = {
    ...(providers ?? {}),
    anthropic: { key: oldKey, model: RUBRIC_MODEL },
  };
  await chrome.storage.local.set({
    [PROVIDERS_KEY]: newProviders,
    [ACTIVE_PROVIDER_KEY]: 'anthropic' as ProviderId,
  });
  await chrome.storage.local.remove(ANTHROPIC_API_KEY);
}

// Run migration before any message listeners register.
void runStorageMigration();

// Open the panel on toolbar click. If the panel is already open, send
// tab_navigated so it resets and re-analyzes the current page.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
  // Sending after open ensures an already-open panel gets the signal.
  // A freshly-opened panel ignores this (listener not yet registered) and
  // triggers analysis via its own mount useEffect.
  const msg: InboundMessage = { action: 'tab_navigated' };
  chrome.runtime.sendMessage(msg).catch(() => {});
});

// Auto-re-analyze when the active tab completes a navigation.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  // Use chrome.tabs.get + tab.active to avoid the currentWindow race
  // (chrome.tabs.query({currentWindow:true}) resolves against the focused window
  // at query time, which may differ from the window containing tabId).
  const tab = await chrome.tabs.get(tabId).catch(() => null);
  if (!tab?.active) return;
  const msg: InboundMessage = { action: 'tab_navigated' };
  chrome.runtime.sendMessage(msg).catch(() => {});
});

// Auto-re-analyze when the user switches to another already-loaded tab.
// onUpdated only fires for new navigations, so tab switches between tabs that
// already finished loading previously would otherwise leave the panel showing
// the old article's analysis.
chrome.tabs.onActivated.addListener(() => {
  const msg: InboundMessage = { action: 'tab_navigated' };
  chrome.runtime.sendMessage(msg).catch(() => {});
});

// Read the compiled content-script path from the installed manifest (path is hashed by Vite).
async function getContentScriptFile(): Promise<string> {
  const resp = await fetch(chrome.runtime.getURL('manifest.json'));
  const m = await resp.json() as { content_scripts: Array<{ js: string[] }> };
  return m.content_scripts[0].js[0];
}

// SD-052: URL schemes where content scripts cannot run at all. Short-circuit to
// `not_a_news_page` so the panel shows the friendly label instead of a generic
// error ("Couldn't read this page"). Covers internal extension pages, chrome
// settings, about: pages, and devtools.
const NON_INJECTABLE_URL_RE = /^(chrome|chrome-extension|edge|brave|opera|about|devtools|view-source|chrome-search|chrome-untrusted):/i;

function isNonInjectableUrl(url: string | undefined): boolean {
  if (!url) return true;
  return NON_INJECTABLE_URL_RE.test(url) || url === 'about:blank';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// SD-051/SD-054/SD-055: The content script's `onMessage` listener registers
// during page load, but `chrome.tabs.sendMessage` can fire before that listener
// is live — e.g. when the user clicks the toolbar icon while the page is still
// parsing. Two compounding factors push thefp.com past the budget:
//
//   1. Heavy-tracker news sites (Mother Jones, The Free Press/Substack) don't
//      hit `document_idle` for several seconds because of Datadog/Coral/
//      pub.network/TrueAnthem bundles.
//   2. The CRX loader pattern (@crxjs/vite-plugin) splits the CS into a tiny
//      IIFE loader that does `await import(chrome.runtime.getURL(...))` for
//      the 538KB main module. The listener only registers AFTER that dynamic
//      import resolves + the module top-level evaluates. On a bogged-down
//      page that can stretch to >10s.
//
// Extended to ~15.3s across 8 attempts. The post-injection retry loop after
// the `executeScript` fallback now also waits generously (500/1000/2000/3000ms
// = 6.5s) instead of a single 100ms wait, giving the freshly-injected CS room
// to complete its dynamic import. Panel watchdog is 30s, so total budget fits.
const SEND_ANALYZE_BACKOFF_MS = [50, 150, 300, 600, 1200, 2000, 3000, 8000] as const;
const POST_INJECT_RETRY_MS = [500, 1000, 2000, 3000] as const;

async function sendAnalyze(tabId: number): Promise<ContentScriptResult> {
  let lastErr: unknown = null;

  for (const delay of SEND_ANALYZE_BACKOFF_MS) {
    try {
      return await chrome.tabs.sendMessage(tabId, { action: 'analyze' });
    } catch (err) {
      lastErr = err;
      await sleep(delay);
    }
  }

  // Tab was open before the extension was installed/reloaded, or the declarative
  // CS loader is still resolving its dynamic import. Inject manually, then
  // retry with backoff to let the freshly-injected module finish parsing.
  try {
    const file = await getContentScriptFile();
    await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
  } catch (err) {
    // executeScript itself failed (CSP, permission, about:blank race). Nothing
    // else to try — surface the original "Receiving end" error, not this one.
    throw lastErr ?? err;
  }

  for (const delay of POST_INJECT_RETRY_MS) {
    await sleep(delay);
    try {
      return await chrome.tabs.sendMessage(tabId, { action: 'analyze' });
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr;
}

async function runAnalysis(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;

  if (!tabId) {
    const msg: InboundMessage = { action: 'analysis_failed', reason: 'no_active_tab' };
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  // SD-052: Internal/extension URLs can't host a content script. Treat them as
  // "not a news page" rather than letting sendAnalyze fail and route to the
  // generic extraction-failed card.
  if (isNonInjectableUrl(tab.url)) {
    const msg: InboundMessage = { action: 'analysis_failed', reason: 'not_a_news_page' };
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  // SD-030: bump analyze_started with page URL for domain-hash tracking
  void bump('analyze_started', 1, tab.url ?? '');

  let result: ContentScriptResult;
  try {
    result = await sendAnalyze(tabId);
  } catch {
    const msg: InboundMessage = { action: 'analysis_failed', reason: 'no_content_script' };
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  if (!result.ok) {
    if (result.error === 'extraction_failed') {
      void bump('analyze_extraction_failed');
    }
    const msg: InboundMessage = { action: 'analysis_failed', reason: result.error };
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  // Word-count floor check — bump counter if article is too short
  if (result.word_count < 400) {
    void bump('analyze_too_short');
  }

  // Layer 1 complete
  void bump('analyze_layer1_ok');

  // Check for API key and attempt Layer 2
  const stored = await chrome.storage.local.get([PROVIDERS_KEY, ACTIVE_PROVIDER_KEY]);
  const activeProviderId = (stored[ACTIVE_PROVIDER_KEY] as ProviderId | undefined) ?? 'anthropic';
  const providers = stored[PROVIDERS_KEY] as ProvidersConfig | undefined;
  const apiKey = providers?.[activeProviderId]?.key;
  const model = providers?.[activeProviderId]?.model ?? RUBRIC_MODEL;

  if (!apiKey) {
    const msg: InboundMessage = { action: 'analyzed', payload: { ...result, layer2: null } };
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  // Emit Layer 1 immediately so the panel can render while Layer 2 runs.
  // Layer 2 completion is announced separately via layer2_result or layer2_failed,
  // so an LLM error no longer wipes the Layer 1 view into "Couldn't read this page".
  const l1Msg: InboundMessage = { action: 'analyzed', payload: { ...result, layer2: null } };
  chrome.runtime.sendMessage(l1Msg).catch(() => {});

  const canonicalUrl = resolveCanonicalUrl(tab.url ?? '', result.canonicalSignals);
  const provider = getProvider(activeProviderId);

  try {
    const rubricResponse = await runLayer2Analysis(
      {
        title: result.title,
        body: result.body,
        canonicalUrl,
        rubricVersion: __RUBRIC_VERSION__,
        provider: activeProviderId,
        model,
      },
      provider,
      apiKey,
    );

    void bump('analyze_layer2_ok');

    // SD-041: Emit anonymised score sample for empirical percentile curves.
    // pageUrl is tab.url from the outer scope — only eTLD+1 is extracted client-side.
    void emitScoreSample({
      pageUrl: tab.url ?? '',
      overall: rubricResponse.overall.intensity,
      word_choice: rubricResponse.dimensions.word_choice.score,
      framing: rubricResponse.dimensions.framing.score,
      headline_slant: rubricResponse.dimensions.headline_slant.score,
      source_mix: rubricResponse.dimensions.source_mix.score,
      direction: rubricResponse.overall.direction,
      provider: activeProviderId,
      rubric_version: rubricResponse.rubric_version,
    });

    const msg: InboundMessage = { action: 'layer2_result', payload: rubricResponse };
    chrome.runtime.sendMessage(msg).catch(() => {});

    // Send highlights to the content script
    chrome.tabs.sendMessage(tabId, {
      action: 'apply_highlights',
      spans: rubricResponse.spans,
    }).catch(() => {});
  } catch (err) {
    let errorType: 'invalid_key' | 'quota_exceeded' | 'network_error' | 'timeout' | 'invalid_response' | 'unknown' | 'content_filtered' = 'unknown';
    if (err instanceof GeminiSafetyError) {
      errorType = 'content_filtered';
    } else if (err instanceof ProviderApiError && (err.statusCode === 400 || err.statusCode === 401 || err.statusCode === 403)) {
      // 400 maps to invalid key for Gemini (its invalid-key HTTP status).
      void bump('analyze_invalid_key');
      errorType = 'invalid_key';
    } else if (err instanceof ProviderApiError && err.statusCode === 429) {
      void bump('analyze_rate_limit');
      errorType = 'quota_exceeded';
    } else if (err instanceof DOMException && err.name === 'TimeoutError') {
      void bump('analyze_llm_timeout');
      errorType = 'timeout';
    } else if (err instanceof RubricValidationError) {
      // Model returned (possibly after retry) but payload failed schema validation.
      // Distinguished from 'timeout' so the panel can show accurate copy.
      errorType = 'invalid_response';
    } else {
      errorType = 'network_error';
    }
    const msg: InboundMessage = { action: 'layer2_failed', errorType };
    chrome.runtime.sendMessage(msg).catch(() => {});
  }
}

// Panel sends {action:'analyze'} on mount (and on retry). SW routes to content script.
// SD-024: also routes highlight sync messages between content script and panel.
chrome.runtime.onMessage.addListener((message) => {
  // SD-024: Forward hover/click from content script to panel.
  if (message?.action === 'highlight_hover' || message?.action === 'highlight_click') {
    chrome.runtime.sendMessage(message).catch(() => {});
    return false;
  }

  // SD-024: Forward evidence_click from panel to content script.
  if (message?.action === 'evidence_click') {
    void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'pulse_highlight',
          spanId: message.spanId,
        }).catch(() => {});
      }
    });
    return false;
  }

  if (message?.action === 'analyze' || message?.action === 'retry_layer2') {
    runAnalysis();
  }

  // Content-script tooltip requests an extension page to be opened. chrome.tabs
  // is unavailable from content scripts and window.open hits a WAR check that
  // blocks chrome-extension:// URLs opened from http/https pages
  // (ERR_BLOCKED_BY_CLIENT). SW proxies the tab creation with an allowlist.
  if (message?.action === 'openPage' && typeof message?.page === 'string') {
    const ALLOWED_PAGES = ['how-we-measure', 'privacy', 'credits', 'how-to-get-a-key'] as const;
    if ((ALLOWED_PAGES as readonly string[]).includes(message.page)) {
      const url = chrome.runtime.getURL(`src/pages/${message.page}.html`);
      chrome.tabs.create({ url, active: true }).catch(() => {});
    }
    return false;
  }

  // SD-038: Capture screenshot + ensure panel open + broadcast reportBugReady.
  if (message?.action === 'openReportBugModal') {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tab?.id;
      const url = tab?.url ?? '';

      let screenshotDataUrl: string | null = null;
      if (typeof tab?.windowId === 'number') {
        try {
          screenshotDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
        } catch {
          // Permission denied or tab not captureable (e.g., chrome:// pages).
          screenshotDataUrl = null;
        }
      }

      if (typeof tabId === 'number') {
        try {
          await chrome.sidePanel.open({ tabId });
        } catch {
          // Panel may already be open — non-fatal.
        }
      }

      const ready: InboundMessage = { action: 'reportBugReady', url, screenshotDataUrl };
      chrome.runtime.sendMessage(ready).catch(() => {});
    })();
    return false;
  }
});

// SD-030: Emit telemetry on the telemetry_emit alarm (6h cadence).
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'telemetry_emit') {
    void maybeEmit();
  }
});

// Open the welcome tab exactly once on fresh install.
// Extension update (reason === 'update') and browser reload (reason === 'chrome_update')
// must NOT open the tab.
chrome.runtime.onInstalled.addListener((details) => {
  // Run migration on install/update so existing users get migrated
  // even if the SW was already active (onInstalled fires for updates too).
  void runStorageMigration();

  if (details.reason === 'install') {
    try {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
    } catch {
      // Non-critical: failure to open the welcome tab must not crash the service worker.
    }

    // SD-030: Set default telemetry opt-in on fresh install.
    chrome.storage.local.get(TELEMETRY_ENABLED, (result) => {
      if (result[TELEMETRY_ENABLED] === undefined) {
        chrome.storage.local.set({ [TELEMETRY_ENABLED]: true });
      }
    });

    // SD-030: Register telemetry alarm (6h cadence = 360 minutes).
    chrome.alarms.create('telemetry_emit', { periodInMinutes: 360 });
  }
});

// SD-030: Check for pending telemetry on service-worker startup.
void maybeEmit();
