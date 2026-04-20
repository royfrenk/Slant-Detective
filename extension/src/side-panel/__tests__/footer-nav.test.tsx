import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FooterNav from '../footer-nav';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FooterNav — Report bug link (SD-038 H.3)', () => {
  it('renders a "Report bug" link with aria-label="Report a bug"', () => {
    render(<FooterNav />);
    const link = screen.getByRole('link', { name: 'Report a bug' });
    expect(link).toBeInTheDocument();
    expect(link.textContent).toBe('Report bug');
  });

  it('"Report bug" appears after the Feedback link in DOM order', () => {
    render(<FooterNav />);

    const nav = screen.getByRole('navigation', { name: 'Extension pages' });
    const allLinks = Array.from(nav.querySelectorAll('[role="link"]'));

    const feedbackIdx = allLinks.findIndex(
      (el) => el.getAttribute('aria-label') === 'Open Slant Detective feedback form in new tab',
    );
    const reportBugIdx = allLinks.findIndex(
      (el) => el.getAttribute('aria-label') === 'Report a bug',
    );

    expect(feedbackIdx).toBeGreaterThanOrEqual(0);
    expect(reportBugIdx).toBeGreaterThan(feedbackIdx);
  });

  it('clicking "Report bug" calls chrome.runtime.sendMessage with { action: "openReportBugModal" }', async () => {
    const user = userEvent.setup();
    render(<FooterNav />);

    const link = screen.getByRole('link', { name: 'Report a bug' });
    await user.click(link);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'openReportBugModal' });
  });
});
