import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RubricSpan } from '../../../shared/types';
import EvidenceRow from '../evidence-row';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSpan: RubricSpan = {
  id: 'span-1',
  text: 'radical agenda',
  offset_start: 10,
  offset_end: 24,
  category: 'loaded_language',
  severity: 'high',
  tilt: 'right',
  reason: 'Emotionally loaded language.',
  dimension: 'word_choice',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EvidenceRow', () => {
  let onSyncClickMock: (spanId: string) => void;
  let onTooltipToggleMock: (id: string | null) => void;

  beforeEach(() => {
    onSyncClickMock = vi.fn() as (spanId: string) => void;
    onTooltipToggleMock = vi.fn() as (id: string | null) => void;
  });

  function renderRow(overrides: Partial<{
    isActive: boolean;
    isPulsing: boolean;
    isTooltipOpen: boolean;
  }> = {}) {
    return render(
      <EvidenceRow
        item={mockSpan}
        isActive={overrides.isActive ?? false}
        isPulsing={overrides.isPulsing ?? false}
        isTooltipOpen={overrides.isTooltipOpen ?? false}
        onTooltipToggle={onTooltipToggleMock}
        onSyncClick={onSyncClickMock}
      />,
    );
  }

  it('renders data-highlight-id attribute matching span id', () => {
    const { container } = renderRow();
    const row = container.firstElementChild as HTMLElement;
    expect(row.getAttribute('data-highlight-id')).toBe('span-1');
  });

  it('renders the evidence text inside EvidenceItem', () => {
    renderRow();
    expect(screen.getByText(/radical agenda/i)).toBeInTheDocument();
  });

  it('applies is-active class when isActive is true', () => {
    const { container } = renderRow({ isActive: true });
    const row = container.firstElementChild as HTMLElement;
    expect(row.classList.contains('is-active')).toBe(true);
  });

  it('does not apply is-active class when isActive is false', () => {
    const { container } = renderRow({ isActive: false });
    const row = container.firstElementChild as HTMLElement;
    expect(row.classList.contains('is-active')).toBe(false);
  });

  it('applies is-pulsing class when isPulsing is true', () => {
    const { container } = renderRow({ isPulsing: true });
    const row = container.firstElementChild as HTMLElement;
    expect(row.classList.contains('is-pulsing')).toBe(true);
  });

  it('does not apply is-pulsing class when isPulsing is false', () => {
    const { container } = renderRow({ isPulsing: false });
    const row = container.firstElementChild as HTMLElement;
    expect(row.classList.contains('is-pulsing')).toBe(false);
  });

  it('calls onSyncClick with correct spanId on click', async () => {
    const user = userEvent.setup();
    const { container } = renderRow();
    const row = container.firstElementChild as HTMLElement;

    await user.click(row);

    expect(onSyncClickMock).toHaveBeenCalledWith('span-1');
  });

  it('calls onSyncClick on Enter key', async () => {
    const user = userEvent.setup();
    const { container } = renderRow();
    const row = container.firstElementChild as HTMLElement;

    row.focus();
    await user.keyboard('{Enter}');

    expect(onSyncClickMock).toHaveBeenCalledWith('span-1');
  });

  it('calls onSyncClick on Space key', async () => {
    const user = userEvent.setup();
    const { container } = renderRow();
    const row = container.firstElementChild as HTMLElement;

    row.focus();
    await user.keyboard(' ');

    expect(onSyncClickMock).toHaveBeenCalledWith('span-1');
  });

  it('calls scrollIntoView when isActive becomes true', () => {
    const scrollMock = vi.fn() as typeof Element.prototype.scrollIntoView;
    // Install scrollIntoView before render via Element.prototype.
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollMock;

    const { rerender } = render(
      <EvidenceRow
        item={mockSpan}
        isActive={false}
        isPulsing={false}
        isTooltipOpen={false}
        onTooltipToggle={onTooltipToggleMock}
        onSyncClick={onSyncClickMock}
      />,
    );
    expect(scrollMock).not.toHaveBeenCalled();

    rerender(
      <EvidenceRow
        item={mockSpan}
        isActive={true}
        isPulsing={false}
        isTooltipOpen={false}
        onTooltipToggle={onTooltipToggleMock}
        onSyncClick={onSyncClickMock}
      />,
    );

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });

    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('calls scrollIntoView when isPulsing becomes true', () => {
    const scrollMock = vi.fn() as typeof Element.prototype.scrollIntoView;
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollMock;

    const { rerender } = render(
      <EvidenceRow
        item={mockSpan}
        isActive={false}
        isPulsing={false}
        isTooltipOpen={false}
        onTooltipToggle={onTooltipToggleMock}
        onSyncClick={onSyncClickMock}
      />,
    );

    rerender(
      <EvidenceRow
        item={mockSpan}
        isActive={false}
        isPulsing={true}
        isTooltipOpen={false}
        onTooltipToggle={onTooltipToggleMock}
        onSyncClick={onSyncClickMock}
      />,
    );

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });

    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('does not apply any sync class when both isActive and isPulsing are false', () => {
    const { container } = renderRow({ isActive: false, isPulsing: false });
    const row = container.firstElementChild as HTMLElement;
    // className should be empty or undefined (no sync class).
    expect(row.className).toBeFalsy();
  });
});
