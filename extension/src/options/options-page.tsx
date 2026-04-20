import React from 'react'
import ApiKeyCard from './api-key-card'
import HowToGetAKeyLink from './how-to-get-a-key-link'
import TelemetryToggle from './telemetry-toggle'
import PageFooterNav from '../pages/page-footer-nav'

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
          <TelemetryToggle />
        </div>

        <div className="mt-6">
          <HowToGetAKeyLink />
        </div>

        <PageFooterNav showSourceCode={true} />
      </div>
    </div>
  )
}
