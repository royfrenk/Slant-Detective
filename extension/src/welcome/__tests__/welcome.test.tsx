import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Welcome from '../welcome';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Welcome — third bullet provider-neutral copy (SD-036)', () => {
  it('third bullet title is provider-neutral and names all three providers', () => {
    render(<Welcome />);
    const title = screen.getByText('Add an API key later — Anthropic, OpenAI, or Gemini');
    expect(title).toBeInTheDocument();
  });

  it('third bullet title does not contain the old Anthropic-only copy', () => {
    render(<Welcome />);
    expect(
      screen.queryByText('Paste an Anthropic API key later for the full rubric')
    ).not.toBeInTheDocument();
  });

  it('third bullet body is unchanged', () => {
    render(<Welcome />);
    expect(
      screen.getByText(
        'Unlock tilt direction, four-dimension breakdown, evidence spans, and inline highlights.'
      )
    ).toBeInTheDocument();
  });
});

describe('Welcome — page structure', () => {
  it('renders the Try it button', () => {
    render(<Welcome />);
    expect(
      screen.getByRole('button', { name: /Try it/i })
    ).toBeInTheDocument();
  });

  it('renders all three bullet items', () => {
    render(<Welcome />);
    expect(screen.getByText('Per-article bias analysis')).toBeInTheDocument();
    expect(screen.getByText('Works immediately, no setup needed')).toBeInTheDocument();
    expect(screen.getByText('Add an API key later — Anthropic, OpenAI, or Gemini')).toBeInTheDocument();
  });
});
