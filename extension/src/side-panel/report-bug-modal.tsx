import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReportBugToggle from './report-bug-toggle';
import { CloseIcon, SpinnerIcon, EyeIcon, ShieldIcon } from './report-bug-icons';

const WORKER_URL = 'https://sd-telemetry.rabbit-factory.workers.dev/v1/report-bug';
const MAX_DESCRIPTION_CHARS = 500;
const SCREENSHOT_SIZE_LIMIT = 900_000;
const SUCCESS_CLOSE_DELAY_MS = 1_500;

type SendState = 'idle' | 'sending' | 'success' | 'error' | 'rateLimited';

interface ReportBugModalProps {
  initialUrl: string;
  screenshotDataUrl: string | null;
  onClose: () => void;
}

export default function ReportBugModal({
  initialUrl,
  screenshotDataUrl,
  onClose,
}: ReportBugModalProps): React.JSX.Element {
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState(initialUrl);
  const [includeUrl, setIncludeUrl] = useState(true);
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [screenshotNote, setScreenshotNote] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  // Capture focus target before modal opened; focus textarea on mount
  useEffect(() => {
    returnFocusRef.current = document.activeElement;
    textareaRef.current?.focus();
  }, []);

  // Screenshot size gate on mount
  useEffect(() => {
    if (screenshotDataUrl === null) {
      setIncludeScreenshot(false);
      setScreenshotNote('Couldn\u2019t capture screenshot.');
    } else if (screenshotDataUrl.length > SCREENSHOT_SIZE_LIMIT) {
      setIncludeScreenshot(false);
      setScreenshotNote('Screenshot too large to attach.');
    }
  }, [screenshotDataUrl]);

  // Auto-close after success
  useEffect(() => {
    if (sendState !== 'success') return undefined;
    const timer = setTimeout(() => onClose(), SUCCESS_CLOSE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [sendState, onClose]);

  // Return focus to trigger element on unmount
  useEffect(() => {
    return () => {
      if (returnFocusRef.current instanceof HTMLElement) {
        returnFocusRef.current.focus();
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        if (description.trim().length > 0) {
          if (window.confirm('Discard bug report?')) onClose();
        } else {
          onClose();
        }
        return;
      }

      if (e.key !== 'Tab') return;
      const modal = modalRef.current;
      if (!modal) return;
      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [description, onClose],
  );

  const isSendDisabled =
    !includeUrl && !includeScreenshot && description.trim().length === 0;

  const handleSend = useCallback(async () => {
    if (isSendDisabled || sendState === 'sending') return;
    setSendState('sending');
    setInlineError(null);

    const payload: Record<string, string> = {};
    if (includeUrl && url.trim().length > 0) payload['url'] = url.trim();
    if (includeScreenshot && screenshotDataUrl !== null) {
      payload['screenshot_data_url'] = screenshotDataUrl;
    }
    if (description.trim().length > 0) payload['description'] = description.trim();

    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setSendState('success');
      } else if (res.status === 429) {
        setSendState('rateLimited');
        setInlineError('Too many reports. Please wait a moment before trying again.');
      } else {
        setSendState('error');
        setInlineError('Couldn\u2019t send \u2014 please try again.');
      }
    } catch {
      setSendState('error');
      setInlineError('Couldn\u2019t send \u2014 please try again.');
    }
  }, [isSendDisabled, sendState, includeUrl, url, includeScreenshot, screenshotDataUrl, description]);

  function renderSendLabel(): React.ReactNode {
    if (sendState === 'sending') return <><SpinnerIcon />{'\u00A0'}Sending\u2026</>;
    if (sendState === 'success') return '\u2713 Sent';
    return 'Send';
  }

  function renderScreenshotArea(): React.ReactNode {
    if (screenshotNote !== null) {
      return (
        <div className="h-[100px] bg-[#f2f4f6] rounded-lg flex items-center justify-center">
          <p className="text-[11px] italic text-[#45474c]">{screenshotNote}</p>
        </div>
      );
    }
    if (screenshotDataUrl !== null) {
      return (
        <div className={[
          'h-[100px] bg-[#f2f4f6] rounded-lg overflow-hidden relative group transition-opacity',
          !includeScreenshot ? 'opacity-50' : '',
        ].join(' ')}>
          <img src={screenshotDataUrl} alt="Page screenshot" className="w-full h-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-[#091426]/5 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <EyeIcon />
          </div>
        </div>
      );
    }
    return <div className="h-[100px] bg-[#f2f4f6] rounded-lg animate-pulse" />;
  }

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-bug-title"
      className="absolute inset-0 flex flex-col bg-[#f7f9fb] z-50"
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-4 bg-[#f7f9fb] z-30">
        <h2 id="report-bug-title" className="text-[14px] font-bold text-[#091426] tracking-tight">
          Report a Bug
        </h2>
        <button
          aria-label="Close"
          className="text-[#45474c] hover:text-[#091426] transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex flex-col gap-4">

          {/* Section 1: What Went Wrong */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="bug-description" className="text-[11px] uppercase font-bold text-[#45474c] tracking-wider">
                WHAT WENT WRONG? (OPTIONAL)
              </label>
              <span className="text-[10px] text-[#45474c]">{description.length} / {MAX_DESCRIPTION_CHARS}</span>
            </div>
            <textarea
              id="bug-description"
              ref={textareaRef}
              rows={3}
              maxLength={MAX_DESCRIPTION_CHARS}
              placeholder="Describe the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[#f2f4f6] border-none rounded-lg px-3 py-2 text-[12px] text-[#091426] w-full focus:ring-1 focus:ring-[#1e293b] outline-none resize-none transition-colors"
            />
          </div>

          {/* Section 2: Page URL */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label htmlFor="bug-url" className="text-[11px] uppercase font-bold text-[#45474c] tracking-wider">
                PAGE URL
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-[#45474c]">Include page URL</span>
                <ReportBugToggle checked={includeUrl} onChange={setIncludeUrl} ariaLabel="Include page URL" />
              </div>
            </div>
            <input
              id="bug-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className={[
                'bg-[#f2f4f6] border-none rounded-lg px-3 py-2 text-[12px] text-[#091426] w-full focus:outline-none transition-opacity',
                !includeUrl ? 'opacity-50 pointer-events-none' : '',
              ].join(' ')}
              aria-disabled={!includeUrl}
              tabIndex={includeUrl ? 0 : -1}
            />
          </div>

          {/* Section 3: Screenshot */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-[11px] uppercase font-bold text-[#45474c] tracking-wider">SCREENSHOT</span>
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-[#45474c]">Include screenshot</span>
                <ReportBugToggle
                  checked={includeScreenshot}
                  onChange={(val) => { if (screenshotNote === null) setIncludeScreenshot(val); }}
                  ariaLabel="Include screenshot"
                />
              </div>
            </div>
            {renderScreenshotArea()}
            <p className="text-[10px] italic text-[#45474c] leading-tight">
              Full page capture \u2014 cropping coming in a future update
            </p>
          </div>

          {/* Section 4: Privacy Note */}
          <p className="text-[11px] italic text-[#45474c]">
            Sent privately to royfrenk@gmail.com. Nothing is logged server-side.
          </p>

          {/* Section 5: Info Callout */}
          <div className="flex items-start gap-3 bg-[#f0f7f9] p-4 rounded-lg border-l-[4px] border-[#0ea5e9]">
            <ShieldIcon />
            <div className="flex flex-col gap-0.5">
              <p className="text-[12px] text-[#0c4a6e] font-bold leading-tight tracking-tight">
                Privacy &amp; Debugging Info
              </p>
              <p className="text-[11px] text-[#075985] font-medium leading-normal opacity-90">
                Screenshots and specific URLs help us debug and improve our product more effectively.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Inline error */}
      {inlineError !== null && (
        <div className="px-4 pb-1">
          <p className="text-[11px] text-red-600">{inlineError}</p>
        </div>
      )}

      {/* Action row */}
      <div className="px-4 py-4 bg-[#f7f9fb] border-t border-gray-100 flex justify-end gap-3 z-30">
        <button
          className="px-4 py-2 rounded-lg bg-white border border-[#e8ebed] text-[#091426] text-[12px] font-semibold hover:bg-gray-50 transition-colors"
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          aria-disabled={isSendDisabled || sendState === 'sending'}
          aria-label={sendState === 'sending' ? 'Sending bug report' : undefined}
          aria-busy={sendState === 'sending'}
          disabled={isSendDisabled || sendState === 'sending' || sendState === 'success'}
          className={[
            'px-5 py-2 rounded-lg bg-gradient-to-br from-[#1e293b] to-[#334155] text-white text-[12px] font-bold active:scale-95 transition-all shadow-[0_4px_12px_rgba(30,41,59,0.2)] flex items-center',
            isSendDisabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
          onClick={() => void handleSend()}
        >
          {renderSendLabel()}
        </button>
      </div>
    </div>
  );
}
