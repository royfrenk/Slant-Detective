import React, { useState, useEffect } from 'react';
import { LAYER2_SUCCESS_COUNT, REVIEW_PROMPT_SHOWN } from '../../shared/storage-keys';
import { getReviewUrl } from '../../shared/urls';

const REVIEW_THRESHOLD = 5;

const PRIMARY_BUTTON_CLASSES =
  'bg-gradient-to-br from-primary to-primary-container text-on-primary font-semibold ' +
  'text-[0.75rem] h-8 px-3 rounded-[6px] border-0 cursor-pointer ' +
  'hover:brightness-[0.96] active:brightness-[0.92] ' +
  'focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-primary focus-visible:outline-offset-2';

// Secondary sits on surface-variant card, so uses one-step-darker fill for contrast.
const SECONDARY_BUTTON_CLASSES =
  'bg-[#e5e7eb] hover:bg-[#d1d5db] active:bg-[#c9cdd1] text-on-surface font-semibold ' +
  'text-[0.75rem] h-8 px-3 rounded-[6px] border-0 cursor-pointer ' +
  'focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-primary focus-visible:outline-offset-2';

const CLOSE_BUTTON_CLASSES =
  'text-[0.875rem] text-on-surface-variant leading-none flex-shrink-0 cursor-pointer ' +
  'bg-transparent border-0 p-0 hover:text-on-surface ' +
  'focus-visible:outline focus-visible:outline-2 ' +
  'focus-visible:outline-primary focus-visible:outline-offset-2';

export default function ReviewPromptCard(): React.JSX.Element | null {
  const reviewUrl = getReviewUrl();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reviewUrl === null) return;
    if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

    chrome.storage.local.get([LAYER2_SUCCESS_COUNT, REVIEW_PROMPT_SHOWN], (result) => {
      const count =
        typeof result[LAYER2_SUCCESS_COUNT] === 'number'
          ? (result[LAYER2_SUCCESS_COUNT] as number)
          : 0;
      const shown = result[REVIEW_PROMPT_SHOWN] === true;
      if (!shown && count >= REVIEW_THRESHOLD) {
        setVisible(true);
      }
    });
  }, [reviewUrl]);

  function dismiss(): void {
    setVisible(false);
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [REVIEW_PROMPT_SHOWN]: true });
    }
  }

  function handlePrimaryCta(): void {
    // reviewUrl is guaranteed non-null here because visible is only true when reviewUrl != null
    chrome.tabs.create({ url: reviewUrl as string });
    dismiss();
  }

  if (!visible || reviewUrl === null) return null;

  return (
    <article
      role="region"
      aria-label="Enjoying Slant Detective? Leave a review"
      className="relative bg-surface-variant rounded-[10px] p-4"
    >
      <h2 className="text-[0.875rem] font-semibold text-primary leading-[1.4] pr-7">
        Enjoying Slant Detective?
      </h2>

      <p className="text-[0.75rem] text-on-surface-variant leading-[1.5] mt-1">
        Leave a quick review on the Chrome Web Store &mdash; it really helps.
      </p>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          aria-label="Leave a review on the Chrome Web Store — opens in new tab"
          onClick={handlePrimaryCta}
          className={PRIMARY_BUTTON_CLASSES}
        >
          Leave a review
        </button>
        <button
          type="button"
          aria-label="Not now — dismiss review prompt"
          onClick={dismiss}
          className={SECONDARY_BUTTON_CLASSES}
        >
          Not now
        </button>
      </div>

      <button
        type="button"
        aria-label="Dismiss review prompt"
        onClick={dismiss}
        className={`${CLOSE_BUTTON_CLASSES} absolute top-3 right-3`}
      >
        &times;
      </button>
    </article>
  );
}
