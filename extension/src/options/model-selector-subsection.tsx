import React from 'react'
import ModelCard from './model-card'

export interface ModelConfig {
  id: string
  label: string
  descriptor: string
}

interface ModelSelectorSubsectionProps {
  models: ModelConfig[]
  selectedModelId: string
  onModelSelect: (modelId: string) => void
}

export default function ModelSelectorSubsection({
  models,
  selectedModelId,
  onModelSelect,
}: ModelSelectorSubsectionProps): React.JSX.Element {
  const compareUrl = chrome.runtime.getURL('src/pages/how-we-measure.html') + '#per-model-accuracy'

  function handleCompareClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    e.preventDefault()
    chrome.tabs.create({ url: compareUrl }).catch(() => {})
  }

  return (
    <div className="mb-4 mt-5">
      <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant mb-[10px]">
        Model
      </p>
      <div
        role="radiogroup"
        aria-label="Model"
        className="flex items-start gap-3"
      >
        {models.map((model) => (
          <ModelCard
            key={model.id}
            modelId={model.id}
            label={model.label}
            descriptor={model.descriptor}
            selected={model.id === selectedModelId}
            onSelect={() => onModelSelect(model.id)}
          />
        ))}
      </div>
      <p className="text-[0.75rem] text-on-surface-variant mt-2 mb-0">
        <a
          href={compareUrl}
          onClick={handleCompareClick}
          className="text-on-surface-variant no-underline hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm"
        >
          See how these models compare →
        </a>
      </p>
    </div>
  )
}
