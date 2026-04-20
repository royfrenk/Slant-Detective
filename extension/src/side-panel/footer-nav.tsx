import React from 'react';
import { FEEDBACK_FORM_URL } from '../shared/urls';

interface FooterNavProps {
  currentPage?: 'how-we-measure' | 'privacy' | 'credits' | 'how-to-get-a-key';
}

export default function FooterNav({ currentPage }: FooterNavProps): React.JSX.Element {
  function openPage(pageName: string): void {
    chrome.tabs.create({ url: chrome.runtime.getURL(`src/pages/${pageName}.html`) }).catch(() => {});
  }

  function openExternalUrl(url: string): void {
    chrome.tabs.create({ url, active: true }).catch(() => {});
  }

  function activeLinkClass(page: string): string {
    const isActive = currentPage === page;
    return [
      'text-[0.625rem] text-on-surface-variant no-underline hover:underline cursor-pointer',
      isActive ? 'font-semibold' : 'font-normal',
    ].join(' ');
  }

  const externalLinkClass = 'text-[0.625rem] text-on-surface-variant font-normal no-underline hover:underline cursor-pointer';

  return (
    <nav aria-label="Extension pages" className="flex items-center justify-center gap-[6px] pb-6">
      <a
        role="link"
        tabIndex={0}
        aria-label="How we measure bias"
        className={activeLinkClass('how-we-measure')}
        onClick={() => openPage('how-we-measure')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage('how-we-measure'); }}
      >
        How we measure
      </a>
      <span aria-hidden="true" className="text-[0.625rem] text-on-surface-variant">·</span>
      <a
        role="link"
        tabIndex={0}
        aria-label="Privacy policy"
        className={activeLinkClass('privacy')}
        onClick={() => openPage('privacy')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage('privacy'); }}
      >
        Privacy
      </a>
      <span aria-hidden="true" className="text-[0.625rem] text-on-surface-variant">·</span>
      <a
        role="link"
        tabIndex={0}
        className={activeLinkClass('credits')}
        onClick={() => openPage('credits')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage('credits'); }}
      >
        Credits
      </a>
      <span aria-hidden="true" className="text-[0.625rem] text-on-surface-variant">·</span>
      <a
        role="link"
        tabIndex={0}
        aria-label="Open Slant Detective feedback form in new tab"
        className={externalLinkClass}
        onClick={() => openExternalUrl(FEEDBACK_FORM_URL)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openExternalUrl(FEEDBACK_FORM_URL); }}
      >
        Feedback
      </a>
    </nav>
  );
}
