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

describe('PageFooterNav — showCopyright prop (SD-032)', () => {
  it('renders copyright text on left when showCopyright=true', () => {
    render(<PageFooterNav showCopyright={true} />);
    expect(screen.getByText(/© 2026 Slant Detective/)).toBeInTheDocument();
  });

  it('does NOT render copyright text when showCopyright=false (default)', () => {
    render(<PageFooterNav showCopyright={false} />);
    expect(screen.queryByText(/© 2026/)).not.toBeInTheDocument();
  });

  it('does NOT render copyright text when showCopyright is omitted (default)', () => {
    render(<PageFooterNav />);
    expect(screen.queryByText(/© 2026/)).not.toBeInTheDocument();
  });

  it('still renders all nav links when showCopyright=true (variant parity)', () => {
    render(<PageFooterNav showCopyright={true} showFeedback={true} showSourceCode={true} />);
    expect(screen.getByRole('link', { name: /Open How we measure page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Privacy page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Credits page/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open Slant Detective feedback form/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Report a bug/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Source code on GitHub/i })).toBeInTheDocument();
  });

  it('existing layout is unchanged when showCopyright=false (parity — no regression)', () => {
    render(<PageFooterNav showFeedback={true} />);
    expect(screen.getByRole('link', { name: /Open How we measure page/i })).toBeInTheDocument();
    expect(screen.queryByText(/© 2026/)).not.toBeInTheDocument();
  });
});
