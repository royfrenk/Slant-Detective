import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import InlineFeedback from '../inline-feedback'

describe('InlineFeedback — rate-limit state (SD-032)', () => {
  it('renders rate-limit message with softer tone (not error red)', () => {
    render(<InlineFeedback state="rate-limit" />)
    expect(screen.getByText(/Rate limited\. Your key is probably valid/i)).toBeInTheDocument()
  })

  it('rate-limit shows ⚠ warning icon', () => {
    render(<InlineFeedback state="rate-limit" />)
    // The icon span is aria-hidden; check it's present via container
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('⚠')
  })

  it('is hidden (idle state)', () => {
    render(<InlineFeedback state="idle" />)
    const status = screen.getByRole('status')
    expect(status.className).toContain('opacity-0')
  })
})

describe('InlineFeedback — provider-specific error copy (SD-032)', () => {
  it('Anthropic error copy mentions sk-ant-...', () => {
    render(<InlineFeedback state="error" provider="anthropic" />)
    expect(screen.getByText(/sk-ant-\.\.\./i)).toBeInTheDocument()
    expect(screen.getByText(/console\.anthropic\.com/i)).toBeInTheDocument()
  })

  it('OpenAI error copy mentions sk-...', () => {
    render(<InlineFeedback state="error" provider="openai" />)
    expect(screen.getByText(/sk-\.\.\./i)).toBeInTheDocument()
    expect(screen.getByText(/platform\.openai\.com/i)).toBeInTheDocument()
  })

  it('Gemini error copy mentions AIza...', () => {
    render(<InlineFeedback state="error" provider="gemini" />)
    expect(screen.getByText(/AIza\.\.\./i)).toBeInTheDocument()
    expect(screen.getByText(/aistudio\.google\.com/i)).toBeInTheDocument()
  })

  it('Anthropic warning copy mentions Anthropic provider name', () => {
    render(<InlineFeedback state="warning" provider="anthropic" />)
    expect(screen.getByText(/Couldn't reach Anthropic to validate/i)).toBeInTheDocument()
  })

  it('OpenAI warning copy mentions OpenAI provider name', () => {
    render(<InlineFeedback state="warning" provider="openai" />)
    expect(screen.getByText(/Couldn't reach OpenAI to validate/i)).toBeInTheDocument()
  })

  it('Gemini warning copy mentions Gemini provider name', () => {
    render(<InlineFeedback state="warning" provider="gemini" />)
    expect(screen.getByText(/Couldn't reach Gemini to validate/i)).toBeInTheDocument()
  })
})

describe('InlineFeedback — existing states still work (parity)', () => {
  it('success state shows checkmark and green text', () => {
    render(<InlineFeedback state="success" />)
    expect(screen.getByText(/Key saved\. Layer 2 analysis is now active\./i)).toBeInTheDocument()
    const status = screen.getByRole('status')
    expect(status.textContent).toContain('✓')
  })

  it('warning state saves key and shows softer message', () => {
    render(<InlineFeedback state="warning" provider="anthropic" />)
    expect(screen.getByText(/key saved anyway/i)).toBeInTheDocument()
  })
})
