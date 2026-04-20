import React, { useState, useEffect, useCallback, useRef } from 'react';
import PanelChrome from './panel-chrome';
import ExtractionFailedCard from './extraction-failed-card';
import FooterNav from './footer-nav';
import Layer1SkeletonView from './layer1/layer1-skeleton-view';
import Layer1View from './layer1/layer1-view';
import Layer2SkeletonView from './layer2/layer2-skeleton-view';
import Layer2View from './layer2/layer2-view';
import InvalidKeyCard from './layer2/invalid-key-card';
import LLMTimeoutCard from './layer2/llm-timeout-card';
import RateLimitCard from './layer2/rate-limit-card';
import type { InboundMessage } from '../shared/messages';
import type { Layer1Signals, RubricResponse } from '../shared/types';
import { ANTHROPIC_API_KEY } from '../shared/storage-keys';

type Status = 'idle' | 'loading' | 'success' | 'error';
type Layer2Status = 'idle' | 'loading' | 'done' | 'error';
type Layer2ErrorType = 'timeout' | 'invalid_key' | 'rate_limit' | 'parse_error' | null;


// 30s: first-run ONNX model load from HuggingFace can take 5–30s.
const ANALYSIS_TIMEOUT_MS = 30_000;

export default function App(): React.JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [layer1Signals, setLayer1Signals] = useState<Layer1Signals | null>(null);
  const [layer2Status, setLayer2Status] = useState<Layer2Status>('idle');
  const [layer2Result, setLayer2Result] = useState<RubricResponse | null>(null);
  const [layer2ErrorType, setLayer2ErrorType] = useState<Layer2ErrorType>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check API key presence on mount and listen for changes
  useEffect(() => {
    chrome.storage.local.get(ANTHROPIC_API_KEY, (result) => {
      setHasApiKey(typeof result[ANTHROPIC_API_KEY] === 'string' && result[ANTHROPIC_API_KEY].length > 0);
    });

    function handleStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ): void {
      if (area !== 'local') return;
      if (ANTHROPIC_API_KEY in changes) {
        const newVal = changes[ANTHROPIC_API_KEY]?.newValue;
        setHasApiKey(typeof newVal === 'string' && newVal.length > 0);
      }
    }

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  const startFreshAnalysis = useCallback(() => {
    if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    setStatus('loading');
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
    chrome.runtime.sendMessage({ action: 'retry_layer2' }).catch(() => {});
  }, []);

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
        }
      } else if (message.action === 'analysis_failed') {
        if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
        setStatus('error');
      } else if (message.action === 'tab_navigated') {
        startFreshAnalysis();
      } else if (message.action === 'layer2_result') {
        setLayer2Result(message.payload);
        setLayer2Status('done');
      } else if (message.action === 'layer2_failed') {
        const errorTypeMap: Record<string, Layer2ErrorType> = {
          invalid_key: 'invalid_key',
          timeout: 'timeout',
          quota_exceeded: 'rate_limit',
          network_error: 'timeout',
          unknown: null,
        };
        setLayer2ErrorType(errorTypeMap[message.errorType] ?? null);
        setLayer2Status('error');
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current);
    };
  }, [startFreshAnalysis]);

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
    <div className="flex flex-col h-full bg-background overflow-x-hidden">
      <PanelChrome />
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="max-w-[560px] mx-auto w-full px-4 pt-4 pb-4">
          {hasApiKey ? renderLayer2Path() : renderLayer1Path()}
        </div>
      </main>
    </div>
  );
}
