import React, { useRef } from 'react'

export interface ProviderTab {
  id: string
  label: string
  disabled?: boolean
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
              aria-selected={isActive}
              aria-controls="provider-panel"
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              type="button"
              onClick={() => { if (!tab.disabled) onTabChange(tab.id) }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                'flex-1 h-9 rounded-md text-[0.875rem] font-semibold',
                'transition-[background,color] duration-150 ease-out',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0',
                isActive
                  ? 'bg-gradient-to-br from-primary to-primary-container text-on-primary cursor-default'
                  : tab.disabled
                    ? 'bg-transparent text-on-surface-variant opacity-40 cursor-not-allowed pointer-events-none'
                    : 'bg-transparent text-on-surface-variant cursor-pointer hover:bg-[#e5e7eb] hover:text-on-surface',
              ].join(' ')}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
