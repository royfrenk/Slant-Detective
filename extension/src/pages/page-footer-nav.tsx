import React from 'react';
import { FEEDBACK_FORM_URL } from '../shared/urls';

const GITHUB_URL = 'https://github.com/royfrenk/Slant-Detective' as const;

type PageKey = 'how-we-measure' | 'privacy' | 'credits' | 'how-to-get-a-key';

interface PageFooterNavProps {
  currentPage?: PageKey;
  showSourceCode?: boolean;
  showFeedback?: boolean;
  showCopyright?: boolean;
}

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

export default function PageFooterNav({ currentPage, showSourceCode = false, showFeedback = true, showCopyright = false }: PageFooterNavProps): React.JSX.Element {
  // Shared typography: uppercase, letter-spaced, small caps-style — matches the
  // header-wordmark treatment and establishes a consistent "chrome" language.
  const baseLinkClass = [
    'text-[0.625rem] font-semibold uppercase tracking-[0.12em]',
    'text-on-surface-variant',
    'no-underline hover:text-primary hover:underline',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm',
    'cursor-pointer whitespace-nowrap',
  ].join(' ');

  const activeLinkClass = [
    'text-[0.625rem] font-bold uppercase tracking-[0.12em]',
    'text-primary',
    'no-underline',
    'whitespace-nowrap',
  ].join(' ');

  function navItem(page: PageKey, label: string): React.JSX.Element {
    if (currentPage === page) {
      return (
        <span className={activeLinkClass} aria-current="page">
          {label}
        </span>
      );
    }
    return (
      <a
        role="link"
        tabIndex={0}
        className={baseLinkClass}
        onClick={() => openPage(page)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage(page); }}
        aria-label={`Open ${label} page`}
      >
        {label}
      </a>
    );
  }

  const dotClass = 'text-[0.625rem] text-on-surface-variant tracking-[0.12em]';
  const dot = <span aria-hidden="true" className={dotClass}>·</span>;

  const items: React.JSX.Element[] = [
    navItem('how-we-measure', 'How we measure'),
    navItem('privacy', 'Privacy'),
    navItem('credits', 'Credits'),
  ];
  if (showFeedback) {
    items.push(
      <a
        role="link"
        tabIndex={0}
        className={baseLinkClass}
        aria-label="Open Slant Detective feedback form in new tab"
        onClick={() => openExternalUrl(FEEDBACK_FORM_URL)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openExternalUrl(FEEDBACK_FORM_URL); }}
      >
        Feedback
      </a>
    );
  }
  items.push(
    <a
      role="link"
      tabIndex={0}
      className={baseLinkClass}
      aria-label="Report a bug"
      onClick={openReportBugModal}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openReportBugModal(); }}
    >
      Report bug
    </a>
  );
  if (showSourceCode) {
    items.push(
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Source code on GitHub (opens in new tab)"
        className={baseLinkClass}
      >
        Source code <span aria-hidden="true">↗</span>
      </a>
    );
  }

  const navLinks = (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && dot}
          {item}
        </React.Fragment>
      ))}
    </div>
  );

  if (showCopyright) {
    return (
      <nav
        aria-label="Extension pages"
        className="mt-10 pt-6 pb-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-2"
      >
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-on-surface-variant whitespace-nowrap">
          © 2026 Slant Detective Forensic Suite
        </span>
        {navLinks}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Extension pages"
      className="mt-10 pt-6"
    >
      {navLinks}
    </nav>
  );
}
