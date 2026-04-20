import React from "react";

interface DepRowProps {
  name: string;
  version?: string;
  author?: string;
  license: string;
  homepage: string;
}

export default function DepRow({
  name,
  version,
  author,
  license,
  homepage,
}: DepRowProps): React.JSX.Element {
  const metaText = version ?? author ?? "";
  const linkLabel = version
    ? `${name} on npm (opens in new tab)`
    : `${name} upstream source (opens in new tab)`;

  return (
    <div
      className={[
        "bg-surface rounded-lg px-4 py-3 mb-2",
        "hover:shadow-ambient",
        "focus-within:outline focus-within:outline-2 focus-within:outline-primary",
        "transition-shadow duration-150",
      ].join(" ")}
    >
      {/* Row 1: name + license badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className="font-semibold text-sm text-on-surface flex-1 min-w-0 truncate"
          title={name}
        >
          {name}
        </span>
        <span
          className="shrink-0 text-xs font-medium text-on-surface-variant bg-surface-variant rounded px-1.5 py-0.5"
          aria-label={`License: ${license}`}
        >
          {license}
        </span>
      </div>

      {/* Row 2: version/author + upstream link */}
      <div className="flex items-center gap-2 mt-0.5">
        {metaText && (
          <span className="text-xs text-on-surface-variant">{metaText}</span>
        )}
        <a
          href={homepage}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={linkLabel}
          className={[
            "text-xs text-primary-fixed no-underline",
            "hover:underline",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:rounded-sm",
          ].join(" ")}
        >
          {homepage.replace(/^https?:\/\//, "")}
        </a>
      </div>
    </div>
  );
}
