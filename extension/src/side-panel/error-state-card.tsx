import React from 'react';

interface CtaConfig {
  label: string;
  variant: 'primary' | 'secondary';
  onClick: () => void;
  ariaLabel: string;
}

interface ErrorStateCardProps {
  accentColor: 'tertiary' | 'outline';
  glyph: string;
  glyphColorClass: string;
  title: string;
  body: React.ReactNode;
  cta?: CtaConfig;
  role?: 'alert' | 'region';
  ariaLabel: string;
  ariaLive?: 'assertive' | 'polite';
}

const ACCENT_BORDER_CLASS: Record<'tertiary' | 'outline', string> = {
  tertiary: 'border-tertiary',
  outline: 'border-outline',
};

const SHARED_BUTTON_CLASSES =
  'h-8 px-3 rounded-[6px] text-[0.75rem] font-semibold border-0 cursor-pointer mt-3 ' +
  'focus:outline-[2px] focus:outline-primary focus:outline-offset-2';

const PRIMARY_BUTTON_CLASSES =
  'bg-gradient-to-br from-primary to-primary-container text-on-primary ' +
  'hover:brightness-[0.96] active:brightness-[0.92]';

const SECONDARY_BUTTON_CLASSES =
  'bg-surface-variant hover:bg-[#e5e7eb] active:bg-[#d1d5db] text-on-surface';

export default function ErrorStateCard({
  accentColor,
  glyph,
  glyphColorClass,
  title,
  body,
  cta,
  role = 'alert',
  ariaLabel,
  ariaLive,
}: ErrorStateCardProps): React.JSX.Element {
  const resolvedAriaLive = ariaLive ?? (role === 'region' ? 'polite' : 'assertive');
  const accentBorderClass = ACCENT_BORDER_CLASS[accentColor];

  return (
    <article
      role={role}
      aria-label={ariaLabel}
      aria-live={resolvedAriaLive}
      className={`bg-surface rounded-[10px] shadow-ambient p-4 border-l-4 ${accentBorderClass} overflow-hidden`}
    >
      <div className="flex items-center gap-[8px]">
        <span aria-hidden="true" className={`text-[1rem] ${glyphColorClass}`}>
          {glyph}
        </span>
        <h2 className="text-[0.875rem] font-semibold text-primary leading-[1.4]">{title}</h2>
      </div>
      <p className="text-[0.75rem] text-on-surface-variant leading-[1.5] mt-[6px]">{body}</p>
      {cta != null && (
        <button
          type="button"
          aria-label={cta.ariaLabel}
          onClick={cta.onClick}
          className={`${SHARED_BUTTON_CLASSES} ${
            cta.variant === 'primary' ? PRIMARY_BUTTON_CLASSES : SECONDARY_BUTTON_CLASSES
          }`}
        >
          {cta.label}
        </button>
      )}
    </article>
  );
}
