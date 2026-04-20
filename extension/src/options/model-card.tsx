import React from 'react'

interface ModelCardProps {
  modelId: string
  label: string
  descriptor: string
  selected: boolean
  onSelect: () => void
}

export default function ModelCard({
  modelId,
  label,
  descriptor,
  selected,
  onSelect,
}: ModelCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${label}: ${descriptor}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={[
        'flex-1 rounded-md p-3 text-left',
        'bg-surface-variant',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
        'cursor-pointer',
        !selected ? 'hover:bg-[#e5e7eb]' : '',
        'transition-colors duration-150 ease-out',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[0.875rem] font-semibold text-on-surface leading-snug">
            {label}
          </p>
          <p className="m-0 mt-1 text-[0.75rem] text-on-surface-variant leading-snug">
            {descriptor}
          </p>
        </div>
        <span
          aria-hidden="true"
          className={[
            'flex-shrink-0 mt-[1px] w-4 h-4 rounded-full border-2',
            selected
              ? 'bg-primary border-primary'
              : 'bg-transparent border-outline',
          ].join(' ')}
          data-testid={`model-disc-${modelId}`}
        >
          {selected && (
            <span className="flex items-center justify-center w-full h-full">
              <span className="w-[6px] h-[6px] rounded-full bg-on-primary" />
            </span>
          )}
        </span>
      </div>
    </button>
  )
}
