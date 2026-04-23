import React, { useState, useEffect, useCallback, useRef } from 'react';
import PanelChrome from './panel-chrome';
import ExtractionFailedCard from './extraction-failed-card';
import NonEnglishCard from './non-english-card';
import NotANewsPageCard from './not-a-news-page-card';
import FooterNav from './footer-nav';
import ReportBugModal from './report-bug-modal';
import Layer1SkeletonView from './layer1/layer1-skeleton-view';
import Layer1View from './layer1/layer1-view';
import Layer2SkeletonView from './layer2/layer2-skeleton-view';
import Layer2View from './layer2/layer2-view';
import InvalidKeyCard from './layer2/invalid-key-card';
import LLMTimeoutCard from './layer2/llm-timeout-card';
import RateLimitCard from './layer2/rate-limit-card';
import ContentFilteredCard from './layer2/content-filtered-card';
import type { InboundMessage } from '../shared/messages';
import type { Layer1Signals, RubricResponse } from '../shared/types';
import { PROVIDERS_KEY, ACTIVE_PROVIDER_KEY } from '../shared/storage-keys';

type Status = 'idle' | 'loading' | 'success' | 'error';
type Layer2Status = 'idle' | 'loading' | 'done' | 'error';
type Layer2ErrorType = 'timeout' | 'invalid_key' | 'rate_limit' | 'parse_error' | 'content_filtered' | null;
type ExtractionErrorType = 'extraction_failed' | 'non_english' | 'not_a_news_page' | null;


