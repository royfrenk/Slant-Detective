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
    </div>
  )
}
