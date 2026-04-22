import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PrivacyPage } from '../privacy-page';

// Suppress createRoot side-effect
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PrivacyPage — Section 1 copy (SD-036)', () => {
  it('reads "Your API key is stored" (not "Your Anthropic API key")', () => {
    render(<PrivacyPage />);
    // Section 1 first paragraph must not name Anthropic in the key storage sentence
    expect(screen.queryByText(/Your Anthropic API key is stored/)).not.toBeInTheDocument();
    expect(screen.getByText(/Your API key is stored/)).toBeInTheDocument();
  });
});

describe('PrivacyPage — Section 2 heading (SD-036)', () => {
  it('Section 2 heading reads "What Goes Directly to Your Provider"', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByRole('heading', { name: /What Goes Directly to Your Provider/i })
    ).toBeInTheDocument();
  });

  it('Section 2 heading does NOT read "What Goes Directly to Anthropic"', () => {
    render(<PrivacyPage />);
    expect(
      screen.queryByRole('heading', { name: /What Goes Directly to Anthropic/i })
    ).not.toBeInTheDocument();
  });

  it('Section 2 heading element has id="to-provider-heading"', () => {
    render(<PrivacyPage />);
    expect(document.getElementById('to-provider-heading')).toBeInTheDocument();
    expect(document.getElementById('to-provider-heading')?.textContent).toContain(
      'What Goes Directly to Your Provider'
    );
  });

  it('aria-labelledby is updated to "to-provider-heading" (not "to-anthropic-heading")', () => {
    render(<PrivacyPage />);
    expect(document.querySelector('[aria-labelledby="to-provider-heading"]')).toBeInTheDocument();
    expect(document.querySelector('[aria-labelledby="to-anthropic-heading"]')).not.toBeInTheDocument();
  });
});

describe('PrivacyPage — Section 2 new copy (SD-036)', () => {
  it('contains the new key-goes-directly sentence', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText('Your key goes directly to the chosen provider. We never see it.')
    ).toBeInTheDocument();
  });

  it('contains the provider-neutral policy sentence', () => {
    render(<PrivacyPage />);
    expect(
      screen.getByText("Each provider's own privacy policy governs data sent through their API.")
    ).toBeInTheDocument();
  });

  it('contains the multi-provider API endpoint list', () => {
    render(<PrivacyPage />);
    // The paragraph mentions all three provider API domains
    const page = document.body.textContent ?? '';
    expect(page).toContain('api.anthropic.com');
    expect(page).toContain('api.openai.com');
    expect(page).toContain('generativelanguage.googleapis.com');
  });
});

describe('PrivacyPage — Section 2 Anthropic-specific link removed (SD-036)', () => {
  it('does NOT contain a link to anthropic.com/privacy in Section 2', () => {
    render(<PrivacyPage />);
    const section2 = document.querySelector('[aria-labelledby="to-provider-heading"]');
    expect(section2).toBeInTheDocument();
    const anthropicLink = section2?.querySelector('a[href="https://www.anthropic.com/privacy"]');
    expect(anthropicLink).not.toBeInTheDocument();
  });

  it('does NOT contain any link to anthropic.com/privacy anywhere on the page', () => {
    render(<PrivacyPage />);
    const link = document.querySelector('a[href="https://www.anthropic.com/privacy"]');
    expect(link).not.toBeInTheDocument();
  });
});
