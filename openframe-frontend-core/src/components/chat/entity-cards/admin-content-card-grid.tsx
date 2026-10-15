'use client';

import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { LoadingRegion } from '../../loading/loading-region';
import { UnifiedSkeleton } from '../../loading/unified-skeleton';

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
export function AdminContentCardSkeleton({
  className,
  actions = true,
  subtitleRow = true,
}: {
  className?: string;
  /** Matches the card's `subtitleRow`: off for a card type that has no subtitle line. */
  subtitleRow?: boolean;
  /** The bordered actions row. Off for a card rendered without `actions` (a read-only rail card). */
  actions?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border border-ods-border bg-transparent',
        className,
      )}
    >
      <UnifiedSkeleton className="aspect-[3/2] w-full shrink-0" />
      <div className="flex flex-1 flex-col gap-[var(--spacing-system-sf)] p-5">
        <UnifiedSkeleton className="h-[2lh] w-full rounded text-h3" />
        {subtitleRow && <UnifiedSkeleton className="h-[1lh] w-1/2 rounded text-h6" />}
        <UnifiedSkeleton className="h-[2lh] w-full rounded text-h6" />
        <div className="flex h-7 items-center gap-[var(--spacing-system-xsf)]">
          <UnifiedSkeleton className="h-5 w-20 rounded-full" />
          <UnifiedSkeleton className="h-5 w-24 rounded-full" />
        </div>
        <UnifiedSkeleton className="h-[1lh] w-32 rounded text-h6" />
        {actions && (
          <div className="mt-auto flex items-center justify-between border-t border-ods-border pt-[var(--spacing-system-sf)]">
            <UnifiedSkeleton className="h-10 w-24 rounded" />
            <div className="flex gap-[var(--spacing-system-xsf)]">
              <UnifiedSkeleton className="h-10 w-20 rounded" />
              <UnifiedSkeleton className="h-10 w-20 rounded" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export interface AdminContentCardGridSkeletonProps {
  /** How many placeholder cards: one page. */
  count?: number;
  /** The placeholder card. Default `AdminContentCardSkeleton`. */
  Skeleton?: ComponentType<{ className?: string }>;
  className?: string;
  /** What is loading, read once by a screen reader. Default "Loading". */
  label?: string;
  /** The loading state announces itself (`LoadingRegion`). `false` inside another loading region. Default `true`. */
  region?: boolean;
}

/**
 * The grid's loading state on its own: one page of placeholder cards in the
 * grid's columns. `AdminContentCardGrid` draws exactly this while it loads; a
 * page that has no grid yet (a Suspense fallback) draws it directly.
 */
export function AdminContentCardGridSkeleton({
  count = 12,
  Skeleton = AdminContentCardSkeleton,
  className,
  label = 'Loading',
  region = true,
}: AdminContentCardGridSkeletonProps) {
  return (
    <LoadingRegion
      label={label}
      announce={region}
      className={cn(ADMIN_CONTENT_CARD_GRID_CLASS, className)}
      data-state="loading"
    >
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} />
      ))}
    </LoadingRegion>
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
  /** What is loading, read once by a screen reader while `loading`. Default "Loading". */
  loadingLabel?: string;
  /** The loading state announces itself. `false` inside another loading region. Default `true`. */
  loadingRegion?: boolean;
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
  loadingLabel,
  loadingRegion,
}: AdminContentCardGridProps<T>) {
  const gridClass = cn(ADMIN_CONTENT_CARD_GRID_CLASS, className);

  if (loading)
    return (
      <AdminContentCardGridSkeleton
        count={pageSize}
        Skeleton={Skeleton}
        className={className}
        label={loadingLabel}
        region={loadingRegion}
      />
    );

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
