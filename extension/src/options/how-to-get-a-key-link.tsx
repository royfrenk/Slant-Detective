import React from 'react'

interface HowToGetAKeyLinkProps {
  provider?: string
}

export default function HowToGetAKeyLink({ provider }: HowToGetAKeyLinkProps = {}): React.JSX.Element {
  const baseUrl = chrome.runtime.getURL('src/pages/how-to-get-a-key.html')
  const url = provider ? `${baseUrl}#${provider}` : baseUrl

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    e.preventDefault()
    // Non-critical: if the tab can't open (permissions revoked, missing page), silently degrade — advisory link only.
    chrome.tabs.create({ url }).catch(() => {})
  }

  return (
    <a
      href={url}
      onClick={handleClick}
      className="text-[0.75rem] text-on-surface-variant no-underline hover:underline"
    >
      How to get a key →
    </a>
  )
}
