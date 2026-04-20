import React from 'react';

interface FooterNavProps {
  currentPage?: 'how-we-measure' | 'privacy' | 'credits';
}

export default function FooterNav({ currentPage }: FooterNavProps): React.JSX.Element {
  function openPage(pageName: string): void {
    chrome.tabs.create({ url: chrome.runtime.getURL(`${pageName}.html`) }).catch(() => {});
  }

  function activeLinkClass(page: string): string {
    const isActive = currentPage === page;
    return [
      'text-[0.625rem] text-on-surface-variant no-underline hover:underline cursor-pointer',
      isActive ? 'font-semibold' : 'font-normal',
    ].join(' ');
  }

  const staticLinkClass = 'text-[0.625rem] text-on-surface-variant font-normal';

  return (
    <nav aria-label="Extension pages" className="flex items-center justify-center gap-[6px] pb-6">
      <span className={staticLinkClass}>
        How we measure
      </span>
      <span aria-hidden="true" className="text-[0.625rem] text-on-surface-variant">·</span>
      <span className={staticLinkClass}>
        Privacy
      </span>
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
    </nav>
  );
}
