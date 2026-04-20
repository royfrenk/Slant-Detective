import React from 'react';

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

export default function Layer1SkeletonView(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Analyzing article…"
      aria-busy="true"
      className="flex flex-col gap-2"
    >
      {/* Source strip placeholder */}
      <ShimmerBlock height="h-[48px]" />
      {/* Intensity bars placeholder */}
      <ShimmerBlock height="h-[88px]" />
      {/* Word list header placeholder */}
      <ShimmerBlock height="h-[40px]" />
      {/* Upsell row placeholder */}
      <ShimmerBlock height="h-[36px]" />
    </div>
  );
}
