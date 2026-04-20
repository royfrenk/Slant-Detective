import React from 'react';
import sourceBiasData from '../../../public/assets/source-bias-labels.json';

type BiasLabel = 'left' | 'lean-left' | 'left-center' | 'center' | 'right-center' | 'lean-right' | 'right' | 'mixed';

interface BadgeStyle {
  readonly bg: string;
  readonly text: string;
  readonly displayLabel: string;
}

const BADGE_STYLES: Record<BiasLabel | 'unknown', BadgeStyle> = {
  left: {
    bg: '#bfdbfe',
    text: '#1e40af',
    displayLabel: 'Left',
  },
  'lean-left': {
    bg: '#dbeafe',
    text: '#1d4ed8',
    displayLabel: 'Lean Left',
  },
  'left-center': {
    bg: '#e0f2fe',
    text: '#0369a1',
    displayLabel: 'Left-Center',
  },
  center: {
    bg: '#f0fdf4',
    text: '#166534',
    displayLabel: 'Center',
  },
  'right-center': {
    bg: '#fef9c3',
    text: '#854d0e',
    displayLabel: 'Right-Center',
  },
  'lean-right': {
    bg: '#fee2e2',
    text: '#991b1b',
    displayLabel: 'Lean Right',
  },
  right: {
    bg: '#fecaca',
    text: '#7f1d1d',
    displayLabel: 'Right',
  },
  mixed: {
    bg: '#f2f4f6',
    text: '#45474c',
    displayLabel: 'Mixed',
  },
  unknown: {
    bg: '#f2f4f6',
    text: '#45474c',
    displayLabel: 'No rating',
  },
};

// Build a lookup map from the bundled JSON — pure, no async, no network.
const domainLabelMap: ReadonlyMap<string, BiasLabel> = new Map(
  (sourceBiasData.domains as Array<{ domain: string; label: string }>).map(
    ({ domain, label }) => [domain, label as BiasLabel],
  ),
);

function lookupBadgeStyle(domain: string): BadgeStyle {
  const label = domainLabelMap.get(domain);
  if (label === undefined) return BADGE_STYLES.unknown;
  return BADGE_STYLES[label] ?? BADGE_STYLES.unknown;
}

interface SourceStripProps {
  domain: string;
}

export default function SourceStrip({ domain }: SourceStripProps): React.JSX.Element {
  const displayDomain = domain.trim() || 'Unknown source';
  const badge = lookupBadgeStyle(domain.trim());

  return (
    <div
      role="region"
      aria-label="Source information"
      className="bg-surface rounded-[10px] shadow-ambient py-3 px-4 flex items-center justify-between"
    >
      <span
        className="font-semibold text-[0.875rem] text-primary truncate max-w-[60%]"
      >
        {displayDomain}
      </span>
      <span
        aria-label={`Source bias: ${badge.displayLabel}`}
        className="rounded-full px-2 py-[3px] font-semibold text-[0.625rem] uppercase tracking-[0.08em] flex-shrink-0"
        style={{ backgroundColor: badge.bg, color: badge.text }}
      >
        {badge.displayLabel}
      </span>
    </div>
  );
}
