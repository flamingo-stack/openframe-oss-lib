'use client';

import type React from 'react';

export interface FeatureListItemData {
  /** Shown in the boxed slot. Not used by the `numbered` variant. */
  icon?: React.ReactNode;
  title: string;
  description: string;
}

export interface FeatureListProps {
  items: readonly FeatureListItemData[];
  className?: string;
  iconBoxSize?: number;
  /**
   * `boxed` (default): one bordered card, a boxed icon per row.
   * `numbered`: an ordered list of open rows, each led by its number in a
   * round marker (process steps).
   */
  variant?: 'boxed' | 'numbered';
  /**
   * `numbered` only. The step being shown now: it stays at full strength with
   * its marker lit and the others step back, so the list reads as "you are here" beside a timed
   * demo. Omit for a plain list where every step is equal.
   */
  activeIndex?: number;
  /**
   * `numbered` only. Makes every step a button: choosing one reports its index
   * (a demo jumps to that step). Omit for a list that is only read.
   */
  onSelect?: (index: number) => void;
}

export function FeatureList({
  items,
  className = '',
  iconBoxSize = 72,
  variant = 'boxed',
  activeIndex,
  onSelect,
}: FeatureListProps) {
  if (variant === 'numbered') {
    const dims = typeof activeIndex === 'number';
    return (
      <ol className={`flex flex-col gap-[var(--spacing-system-lf)] ${className}`}>
        {items.map((item, index) => {
          const current = dims && index === activeIndex;
          const row = (
            <>
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-colors duration-200 text-h5 motion-reduce:transition-none ${
                  current
                    ? 'border-ods-flamingo-pink bg-ods-flamingo-pink-secondary text-ods-text-primary'
                    : 'border-ods-border text-ods-text-secondary'
                }`}
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
                <h3 className="text-ods-text-primary text-h4">{item.title}</h3>
                <p className="text-ods-text-secondary text-h6">{item.description}</p>
              </div>
            </>
          );
          const layout = 'flex items-start gap-[var(--spacing-system-sf)]';
          return (
            <li
              key={index}
              aria-current={current ? 'step' : undefined}
              className={`transition-opacity duration-200 motion-reduce:transition-none ${
                dims && !current ? 'opacity-55 focus-within:opacity-100 hover:opacity-100' : ''
              }`}
            >
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className={`${layout} w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus`}
                >
                  {row}
                </button>
              ) : (
                <div className={layout}>{row}</div>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <div className={`flex flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-bg ${className}`}>
      {items.map((item, index) => (
        <div
          key={index}
          className={`flex w-full items-start gap-4 bg-ods-card p-4 ${
            index < items.length - 1 ? 'border-b border-ods-border' : ''
          }`}
        >
          <div
            className="flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-bg"
            style={{ width: iconBoxSize, height: iconBoxSize }}
          >
            {item.icon}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-ods-text-primary text-h3">{item.title}</p>
            <p className="normal-case tracking-normal text-ods-text-secondary text-h6">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
