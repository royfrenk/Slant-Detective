import React from 'react'

const FEATURE_BULLETS = [
  'Per-article tilt direction (← / →)',
  'Four-dimension rubric breakdown',
  'Evidence spans with one-line reasons',
  'Inline highlights on the page',
]

const PRIVACY_NOTE =
  'Your key stays in this browser. Calls go straight to the provider you choose. We never see it, the article, or your reading habits.'

export default function FeatureBlurb(): React.JSX.Element {
  return (
    <div className="mt-6">
      <p className="m-0 text-[0.875rem] font-semibold text-on-surface">
        Paste your key to unlock:
      </p>
      <ul className="mt-2 mb-0 pl-5 list-disc">
        {FEATURE_BULLETS.map((bullet) => (
          <li key={bullet} className="text-[0.875rem] text-on-surface">
            {bullet}
          </li>
        ))}
      </ul>
      <p className="mt-4 mb-0 text-[0.75rem] text-on-surface-variant">
        {PRIVACY_NOTE}
      </p>
    </div>
  )
}
