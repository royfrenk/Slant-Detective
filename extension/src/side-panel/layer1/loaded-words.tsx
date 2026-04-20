import React, { useState } from 'react';
import type { LoadedWordsResult } from '../../shared/types';

const MAX_VISIBLE_CHIPS = 20;

interface LoadedWordChipProps {
  word: string;
}

function LoadedWordChip({ word }: LoadedWordChipProps): React.JSX.Element {
  return (
    <span className="bg-surface-variant rounded-[4px] py-[3px] px-2 border-l-4 border-tertiary text-[0.625rem] text-on-surface-variant">
      {word}
    </span>
  );
}

interface LoadedWordsProps {
  loadedWords: LoadedWordsResult;
}

export default function LoadedWords({ loadedWords }: LoadedWordsProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(true);

  const { uniqueSurfaces, count } = loadedWords;
  const visibleChips = uniqueSurfaces.slice(0, MAX_VISIBLE_CHIPS);
  const overflowCount = uniqueSurfaces.length > MAX_VISIBLE_CHIPS
    ? uniqueSurfaces.length - MAX_VISIBLE_CHIPS
    : 0;

  function handleToggle(): void {
    setExpanded((prev) => !prev);
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  }

  return (
    <div
      role="region"
      aria-label="Loaded words"
      className="bg-surface rounded-[10px] shadow-ambient p-4"
    >
      {/* Header row — full row is the toggle target */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls="loaded-words-body"
        className="flex items-center justify-between cursor-pointer focus:outline-[2px] focus:outline-primary focus:outline-offset-2"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <span className="text-[0.75rem] font-semibold text-primary">
          Loaded words ({count})
        </span>
        <span aria-hidden="true" className="text-[0.875rem] text-on-surface-variant select-none">
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {/* Collapsible body */}
      <div
        id="loaded-words-body"
        className={[
          'overflow-hidden transition-[max-height] duration-200 ease-in-out motion-reduce:transition-none',
          expanded ? 'max-h-[400px]' : 'max-h-0',
        ].join(' ')}
      >
        <div className="mt-3">
          {count === 0 ? (
            <p className="text-[0.75rem] text-on-surface-variant italic">
              No loaded language detected.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-[6px]">
                {visibleChips.map((word) => (
                  <LoadedWordChip key={word} word={word} />
                ))}
              </div>
              {overflowCount > 0 && (
                <p
                  aria-live="off"
                  className="mt-2 text-[0.625rem] text-on-surface-variant"
                >
                  + {overflowCount} more
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
