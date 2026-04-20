import { useState, useEffect, useRef, useCallback } from 'react';
import type { InboundMessage } from '../../shared/messages';

export interface HighlightSyncState {
  activeSpanId: string | null;
  pulsingSpanId: string | null;
  onEvidenceClick: (spanId: string) => void;
}

/**
 * SD-024: Manages bidirectional highlight ↔ evidence-row sync state.
 *
 * Listens for `highlight_hover` and `highlight_click` messages forwarded
 * by the service worker and returns reactive state for the panel to consume.
 * `onEvidenceClick` sends `evidence_click` to the SW for relay to the content script.
 */
export function useHighlightSync(): HighlightSyncState {
  const [activeSpanId, setActiveSpanId] = useState<string | null>(null);
  const [pulsingSpanId, setPulsingSpanId] = useState<string | null>(null);
  // Use a ref so the timeout ID survives re-renders without causing extra renders.
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const listener = (message: InboundMessage) => {
      if (message.action === 'highlight_hover') {
        // Clear any pending pulse-end timer and start a fresh one.
        if (pulseTimerRef.current !== null) {
          clearTimeout(pulseTimerRef.current);
        }
        setPulsingSpanId(message.spanId);
        pulseTimerRef.current = setTimeout(() => {
          setPulsingSpanId(null);
        }, 400);
      } else if (message.action === 'highlight_click') {
        setActiveSpanId(message.spanId);
        // EvidenceRow's useEffect owns scroll-into-view via its ref.
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      if (pulseTimerRef.current !== null) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  // Escape key clears active state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveSpanId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onEvidenceClick = useCallback((spanId: string) => {
    setActiveSpanId(spanId);
    // Non-critical: content script may not be injected; panel may be detached.
    chrome.runtime.sendMessage({ action: 'evidence_click', spanId }).catch(() => {});
  }, []);

  return { activeSpanId, pulsingSpanId, onEvidenceClick };
}
