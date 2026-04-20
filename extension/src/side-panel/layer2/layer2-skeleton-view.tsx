import React, { useState, useEffect } from 'react';

interface ShimmerBlockProps {
  height: string;
}

function ShimmerBlock({ height }: ShimmerBlockProps): React.JSX.Element {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-surface-variant rounded-[10px] w-full ${height}`}
    >
      <div className="absolute inset-0 motion-safe:animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

const PROGRESS_DELAY_MS = 1000;

export default function Layer2SkeletonView(): React.JSX.Element {
  const [showProgress, setShowProgress] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowProgress(true);
    }, PROGRESS_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      role="status"
      aria-label="Analyzing article with full rubric…"
      aria-busy="true"
      data-testid="layer2-skeleton"
      className="flex flex-col gap-2"
    >
      {/* Source strip placeholder */}
      <ShimmerBlock height="h-[48px]" />
      {/* Overall score card placeholder */}
      <ShimmerBlock height="h-[96px]" />
      {/* Dimension breakdown placeholder */}
      <ShimmerBlock height="h-[128px]" />
      {/* Evidence item placeholders */}
      <ShimmerBlock height="h-[52px]" />
      <ShimmerBlock height="h-[52px]" />
      <ShimmerBlock height="h-[52px]" />
      {showProgress && (
        <p className="text-[0.625rem] text-on-surface-variant text-center mt-2">
          Analyzing with Claude…
        </p>
      )}
    </div>
  );
}
