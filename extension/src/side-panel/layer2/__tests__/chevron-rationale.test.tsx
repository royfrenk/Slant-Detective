import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ChevronToggle from '../chevron-toggle'
import RationalePanel from '../rationale-panel'

// ─── ChevronToggle ─────────────────────────────────────────────────────────────

describe('ChevronToggle', () => {
  it('renders a button', () => {
    render(
      <ChevronToggle
        isOpen={false}
        onToggle={vi.fn()}
        ariaControls="test-panel"
        ariaLabel="Show rationale for WORD CHOICE"
      />,
    )
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('aria-expanded=false when isOpen=false', () => {
    render(
      <ChevronToggle
        isOpen={false}
        onToggle={vi.fn()}
        ariaControls="test-panel"
        ariaLabel="Show rationale for WORD CHOICE"
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it('aria-expanded=true when isOpen=true', () => {
    render(
      <ChevronToggle
        isOpen={true}
        onToggle={vi.fn()}
        ariaControls="test-panel"
        ariaLabel="Hide rationale for WORD CHOICE"
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
  })

  it('aria-controls set correctly', () => {
    render(
      <ChevronToggle
        isOpen={false}
        onToggle={vi.fn()}
        ariaControls="dim-rationale-word_choice"
        ariaLabel="Show rationale for WORD CHOICE"
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-controls', 'dim-rationale-word_choice')
  })

  it('aria-label set correctly', () => {
    render(
      <ChevronToggle
        isOpen={false}
        onToggle={vi.fn()}
        ariaControls="test-panel"
        ariaLabel="Show rationale for FRAMING"
      />,
    )
    expect(screen.getByRole('button', { name: 'Show rationale for FRAMING' })).toBeInTheDocument()
  })

  it('calls onToggle when clicked', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <ChevronToggle
        isOpen={false}
        onToggle={onToggle}
        ariaControls="test-panel"
        ariaLabel="Show rationale for WORD CHOICE"
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('applies rotate-90 class when isOpen=true', () => {
    render(
      <ChevronToggle
        isOpen={true}
        onToggle={vi.fn()}
        ariaControls="test-panel"
        ariaLabel="Hide rationale"
      />,
    )
    expect(screen.getByRole('button').className).toContain('rotate-90')
  })

  it('applies rotate-0 class when isOpen=false', () => {
    render(
      <ChevronToggle
        isOpen={false}
        onToggle={vi.fn()}
        ariaControls="test-panel"
        ariaLabel="Show rationale"
      />,
    )
    expect(screen.getByRole('button').className).toContain('rotate-0')
  })
})

// ─── RationalePanel ────────────────────────────────────────────────────────────

describe('RationalePanel — non-animated (overall card)', () => {
  it('renders null when text is undefined', () => {
    const { container } = render(<RationalePanel text={undefined} id="test" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when text is empty string', () => {
    const { container } = render(<RationalePanel text="" id="test" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when text is whitespace-only', () => {
    const { container } = render(<RationalePanel text="   " id="test" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders text content', () => {
    render(<RationalePanel text="Word choice drives this score." id="test" />)
    expect(screen.getByText('Word choice drives this score.')).toBeInTheDocument()
  })

  it('has role="region" and aria-label="Score rationale"', () => {
    render(<RationalePanel text="Some rationale." id="test" />)
    expect(screen.getByRole('region', { name: 'Score rationale' })).toBeInTheDocument()
  })

  it('id attribute is set correctly', () => {
    render(<RationalePanel text="Rationale text." id="overall-rationale-panel" />)
    expect(document.getElementById('overall-rationale-panel')).toBeInTheDocument()
  })
})

describe('RationalePanel — animated (dim rows)', () => {
  it('renders text content when isOpen=true', () => {
    render(
      <RationalePanel text="Language skews right." id="dim-rationale-word_choice" animated isOpen />,
    )
    expect(screen.getByText('Language skews right.')).toBeInTheDocument()
  })

  it('has aria-live="polite" on animated panel', () => {
    const { container } = render(
      <RationalePanel text="Rationale." id="dim-rationale-framing" animated isOpen />,
    )
    expect(container.firstChild).toHaveAttribute('aria-live', 'polite')
  })

  it('still renders inner content when isOpen=false (CSS hides it via grid-rows)', () => {
    render(
      <RationalePanel
        text="Language skews right."
        id="dim-rationale-word_choice"
        animated
        isOpen={false}
      />,
    )
    // Text is in DOM (CSS grid collapses it)
    expect(screen.getByText('Language skews right.')).toBeInTheDocument()
  })
})
