import type { ContentScriptResult, InboundMessage } from '../shared/messages';
import { ANTHROPIC_API_KEY, TELEMETRY_ENABLED } from '../shared/storage-keys';
import { runLayer2Analysis } from './layer2-pipeline';
import { AnthropicApiError } from './anthropic-client';
import { RubricValidationError } from './response-validator';
import { bump, maybeEmit } from './telemetry';

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

// Read the compiled content-script path from the installed manifest (path is hashed by Vite).
async function getContentScriptFile(): Promise<string> {
  const resp = await fetch(chrome.runtime.getURL('manifest.json'));
  const m = await resp.json() as { content_scripts: Array<{ js: string[] }> };
  return m.content_scripts[0].js[0];
}

async function sendAnalyze(tabId: number): Promise<ContentScriptResult> {
  try {
    return await chrome.tabs.sendMessage(tabId, { action: 'analyze' });
  } catch {
    // Tab was open before the extension was installed/reloaded — inject now and retry.
    const file = await getContentScriptFile();
    await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
    return await chrome.tabs.sendMessage(tabId, { action: 'analyze' });
  }
}

async function runAnalysis(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;

  if (!tabId) {
    const msg: InboundMessage = { action: 'analysis_failed', reason: 'no_active_tab' };
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
  const stored = await chrome.storage.local.get(ANTHROPIC_API_KEY);
  const apiKey = stored[ANTHROPIC_API_KEY] as string | undefined;

  if (!apiKey) {
    const msg: InboundMessage = { action: 'analyzed', payload: { ...result, layer2: null } };
    chrome.runtime.sendMessage(msg).catch(() => {});
    return;
  }

  const canonicalUrl = tab.url ?? '';

  try {
    const rubricResponse = await runLayer2Analysis(
      {
        title: result.title,
        body: result.body,
        canonicalUrl,
        rubricVersion: __RUBRIC_VERSION__,
      },
      apiKey,
    );

    void bump('analyze_layer2_ok');

    const msg: InboundMessage = { action: 'analyzed', payload: { ...result, layer2: rubricResponse } };
    chrome.runtime.sendMessage(msg).catch(() => {});

    // Send highlights to the content script
    chrome.tabs.sendMessage(tabId, {
      action: 'apply_highlights',
      spans: rubricResponse.spans,
    }).catch(() => {});
  } catch (err) {
    if (err instanceof AnthropicApiError && (err.statusCode === 401 || err.statusCode === 403)) {
      void bump('analyze_invalid_key');
      const msg: InboundMessage = { action: 'analysis_failed', reason: 'invalid_api_key' };
      chrome.runtime.sendMessage(msg).catch(() => {});
    } else if (err instanceof AnthropicApiError && err.statusCode === 429) {
      void bump('analyze_rate_limit');
      const msg: InboundMessage = { action: 'analysis_failed', reason: 'rate_limited' };
      chrome.runtime.sendMessage(msg).catch(() => {});
    } else if (err instanceof RubricValidationError) {
      const msg: InboundMessage = { action: 'analysis_failed', reason: 'rubric_validation_failed' };
      chrome.runtime.sendMessage(msg).catch(() => {});
    } else if (err instanceof DOMException && err.name === 'TimeoutError') {
      void bump('analyze_llm_timeout');
      const msg: InboundMessage = { action: 'analysis_failed', reason: 'network_error' };
      chrome.runtime.sendMessage(msg).catch(() => {});
    } else {
      const msg: InboundMessage = { action: 'analysis_failed', reason: 'network_error' };
      chrome.runtime.sendMessage(msg).catch(() => {});
    }
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

  if (message?.action === 'analyze') {
    runAnalysis();
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
