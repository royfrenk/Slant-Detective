import React, { useRef } from 'react'

export interface ProviderTab {
  id: string
  label: string
  disabled?: boolean
  badge?: {
    text: string
    /** 'recommended' renders in primary color; 'warning' renders in muted/amber */
    variant: 'recommended' | 'warning'
    /** Full tooltip text for title= attribute */
    tooltip?: string
  }
}

interface ProviderTabGroupProps {
  tabs: ProviderTab[]
  activeId: string
  onTabChange: (id: string) => void
}

export default function ProviderTabGroup({
  tabs,
  activeId,
  onTabChange,
}: ProviderTabGroupProps): React.JSX.Element {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    const enabledIndexes = tabs
      .map((t, i) => ({ t, i }))
      .filter(({ t }) => !t.disabled)
      .map(({ i }) => i)

    const currentEnabledPos = enabledIndexes.indexOf(index)

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      const nextPos = (currentEnabledPos + 1) % enabledIndexes.length
      const nextIndex = enabledIndexes[nextPos]
      tabRefs.current[nextIndex]?.focus()
      onTabChange(tabs[nextIndex].id)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      const prevPos = (currentEnabledPos - 1 + enabledIndexes.length) % enabledIndexes.length
      const prevIndex = enabledIndexes[prevPos]
      tabRefs.current[prevIndex]?.focus()
      onTabChange(tabs[prevIndex].id)
    }
  }

  return (
    <div>
      <p className="text-[0.625rem] font-bold uppercase tracking-[0.1em] text-on-surface-variant mb-[10px]">
        Provider
      </p>
      <div
        role="tablist"
        aria-label="AI provider"
        className="flex items-center bg-surface-variant rounded-md"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el }}
              role="tab"
              // aria-label pins the accessible name to just the provider label so that
              // the badge span's text does not alter the computed tab name. Screen readers
              // will still pick up the badge via its own aria-label on the inner span.
              aria-label={tab.label}
              aria-selected={isActive}
              aria-controls="provider-panel"
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              type="button"
              onClick={() => { if (!tab.disabled) onTabChange(tab.id) }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                'flex-1 h-9 rounded-md text-[0.875rem] font-semibold',
                'flex flex-col items-center justify-center gap-0',
                'transition-[background,color] duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0',
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary cursor-default'
                  : tab.disabled
                    ? 'bg-transparent text-on-surface-variant opacity-40 cursor-not-allowed pointer-events-none'
                    : 'bg-transparent text-on-surface-variant cursor-pointer hover:bg-[#e5e7eb] hover:text-on-surface',
              ].join(' ')}
            >
              <span aria-hidden="true">{tab.label}</span>
              {tab.badge && (
                <span
                  aria-label={`${tab.label}: ${tab.badge.text}`}
                  title={tab.badge.tooltip ?? tab.badge.text}
                  className={[
                    'text-[0.5rem] font-bold leading-none px-1 py-px rounded-sm',
                    'pointer-events-none select-none',
                    tab.badge.variant === 'recommended'
                      ? 'text-emerald-700 bg-emerald-100'
                      : 'text-amber-700 bg-amber-100',
                  ].join(' ')}
                >
                  {tab.badge.text}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
