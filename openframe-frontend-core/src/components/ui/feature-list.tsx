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
   * `numbered`: an ordered list of open rows separated by hairlines, each led
   * by its two-digit number (process steps).
   */
  variant?: 'boxed' | 'numbered';
}

export function FeatureList({ items, className = '', iconBoxSize = 72, variant = 'boxed' }: FeatureListProps) {
  if (variant === 'numbered') {
    return (
      <ol className={`flex flex-col ${className}`}>
        {items.map((item, index) => (
          <li
            key={index}
            className="grid grid-cols-[48px_minmax(0,1fr)] gap-[var(--spacing-system-m)] border-t border-ods-border py-[var(--spacing-system-l)] last:border-b"
          >
            <span className="text-ods-flamingo-pink text-h5">{String(index + 1).padStart(2, '0')}</span>
            <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
              <h3 className="text-ods-text-primary text-h3">{item.title}</h3>
              <p className="text-ods-text-secondary text-h4">{item.description}</p>
            </div>
          </li>
        ))}
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
