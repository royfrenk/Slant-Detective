import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ModelCard from '../model-card'

describe('ModelCard (SD-032)', () => {
  it('renders model name and descriptor', () => {
    render(
      <ModelCard
        modelId="claude-haiku-4-5"
        label="Haiku 4.5"
        descriptor="Faster, cheaper — recommended"
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText('Haiku 4.5')).toBeInTheDocument()
    expect(screen.getByText('Faster, cheaper — recommended')).toBeInTheDocument()
  })

  it('has role="radio" and aria-checked="true" when selected', () => {
    render(
      <ModelCard
        modelId="haiku"
        label="Haiku 4.5"
        descriptor="Fast"
        selected={true}
        onSelect={vi.fn()}
      />,
    )
    const card = screen.getByRole('radio', { name: /Haiku 4\.5/i })
    expect(card).toHaveAttribute('aria-checked', 'true')
  })

  it('has role="radio" and aria-checked="false" when not selected', () => {
    render(
      <ModelCard
        modelId="sonnet"
        label="Sonnet 4.6"
        descriptor="Quality"
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    const card = screen.getByRole('radio', { name: /Sonnet 4\.6/i })
    expect(card).toHaveAttribute('aria-checked', 'false')
  })

  it('shows filled disc indicator when selected', () => {
    render(
      <ModelCard
        modelId="haiku"
        label="Haiku 4.5"
        descriptor="Fast"
        selected={true}
        onSelect={vi.fn()}
      />,
    )
    const disc = screen.getByTestId('model-disc-haiku')
    expect(disc.className).toContain('bg-primary')
  })

  it('shows empty circle indicator when not selected', () => {
    render(
      <ModelCard
        modelId="sonnet"
        label="Sonnet 4.6"
        descriptor="Quality"
        selected={false}
        onSelect={vi.fn()}
      />,
    )
    const disc = screen.getByTestId('model-disc-sonnet')
    expect(disc.className).toContain('border-outline')
    expect(disc.className).not.toContain('bg-primary')
  })

  it('fires onSelect callback when clicked', () => {
    const onSelect = vi.fn()
    render(
      <ModelCard
        modelId="haiku"
        label="Haiku 4.5"
        descriptor="Fast"
        selected={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('radio'))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('fires onSelect when Space key is pressed', () => {
    const onSelect = vi.fn()
    render(
      <ModelCard
        modelId="haiku"
        label="Haiku 4.5"
        descriptor="Fast"
        selected={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(screen.getByRole('radio'), { key: ' ' })
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it('fires onSelect when Enter key is pressed', () => {
    const onSelect = vi.fn()
    render(
      <ModelCard
        modelId="haiku"
        label="Haiku 4.5"
        descriptor="Fast"
        selected={false}
        onSelect={onSelect}
      />,
    )
    fireEvent.keyDown(screen.getByRole('radio'), { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledOnce()
  })
})
