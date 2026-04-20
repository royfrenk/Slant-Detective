import React from 'react';
import { FEEDBACK_FORM_URL } from '../shared/urls';

type PageKey = 'how-we-measure' | 'privacy' | 'credits' | 'how-to-get-a-key';

interface FooterNavProps {
  currentPage?: PageKey;
}

const LINK_CLASS = 'text-[0.625rem] text-on-surface-variant font-normal no-underline hover:underline cursor-pointer';
const ACTIVE_CLASS = 'text-[0.625rem] text-primary font-semibold no-underline';
const DOT_CLASS = 'text-[0.625rem] text-on-surface-variant';

export default function FooterNav({ currentPage }: FooterNavProps): React.JSX.Element {
  function openPage(pageName: string): void {
    chrome.tabs.create({ url: chrome.runtime.getURL(`src/pages/${pageName}.html`) }).catch(() => {});
  }

  function openExternalUrl(url: string): void {
    chrome.tabs.create({ url, active: true }).catch(() => {});
  }

  function openReportBugModal(): void {
    try {
      chrome.runtime.sendMessage({ action: 'openReportBugModal' });
    } catch {
      // Non-critical: message send failed (e.g., chrome API unavailable in test env).
    }
  }

  function navItem(page: PageKey, label: string, ariaLabel: string): React.JSX.Element {
    if (currentPage === page) {
      return (
        <span className={ACTIVE_CLASS} aria-current="page">
          {label}
        </span>
      );
    }
    return (
      <a
        role="link"
        tabIndex={0}
        aria-label={ariaLabel}
        className={LINK_CLASS}
        onClick={() => openPage(page)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage(page); }}
      >
        {label}
      </a>
    );
  }

  const dot = <span aria-hidden="true" className={DOT_CLASS}>·</span>;

  return (
    <nav aria-label="Extension pages" className="flex items-center justify-center gap-[6px] pb-6">
      {navItem('how-we-measure', 'How we measure', 'How we measure bias')}
      {dot}
      {navItem('privacy', 'Privacy', 'Privacy policy')}
      {dot}
      {navItem('credits', 'Credits', 'Credits and attributions')}
      {dot}
      <a
        role="link"
        tabIndex={0}
        aria-label="Open Slant Detective feedback form in new tab"
        className={LINK_CLASS}
        onClick={() => openExternalUrl(FEEDBACK_FORM_URL)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openExternalUrl(FEEDBACK_FORM_URL); }}
      >
        Feedback
      </a>
      {dot}
      <a
        role="link"
        tabIndex={0}
        aria-label="Report a bug"
        className={LINK_CLASS}
        onClick={openReportBugModal}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openReportBugModal(); }}
      >
        Report bug
      </a>
    </nav>
  );
}
