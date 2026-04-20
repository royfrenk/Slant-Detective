import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ProviderTabGroup, { type ProviderTab } from '../provider-tab-group'

const TABS: ProviderTab[] = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'gemini', label: 'Gemini' },
]

describe('ProviderTabGroup (SD-032)', () => {
  it('renders three tabs: Anthropic, OpenAI, Gemini', () => {
    render(
      <ProviderTabGroup tabs={TABS} activeId="anthropic" onTabChange={vi.fn()} />,
    )
    expect(screen.getByRole('tab', { name: 'Anthropic' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'OpenAI' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Gemini' })).toBeInTheDocument()
  })

  it('active tab has aria-selected="true"', () => {
    render(
      <ProviderTabGroup tabs={TABS} activeId="openai" onTabChange={vi.fn()} />,
    )
    expect(screen.getByRole('tab', { name: 'OpenAI' })).toHaveAttribute('aria-selected', 'true')
  })

  it('inactive tabs have aria-selected="false"', () => {
    render(
      <ProviderTabGroup tabs={TABS} activeId="anthropic" onTabChange={vi.fn()} />,
    )
    expect(screen.getByRole('tab', { name: 'OpenAI' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Gemini' })).toHaveAttribute('aria-selected', 'false')
  })

  it('active tab has tabIndex=0; inactive tabs have tabIndex=-1', () => {
    render(
      <ProviderTabGroup tabs={TABS} activeId="anthropic" onTabChange={vi.fn()} />,
    )
    expect(screen.getByRole('tab', { name: 'Anthropic' })).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'OpenAI' })).toHaveAttribute('tabindex', '-1')
    expect(screen.getByRole('tab', { name: 'Gemini' })).toHaveAttribute('tabindex', '-1')
  })

  it('clicking an inactive tab fires onTabChange with the correct id', () => {
    const onTabChange = vi.fn()
    render(
      <ProviderTabGroup tabs={TABS} activeId="anthropic" onTabChange={onTabChange} />,
    )
    fireEvent.click(screen.getByRole('tab', { name: 'OpenAI' }))
    expect(onTabChange).toHaveBeenCalledWith('openai')
  })

  it('ArrowRight moves focus to next tab and fires onTabChange', () => {
    const onTabChange = vi.fn()
    render(
      <ProviderTabGroup tabs={TABS} activeId="anthropic" onTabChange={onTabChange} />,
    )
    const anthropicTab = screen.getByRole('tab', { name: 'Anthropic' })
    fireEvent.keyDown(anthropicTab, { key: 'ArrowRight' })
    expect(onTabChange).toHaveBeenCalledWith('openai')
  })

  it('ArrowLeft wraps from first to last tab', () => {
    const onTabChange = vi.fn()
    render(
      <ProviderTabGroup tabs={TABS} activeId="anthropic" onTabChange={onTabChange} />,
    )
    const anthropicTab = screen.getByRole('tab', { name: 'Anthropic' })
    fireEvent.keyDown(anthropicTab, { key: 'ArrowLeft' })
    expect(onTabChange).toHaveBeenCalledWith('gemini')
  })

  it('renders tablist with aria-label="AI provider"', () => {
    render(
      <ProviderTabGroup tabs={TABS} activeId="anthropic" onTabChange={vi.fn()} />,
    )
    expect(screen.getByRole('tablist', { name: 'AI provider' })).toBeInTheDocument()
  })
})
