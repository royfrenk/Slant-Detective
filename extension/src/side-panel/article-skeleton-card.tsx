import React from "react";

function ShimmerBar({ className }: { className: string }): React.JSX.Element {
  return (
    <div aria-hidden="true" className={`relative overflow-hidden bg-surface-variant ${className}`}>
      <div className="absolute inset-0 motion-safe:animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

export default function ArticleSkeletonCard(): React.JSX.Element {
  return (
    <div
      role="status"
      aria-label="Analyzing article…"
      aria-busy="true"
      className="bg-surface rounded-[10px] shadow-ambient p-4 mx-4"
    >
      <ShimmerBar className="h-[14px] w-[65%] rounded-[4px]" />
      <div className="mt-2 flex flex-col gap-2">
        <ShimmerBar className="h-[10px] w-full rounded-[3px]" />
        <ShimmerBar className="h-[10px] w-[70%] rounded-[3px]" />
        <ShimmerBar className="h-[10px] w-[82%] rounded-[3px]" />
      </div>
    </div>
  );
}
