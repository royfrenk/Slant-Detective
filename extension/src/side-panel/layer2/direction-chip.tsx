import React from 'react';
import type { RubricDirection } from '../../shared/types';

interface DirectionChipStyle {
  readonly bg: string;
  readonly text: string;
  readonly label: string;
}

const DIRECTION_STYLES: Record<RubricDirection, DirectionChipStyle> = {
  left: { bg: '#dbeafe', text: '#1d4ed8', label: '← Left' },
  'left-center': { bg: '#e0f2fe', text: '#0369a1', label: '← Left-Center' },
  center: { bg: '#f0fdf4', text: '#166534', label: '– Center' },
  'right-center': { bg: '#fef9c3', text: '#854d0e', label: 'Right-Center →' },
  right: { bg: '#fee2e2', text: '#991b1b', label: 'Right →' },
  mixed: { bg: '#f2f4f6', text: '#45474c', label: '~ Mixed' },
};

interface DirectionChipProps {
  direction: RubricDirection;
}

export default function DirectionChip({ direction }: DirectionChipProps): React.JSX.Element {
  const style = DIRECTION_STYLES[direction] ?? DIRECTION_STYLES.mixed;

  return (
    <span
      aria-label={`Lean direction: ${style.label}`}
      className="rounded-full px-2 py-[3px] text-[0.625rem] font-semibold uppercase tracking-[0.08em] whitespace-nowrap flex-shrink-0"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {style.label}
    </span>
  );
}
