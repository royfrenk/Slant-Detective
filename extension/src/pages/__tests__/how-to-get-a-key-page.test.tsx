import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HowToGetAKeyPage } from '../how-to-get-a-key-page';

// Suppress createRoot side-effect (module-level mount) to avoid JSDOM errors
vi.mock('react-dom/client', () => ({
  createRoot: vi.fn(() => ({ render: vi.fn() })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HowToGetAKeyPage — page title', () => {
  it('renders the page h1', () => {
    render(<HowToGetAKeyPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'How to Get a Key' })).toBeInTheDocument();
  });
});

describe('HowToGetAKeyPage — provider nav strip', () => {
  it('contains three provider anchor links', () => {
    render(<HowToGetAKeyPage />);
    const nav = screen.getByRole('navigation', { name: 'Provider sections' });
    expect(nav).toBeInTheDocument();
    expect(nav.querySelector('a[href="#anthropic"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="#openai"]')).toBeInTheDocument();
    expect(nav.querySelector('a[href="#gemini"]')).toBeInTheDocument();
  });

  it('nav links have the correct text', () => {
    render(<HowToGetAKeyPage />);
    const nav = screen.getByRole('navigation', { name: 'Provider sections' });
    expect(nav.textContent).toContain('Anthropic');
    expect(nav.textContent).toContain('OpenAI');
    expect(nav.textContent).toContain('Gemini');
  });
});

describe('HowToGetAKeyPage — anchor IDs', () => {
  it('Anthropic section has id="anthropic"', () => {
    render(<HowToGetAKeyPage />);
    expect(document.getElementById('anthropic')).toBeInTheDocument();
  });

  it('OpenAI section has id="openai"', () => {
    render(<HowToGetAKeyPage />);
    expect(document.getElementById('openai')).toBeInTheDocument();
  });

  it('Gemini section has id="gemini"', () => {
    render(<HowToGetAKeyPage />);
    expect(document.getElementById('gemini')).toBeInTheDocument();
  });
});

describe('HowToGetAKeyPage — section headings', () => {
  it('Anthropic heading is present', () => {
    render(<HowToGetAKeyPage />);
    expect(document.getElementById('anthropic-heading')).toBeInTheDocument();
    expect(document.getElementById('anthropic-heading')?.textContent).toBe('Anthropic');
  });

  it('OpenAI heading is present', () => {
    render(<HowToGetAKeyPage />);
    expect(document.getElementById('openai-heading')).toBeInTheDocument();
    expect(document.getElementById('openai-heading')?.textContent).toBe('OpenAI');
  });

  it('Gemini heading is present', () => {
    render(<HowToGetAKeyPage />);
    expect(document.getElementById('gemini-heading')).toBeInTheDocument();
    expect(document.getElementById('gemini-heading')?.textContent).toBe('Gemini');
  });
});

describe('HowToGetAKeyPage — step 1 console links', () => {
  it('Anthropic step 1 links to the canonical platform.claude.com URL', () => {
    render(<HowToGetAKeyPage />);
    const anthropicSection = document.getElementById('anthropic');
    expect(anthropicSection).toBeInTheDocument();
    const link = anthropicSection?.querySelector(
      'a[href="https://platform.claude.com/settings/workspaces/default/keys"]'
    );
    expect(link).toBeInTheDocument();
  });

  it('OpenAI step 1 links to platform.openai.com/api-keys', () => {
    render(<HowToGetAKeyPage />);
    const openaiSection = document.getElementById('openai');
    expect(openaiSection).toBeInTheDocument();
    const link = openaiSection?.querySelector(
      'a[href="https://platform.openai.com/api-keys"]'
    );
    expect(link).toBeInTheDocument();
  });

  it('Gemini step 1 links to aistudio.google.com/api-keys', () => {
    render(<HowToGetAKeyPage />);
    const geminiSection = document.getElementById('gemini');
    expect(geminiSection).toBeInTheDocument();
    const link = geminiSection?.querySelector(
      'a[href="https://aistudio.google.com/api-keys"]'
    );
    expect(link).toBeInTheDocument();
  });
});

describe('HowToGetAKeyPage — external link security attributes', () => {
  it('all external links in Anthropic section open in new tab with noopener', () => {
    render(<HowToGetAKeyPage />);
    const section = document.getElementById('anthropic');
    const links = section?.querySelectorAll('a[href^="https://"]');
    expect(links?.length).toBeGreaterThan(0);
    links?.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  it('all external links in OpenAI section open in new tab with noopener', () => {
    render(<HowToGetAKeyPage />);
    const section = document.getElementById('openai');
    const links = section?.querySelectorAll('a[href^="https://"]');
    expect(links?.length).toBeGreaterThan(0);
    links?.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  it('all external links in Gemini section open in new tab with noopener', () => {
    render(<HowToGetAKeyPage />);
    const section = document.getElementById('gemini');
    const links = section?.querySelectorAll('a[href^="https://"]');
    expect(links?.length).toBeGreaterThan(0);
    links?.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});

describe('HowToGetAKeyPage — cost table placeholders', () => {
  it('all cost cells show "— (pending)" text, not empty cells', () => {
    render(<HowToGetAKeyPage />);
    const pendingCells = screen.getAllByText('— (pending)');
    // 3 Anthropic + 4 OpenAI + 4 Gemini = 11 pending cells
    expect(pendingCells.length).toBe(11);
  });
});

describe('HowToGetAKeyPage — privacy "Learn more" links', () => {
  it('clicking "Learn more →" in Anthropic section calls chrome.tabs.create', async () => {
    const user = userEvent.setup();
    render(<HowToGetAKeyPage />);
    const learnMoreLinks = screen.getAllByRole('link', { name: 'Learn more about privacy' });
    expect(learnMoreLinks.length).toBeGreaterThanOrEqual(1);
    await user.click(learnMoreLinks[0]);
    expect(chrome.tabs.create).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('privacy.html') })
    );
  });

  it('renders three "Learn more →" links (one per provider section)', () => {
    render(<HowToGetAKeyPage />);
    const learnMoreLinks = screen.getAllByRole('link', { name: 'Learn more about privacy' });
    expect(learnMoreLinks.length).toBe(3);
  });
});

describe('HowToGetAKeyPage — no old Anthropic console URL', () => {
  it('does not contain the old console.anthropic.com URL', () => {
    render(<HowToGetAKeyPage />);
    const oldLinks = document.querySelectorAll('a[href="https://console.anthropic.com"]');
    expect(oldLinks.length).toBe(0);
  });
});
