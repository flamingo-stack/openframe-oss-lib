'use client';

import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../../utils/cn';

/** THE admin card grid: columns and gap shared by the live grid and its skeleton. */
export const ADMIN_CONTENT_CARD_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-system-lf)]';

/**
 * One `AdminContentCard reserveRows`-shaped placeholder. It mirrors that card box
 * for box (3:2 cover, then a `gap-3 p-5` column: two-line title, subtitle line,
 * two-line summary, 28px badges row, meta line, bordered actions row), each text
 * row sized in its own typography's line height, so a skeleton, a real card and a
 * reserved slot are the same height at every breakpoint. `p-5` has no ODS token
 * (20px); it is the card's own padding and must match it exactly.
 */
export function AdminContentCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full animate-pulse flex-col overflow-hidden rounded-2xl border border-ods-border bg-ods-card',
        className,
      )}
    >
      <div className="aspect-[3/2] w-full shrink-0 bg-ods-border/20" />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-sf)] p-5">
        <div className="h-[2lh] w-full rounded bg-ods-border text-h3" />
        <div className="h-[1lh] w-1/2 rounded bg-ods-border text-h6" />
        <div className="h-[2lh] w-full rounded bg-ods-border text-h6" />
        <div className="flex h-7 items-center gap-[var(--spacing-system-xsf)]">
          <div className="h-5 w-20 rounded-full bg-ods-border" />
          <div className="h-5 w-24 rounded-full bg-ods-border" />
        </div>
        <div className="h-[1lh] w-32 rounded bg-ods-border text-h6" />
        <div className="mt-auto flex items-center justify-between border-t border-ods-border pt-[var(--spacing-system-sf)]">
          <div className="h-10 w-24 rounded bg-ods-border" />
          <div className="flex gap-[var(--spacing-system-xsf)]">
            <div className="h-10 w-20 rounded bg-ods-border" />
            <div className="h-10 w-20 rounded bg-ods-border" />
          </div>
        </div>
      </div>
    </div>
  );
}

export interface AdminContentCardGridProps<T> {
  items: readonly T[];
  /** One page of cards: the loading skeleton count and the reserved slot count. */
  pageSize: number;
  loading: boolean;
  itemKey: (item: T) => string | number;
  renderCard: (item: T) => ReactNode;
  /** Rendered when `items` is empty, floated top-aligned over a full page of reserved slots. */
  empty: ReactNode;
  /**
   * The placeholder card, used for loading and for reserved slots. Default
   * `AdminContentCardSkeleton`; a grid of another card (e.g. `HowIWorkCard`)
   * passes that card's own skeleton so the heights match.
   */
  Skeleton?: ComponentType<{ className?: string }>;
  className?: string;
}

/**
 * A paginated card grid that is ONE height in every state: the card-grid
 * counterpart of the admin `Table`'s `skeletonRows` + `keepHeightWhenEmpty`.
 * `AdminContentCard`s rendered in it pass `reserveRows`, so a full page is the
 * height of the reserved one.
 *
 *  - loading: `pageSize` skeleton cards;
 *  - a short page: the cards, then invisible skeleton-shaped slots up to `pageSize`;
 *  - empty: `empty` floats top-aligned over a full page of invisible slots.
 *
 * Pair it with a pagination control that keeps its space on a single page, so the
 * pagination row holds too.
 */
export function AdminContentCardGrid<T>({
  items,
  pageSize,
  loading,
  itemKey,
  renderCard,
  empty,
  Skeleton = AdminContentCardSkeleton,
  className,
}: AdminContentCardGridProps<T>) {
  const gridClass = cn(ADMIN_CONTENT_CARD_GRID_CLASS, className);

  if (loading) {
    return (
      <div className={gridClass} data-state="loading">
        {Array.from({ length: pageSize }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  const slots = Array.from({ length: Math.max(0, pageSize - items.length) }, (_, i) => (
    <Skeleton key={`slot-${i}`} className="invisible" />
  ));

  if (items.length === 0) {
    return (
      <div className="relative" data-state="empty">
        <div aria-hidden className={gridClass}>
          {slots}
        </div>
        <div className="absolute inset-x-0 top-0">{empty}</div>
      </div>
    );
  }

  return (
    <div className={gridClass} data-state="items">
      {items.map(item => (
        <div key={itemKey(item)} className="h-full">
          {renderCard(item)}
        </div>
      ))}
      {slots.length > 0 && (
        <div aria-hidden className="contents">
          {slots}
        </div>
      )}
    </div>
  );
}
