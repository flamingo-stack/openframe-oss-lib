'use client';

import type React from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { Button } from './button';
import { useLoadingScope } from './loading-scope';
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
  /** Rows drawn while the items are read (a page's loading state, where `items` is empty). */
  skeletonCount?: number;
}

/** Rows a loading list draws when its caller names no count. */
export const FEATURE_LIST_SKELETON_COUNT = 3;

/** The list's frames, read by the list and by its skeleton. */
const NUMBERED_LIST_CLASS = 'flex flex-col gap-[var(--spacing-system-lf)]';
const BOXED_LIST_CLASS = 'flex flex-col overflow-hidden rounded-[6px] border border-ods-border bg-ods-bg';
const BOXED_ROW_CLASS = 'flex w-full items-start gap-4 bg-ods-card p-4';
const BOXED_ROW_DIVIDER_CLASS = 'border-b border-ods-border';
const ICON_BOX_CLASS = 'flex shrink-0 items-center justify-center rounded-[6px] border border-ods-border bg-ods-bg';
const BOXED_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col gap-1';

export function FeatureList({
  items,
  className = '',
  iconBoxSize = 72,
  variant = 'boxed',
  activeIndex,
  accent,
  onSelect,
  skeletonCount = FEATURE_LIST_SKELETON_COUNT,
}: FeatureListProps) {
  // Items given in a loading scope are the page's own copy; none means they are read.
  const inScope = useLoadingScope();
  if (inScope && items.length === 0) {
    return (
      <FeatureListSkeleton count={skeletonCount} variant={variant} iconBoxSize={iconBoxSize} className={className} />
    );
  }
  if (variant === 'numbered') {
    const dims = typeof activeIndex === 'number';
    return (
      <ol className={`${NUMBERED_LIST_CLASS} ${className}`}>
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
    <div className={`${BOXED_LIST_CLASS} ${className}`}>
      {items.map((item, index) => (
        <div key={index} className={`${BOXED_ROW_CLASS} ${index < items.length - 1 ? BOXED_ROW_DIVIDER_CLASS : ''}`}>
          <div className={ICON_BOX_CLASS} style={{ width: iconBoxSize, height: iconBoxSize }}>
            {item.icon}
          </div>
          <div className={BOXED_TEXT_CLASS}>
            <p className="text-ods-text-primary text-h3">{item.title}</p>
            <p className="normal-case tracking-normal text-ods-text-secondary text-h6">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A FeatureList while its items are read: the same list, `count` rows. A numbered row keeps its number; a boxed
 * row's icon is a box of the icon's frame; every title and description is a bar of its own line height.
 */
function FeatureListSkeleton({
  count = FEATURE_LIST_SKELETON_COUNT,
  variant = 'boxed',
  iconBoxSize = 72,
  className = '',
}: {
  count?: number;
  variant?: FeatureListProps['variant'];
  iconBoxSize?: number;
  className?: string;
}) {
  const rows = Array.from({ length: count }, (_, index) => index);
  if (variant === 'numbered') {
    return (
      <ol className={`${NUMBERED_LIST_CLASS} ${className}`} aria-hidden>
        {rows.map(index => (
          <li key={index}>
            <NumberedStep loading number={index + 1} title="" />
          </li>
        ))}
      </ol>
    );
  }
  return (
    <div className={`${BOXED_LIST_CLASS} ${className}`} aria-hidden>
      {rows.map(index => (
        <div key={index} className={cn(BOXED_ROW_CLASS, index < count - 1 && BOXED_ROW_DIVIDER_CLASS)}>
          <UnifiedSkeleton className="shrink-0 rounded-[6px]" width={iconBoxSize} height={iconBoxSize} />
          <div className={BOXED_TEXT_CLASS}>
            <TextLineSkeleton type="h3" className="w-1/2" />
            <TextLineSkeleton type="h6" className="w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
