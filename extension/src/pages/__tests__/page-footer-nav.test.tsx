import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PageFooterNav from '../page-footer-nav';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PageFooterNav — Report bug link (SD-038 H.4)', () => {
  it('renders "Report bug" link when showFeedback=true', () => {
    render(<PageFooterNav showFeedback={true} />);
    const link = screen.getByRole('link', { name: 'Report a bug' });
    expect(link).toBeInTheDocument();
    expect(link.textContent).toBe('Report bug');
  });

  it('renders "Report bug" link when showFeedback=false (unconditional)', () => {
    render(<PageFooterNav showFeedback={false} />);
    const link = screen.getByRole('link', { name: 'Report a bug' });
    expect(link).toBeInTheDocument();
    expect(link.textContent).toBe('Report bug');
  });

  it('clicking "Report bug" calls chrome.runtime.sendMessage with { action: "openReportBugModal" }', async () => {
    const user = userEvent.setup();
    render(<PageFooterNav showFeedback={true} />);

    const link = screen.getByRole('link', { name: 'Report a bug' });
    await user.click(link);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'openReportBugModal' });
  });
});
