'use client';

import type React from 'react';
import { Button } from './button';
import { NumberedStep } from './numbered-step';

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
   * `numbered` only. The step being shown now: its marker and its title take
   * the accent and its description reads at full strength, so the list reads as
   * "you are here" beside a timed demo. Omit for a plain list where every step is equal.
   */
  activeIndex?: number;
  /**
   * `numbered` only. The colour of the step being shown (a CSS colour, such as
   * the hex of the agent whose demo it is). Omitted, it is the platform's accent.
   */
  accent?: string;
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
  accent,
  onSelect,
}: FeatureListProps) {
  if (variant === 'numbered') {
    const dims = typeof activeIndex === 'number';
    return (
      <ol className={`flex flex-col gap-[var(--spacing-system-lf)] ${className}`}>
        {items.map((item, index) => {
          const current = dims && index === activeIndex;
          // Every numbered step on a page is the one `NumberedStep`.
          const step = (
            <NumberedStep
              number={index + 1}
              title={item.title}
              description={item.description}
              current={current}
              accent={accent}
              className={onSelect ? 'w-full' : undefined}
            />
          );
          return (
            <li key={index} aria-current={current ? 'step' : undefined}>
              {onSelect ? (
                // The unified Button with no box of its own (`wrap`): it brings the
                // target, the focus ring and the keyboard semantics; the row is the look.
                <Button
                  variant="transparent"
                  size="wrap"
                  fullWidth
                  onClick={() => onSelect(index)}
                  className="items-start justify-start whitespace-normal text-left hover:bg-transparent active:bg-transparent"
                >
                  {step}
                </Button>
              ) : (
                step
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
