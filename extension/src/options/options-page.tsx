import React from 'react'
import ProviderSettingsCard from './provider-settings-card'
import TelemetryToggle from './telemetry-toggle'
import FeatureBlurb from './feature-blurb'
import PageFooterNav from '../pages/page-footer-nav'

export default function OptionsPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[560px] mx-auto px-4 pt-6 pb-8">
        <p className="text-[0.875rem] font-black uppercase tracking-wordmark text-primary m-0">
          SLANT DETECTIVE
        </p>

        <h1 className="text-[1.5rem] font-bold text-primary text-center mt-8 mb-2">
          Configure Provider
        </h1>
        <p className="text-[0.875rem] text-on-surface-variant text-center mb-6 mt-0">
          Select your AI engine to analyze bias.
        </p>

        <ProviderSettingsCard />

        <div className="mt-6 pt-6">
          <TelemetryToggle />
        </div>

        <FeatureBlurb />

        <PageFooterNav showSourceCode={true} showFeedback={true} showCopyright={true} />
      </div>
    </div>
  )
}
