import React from 'react'

export default function HowToGetAKeyLink(): React.JSX.Element {
  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    e.preventDefault()
    // Non-critical: if the tab can't open (permissions revoked, missing page), silently degrade — advisory link only.
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/how-to-get-a-key.html') }).catch(() => {})
  }

  return (
    <a
      href={chrome.runtime.getURL('src/pages/how-to-get-a-key.html')}
      onClick={handleClick}
      className="text-[0.75rem] text-on-surface-variant no-underline hover:underline"
    >
      How to get a key →
    </a>
  )
}