// 30s: first-run ONNX model load from HuggingFace can take 5–30s.
const ANALYSIS_TIMEOUT_MS = 30_000;
// Layer 2 watchdog. Provider-side fetch has a 30s AbortSignal; pipeline retries
// once on validation failure, so worst-case provider flow is ~60s. Add headroom
// over that so the skeleton can't spin forever if the service worker is
// terminated mid-request or drops its message.
const LAYER2_TIMEOUT_MS = 70_000;

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [extractionErrorType, setExtractionErrorType] = useState<ExtractionErrorType>(null);
  const [layer1Signals, setLayer1Signals] = useState<Layer1Signals | null>(null);
  const [layer2Status, setLayer2Status] = useState<Layer2Status>('idle');
  const [layer2Result, setLayer2Result] = useState<RubricResponse | null>(null);
  const [layer2ErrorType, setLayer2ErrorType] = useState<Layer2ErrorType>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showReportBug, setShowReportBug] = useState(false);
  const [reportBugData, setReportBugData] = useState<{ url: string; screenshotDataUrl: string | null } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layer2TimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check API key presence on mount and listen for changes.
  // Derive hasApiKey from providers[activeProvider].key in the new storage schema.
  useEffect(() => {
    chrome.storage.local.get([PROVIDERS_KEY, ACTIVE_PROVIDER_KEY], (result) => {
      const activeProvider = (result[ACTIVE_PROVIDER_KEY] as string | undefined) ?? 'anthropic';
      const providers = result[PROVIDERS_KEY] as Record<string, { key?: string }> | undefined;
      const key = providers?.[activeProvider]?.key;
      setHasApiKey(typeof key === 'string' && key.length > 0);
    });

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void {
      if (area !== 'local') return;
      if (PROVIDERS_KEY in changes || ACTIVE_PROVIDER_KEY in changes) {
        // Re-read both keys to derive hasApiKey correctly.
        chrome.storage.local.get([PROVIDERS_KEY, ACTIVE_PROVIDER_KEY], (result) => {
          const activeProvider = (result[ACTIVE_PROVIDER_KEY] as string | undefined) ?? 'anthropic';
          const providers = result[PROVIDERS_KEY] as Record<string, { key?: string }> | undefined;
          const key = providers?.[activeProvider]?.key;
          setHasApiKey(typeof key === 'string' && key.length > 0);
        });
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const armLayer2Watchdog = useCallback(() => {
    if (layer2TimeoutRef.current !== null) clearTimeout(layer2TimeoutRef.current);
    layer2TimeoutRef.current = setTimeout(() => {
      setLayer2Status((s) => {
        if (s === 'done' || s === 'error') return s;
        setLayer2ErrorType('timeout');
        return 'error';
      });
    }, LAYER2_TIMEOUT_MS);
  }, []);

  const startFreshAnalysis = useCallback(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    if (layer2TimeoutRef.current !== null) clearTimeout(layer2TimeoutRef.current);
    setStatus('loading');
    setExtractionErrorType(null);
    setLayer1Signals(null);
    setLayer2Status('idle');
    setLayer2Result(null);
    setLayer2ErrorType(null);
    chrome.runtime.sendMessage({ action: 'analyze' }).catch(() => {});
    timeoutRef.current = setTimeout(() => {
      setStatus((s) => (s === 'loading' ? 'error' : s));
    }, ANALYSIS_TIMEOUT_MS);
  }, []);

  const handleRetryLayer2 = useCallback(() => {
    setLayer2Status('loading');
    setLayer2Result(null);
    setLayer2ErrorType(null);
    armLayer2Watchdog();
    chrome.runtime.sendMessage({ action: 'retry_layer2' }).catch(() => {});
  }, [armLayer2Watchdog]);

  useEffect(() => {
    startFreshAnalysis();

    const listener = (message: InboundMessage) => {
      if (message.action === 'analyzed') {
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        setLayer1Signals(message.payload.layer1Signals ?? null);
        setStatus('success');
        // If layer2 result came bundled with the analysis
        if (message.payload.layer2 != null) {
          setLayer2Result(message.payload.layer2);
          setLayer2Status('done');
          if (layer2TimeoutRef.current !== null) clearTimeout(layer2TimeoutRef.current);
        } else {
          // Layer 2 runs asynchronously after L1 — arm the watchdog so the
          // skeleton can't spin forever if the SW is terminated or drops its
          // message.
          armLayer2Watchdog();
        }
      } else if (message.action === 'analysis_failed') {
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        if (layer2TimeoutRef.current !== null) clearTimeout(layer2TimeoutRef.current);
        const errType = message.reason as ExtractionErrorType;
        setExtractionErrorType(
          errType === 'non_english' || errType === 'not_a_news_page' ? errType : 'extraction_failed',
        );
        setStatus('error');
      } else if (message.action === 'tab_navigated') {
        setShowReportBug(false);
        setReportBugData(null);
        startFreshAnalysis();
      } else if (message.action === 'reportBugReady') {
        setReportBugData({ url: message.url, screenshotDataUrl: message.screenshotDataUrl });
        setShowReportBug(true);
      } else if (message.action === 'layer2_result') {
        if (layer2TimeoutRef.current !== null) clearTimeout(layer2TimeoutRef.current);
        setLayer2Result(message.payload);
        setLayer2Status('done');
      } else if (message.action === 'layer2_failed') {
        if (layer2TimeoutRef.current !== null) clearTimeout(layer2TimeoutRef.current);
        const errorTypeMap: Record<string, Layer2ErrorType> = {
          invalid_key: 'invalid_key',
          timeout: 'timeout',
          quota_exceeded: 'rate_limit',
          network_error: 'timeout',
          unknown: null,
          content_filtered: 'content_filtered',
        };
        setLayer2ErrorType(errorTypeMap[message.errorType] ?? null);
        setLayer2Status('error');
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
      if (layer2TimeoutRef.current !== null) clearTimeout(layer2TimeoutRef.current);
    };
  }, [startFreshAnalysis, armLayer2Watchdog]);

  const handleRetry = startFreshAnalysis;

  function renderLayer1Path(): React.ReactNode {
    if (status === 'idle' || status === 'loading') {
      return <Layer1SkeletonView />;
    }
    if (status === 'success' && layer1Signals != null) {
      return (
        <Layer1View
          signals={layer1Signals}
          hasApiKey={hasApiKey}
        />
      );
    }
    if (status === 'success' && layer1Signals == null) {
      return <ExtractionFailedCard onRetry={handleRetry} />;
    }
    if (status === 'error') {
      if (extractionErrorType === 'non_english') {
        return (
          <>
            <NonEnglishCard onRetry={handleRetry} />
            <div className="mt-4"><FooterNav /></div>
          </>
        );
      }
      if (extractionErrorType === 'not_a_news_page') {
        return (
          <>
            <NotANewsPageCard onRetry={handleRetry} />
            <div className="mt-4"><FooterNav /></div>
          </>
        );
      }
      return (
        <>
          <ExtractionFailedCard onRetry={handleRetry} />
          <div className="mt-4">
            <FooterNav />
          </div>
        </>
      );
    }
    return null;
  }

  function renderLayer2Path(): React.ReactNode {
    // Layer 1 still loading — show layer2 skeleton
    if (status === 'idle' || status === 'loading') {
      return <Layer2SkeletonView />;
    }

    // Layer 1 failed
    if (status === 'error') {
      if (extractionErrorType === 'non_english') {
        return (
          <>
            <NonEnglishCard onRetry={handleRetry} />
            <div className="mt-4"><FooterNav /></div>
          </>
        );
      }
      if (extractionErrorType === 'not_a_news_page') {
        return (
          <>
            <NotANewsPageCard onRetry={handleRetry} />
            <div className="mt-4"><FooterNav /></div>
          </>
        );
      }
      return (
        <>
          <ExtractionFailedCard onRetry={handleRetry} />
          <div className="mt-4">
            <FooterNav />
          </div>
        </>
      );
    }

    // Layer 1 succeeded — route on layer2Status
    if (layer2Status === 'idle' || layer2Status === 'loading') {
      return <Layer2SkeletonView />;
    }

    if (layer2Status === 'done' && layer2Result != null && layer1Signals != null) {
      return (
        <Layer2View result={layer2Result} layer1Signals={layer1Signals} />
      );
    }

    if (layer2Status === 'error') {
      return (
        <>
          {layer2ErrorType === 'invalid_key' && <InvalidKeyCard />}
          {layer2ErrorType === 'timeout' && <LLMTimeoutCard onRetry={handleRetryLayer2} />}
          {layer2ErrorType === 'rate_limit' && <RateLimitCard onRetry={handleRetryLayer2} />}
          {layer2ErrorType === 'content_filtered' && <ContentFilteredCard />}
          {(layer2ErrorType == null || layer2ErrorType === 'parse_error') && (
            <LLMTimeoutCard onRetry={handleRetryLayer2} />
          )}
          <div className="mt-4">
            <FooterNav />
          </div>
        </>
      );
    }

    // Fallback: layer1 success but no layer2 yet — show skeleton
    return <Layer2SkeletonView />;
  }

  return (
    <div className="relative flex flex-col h-full bg-background overflow-x-hidden">
      <PanelChrome onReload={startFreshAnalysis} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[560px] mx-auto w-full px-4 pt-4 pb-4">
          {hasApiKey ? renderLayer2Path() : renderLayer1Path()}
        </div>
      </main>
      {showReportBug && reportBugData != null && (
        <ReportBugModal
          initialUrl={reportBugData.url}
          screenshotDataUrl={reportBugData.screenshotDataUrl}
          onClose={() => { setShowReportBug(false); setReportBugData(null); }}
        />
      )}
    </div>
  );
}
