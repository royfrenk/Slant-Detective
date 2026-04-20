import React from 'react';

interface ArticlePreviewCardProps {
  title: string;
  preview: string;
}

export default function ArticlePreviewCard({ title, preview }: ArticlePreviewCardProps): React.JSX.Element {
  return (
    <div
      role="article"
      aria-label="Extracted article preview"
      className="bg-surface rounded-[10px] shadow-ambient p-4 mx-4"
    >
      <h2 className="font-semibold text-[0.875rem] text-primary mb-2 line-clamp-3">
        {title || <em>Untitled article</em>}
      </h2>
      <p className="text-[0.75rem] text-on-surface-variant mb-3 line-clamp-5">
        {preview || <em>No body text extracted.</em>}
      </p>
    </div>
  );
}
