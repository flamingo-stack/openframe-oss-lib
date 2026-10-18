'use client';

import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { LoadingRegion } from '../../loading/loading-region';
import { AdminContentCardSkeleton } from './admin-content-card';

/** THE admin card grid: columns and gap shared by the live grid and its skeleton. */
export const ADMIN_CONTENT_CARD_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-system-lf)]';

/** The card's own skeleton, kept on this module's exports for its callers. */
export { AdminContentCardSkeleton };

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
