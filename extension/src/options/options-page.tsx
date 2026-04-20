import React from 'react'
import ApiKeyCard from './api-key-card'
import HowToGetAKeyLink from './how-to-get-a-key-link'
import FooterNav from '../side-panel/footer-nav'

// TODO: confirm GitHub URL once repo is public
const GITHUB_URL = 'https://github.com/slant-detective'

export default function OptionsPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[560px] mx-auto px-4 pt-6 pb-8">
        <p className="text-[0.875rem] font-black uppercase tracking-wordmark text-primary m-0">
          SLANT DETECTIVE
        </p>

        <h1 className="text-[1.5rem] font-bold text-primary mt-8 mb-0">
          Settings
        </h1>

        <ApiKeyCard />

        <div className="mt-6">
          <HowToGetAKeyLink />
        </div>

        <div className="mt-2">
          {/* data-github-url placeholder until repo is public */}
          <a
            href={GITHUB_URL}
            data-github-url={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Slant Detective source code on GitHub (opens in new tab)"
            className="text-[0.625rem] text-on-surface-variant no-underline hover:underline"
          >
            View source on GitHub
          </a>
        </div>

        <div className="mt-6">
          <FooterNav />
        </div>
      </div>
    </div>
  )
}
