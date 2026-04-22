import type { Layer1Signals, RubricResponse, RubricSpan } from './types';

// Panel → service worker
export type OutboundMessage =
  | { action: 'analyze' }
  | { action: 'retry_layer2' }
  | { action: 'evidence_click'; spanId: string }
  | { action: 'openReportBugModal' };

// Content script analysis result — extraction result extended with Layer 1 signals.
export type ContentScriptResult =
  | { ok: false; error: 'extraction_failed' }
  | {
      ok: true
      title: string
      body: string
      word_count: number
      offsets: { start: number; end: number }[]
      layer1Signals: Layer1Signals | null
    };

// Service worker → panel
export type InboundMessage =
  | { action: 'analyzed'; payload: ContentScriptResult & { ok: true } & { layer2: RubricResponse | null } }
  | { action: 'analysis_failed'; reason: string }
  | { action: 'tab_navigated' }
  | { action: 'layer2_result'; payload: RubricResponse }
  | { action: 'layer2_failed'; errorType: 'invalid_key' | 'quota_exceeded' | 'network_error' | 'timeout' | 'unknown' | 'content_filtered' }
  | { action: 'highlight_hover'; spanId: string }
  | { action: 'highlight_click'; spanId: string }
  | { action: 'reportBugReady'; url: string; screenshotDataUrl: string | null };

// Service worker → content script
export type ContentScriptMessage =
  | { action: 'apply_highlights'; spans: RubricSpan[] }
  | { action: 'pulse_highlight'; spanId: string };

// Content script → service worker (sync messages forwarded to panel)
export type HighlightHoverMessage = { action: 'highlight_hover'; spanId: string };
export type HighlightClickMessage = { action: 'highlight_click'; spanId: string };
export type EvidenceClickMessage  = { action: 'evidence_click'; spanId: string };
