import React from 'react';
import { FEEDBACK_FORM_URL } from '../shared/urls';

const GITHUB_URL = 'https://github.com/royfrenk/Slant-Detective' as const;

type PageKey = 'how-we-measure' | 'privacy' | 'credits' | 'how-to-get-a-key';

interface PageFooterNavProps {
  currentPage?: PageKey;
  showSourceCode?: boolean;
}

function openPage(pageName: string): void {
  chrome.tabs.create({ url: chrome.runtime.getURL(`src/pages/${pageName}.html`) }).catch(() => {});
}

function openExternalUrl(url: string): void {
  chrome.tabs.create({ url, active: true }).catch(() => {});
}

export default function PageFooterNav({ currentPage, showSourceCode = false }: PageFooterNavProps): React.JSX.Element {
  const linkClass = [
    'text-xs text-on-surface-variant font-normal',
    'no-underline hover:underline',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm',
  ].join(' ');

  const activeClass = [
    'text-xs text-primary font-semibold',
    'no-underline',
  ].join(' ');

  function navItem(page: PageKey, label: string): React.JSX.Element {
    if (currentPage === page) {
      return (
        <span className={activeClass} aria-current="page">
          {label}
        </span>
      );
    }
    return (
      <a
        role="link"
        tabIndex={0}
        className={linkClass}
        onClick={() => openPage(page)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPage(page); }}
        aria-label={`Open ${label} page`}
      >
        {label}
      </a>
    );
  }

  const dot = <span aria-hidden="true" className="mx-2 text-xs text-on-surface-variant select-none">·</span>;

  return (
    <nav
      aria-label="Extension pages"
      className="mt-12 border-t border-outline pt-4"
    >
      <div className="flex flex-nowrap items-center gap-0">
        {navItem('how-we-measure', 'How we measure')}
        {dot}
        {navItem('privacy', 'Privacy')}
        {dot}
        {navItem('credits', 'Credits')}
        {dot}
        <a
          role="link"
          tabIndex={0}
          className={linkClass}
          aria-label="Open Slant Detective feedback form in new tab"
          onClick={() => openExternalUrl(FEEDBACK_FORM_URL)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openExternalUrl(FEEDBACK_FORM_URL); }}
        >
          Feedback
        </a>
        {showSourceCode && (
          <>
            {dot}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source code on GitHub (opens in new tab)"
              className={linkClass}
            >
              Source code
            </a>
          </>
        )}
      </div>
    </nav>
  );
}
