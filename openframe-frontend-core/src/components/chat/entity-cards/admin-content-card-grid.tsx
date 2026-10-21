'use client';

import type { ComponentType, ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { LoadingFallback } from '../../loading/loading-fallback';
import { LoadingItems, useLoadingScope } from '../../ui/loading-scope';
import { AdminContentCard } from './admin-content-card';

/** THE admin card grid: columns and gap shared by the live grid and its skeleton. */
export const ADMIN_CONTENT_CARD_GRID_CLASS =
  'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[var(--spacing-system-lf)]';
/** One cell of the grid, the same box in both forms: a card stretched to its row's height. */
const GRID_CELL_CLASS = 'h-full';

/**
 * The grid's default card in its loading form: `AdminContentCard` itself, drawn in the reserved rows with its actions
 * row, so the card draws its own skeleton (one switch per component).
 */
function AdminContentCardPlaceholder({ className }: { className?: string }) {
  return <AdminContentCard loading reserveRows title="" actions className={className} />;
}

export interface AdminContentCardGridSkeletonProps {
  /**
   * How many placeholder cards: ONE FULL PAGE, the host's page size (the `pageSize` the grid it stands in for
   * loads). A host that pages its grid passes it; the default `12` is the typical admin page, for a host that
   * states none.
   */
  count?: number;
  /**
   * The card in its loading form (a component that renders the grid's card with `loading`). Default `AdminContentCard`
   * in its own loading form.
   */
  Skeleton?: ComponentType<{ className?: string }>;
  className?: string;
  /** What is loading, read once by a screen reader. Default "Loading". */
  label?: string;
  /** The loading state announces itself (`LoadingFallback`'s status). `false` inside another loading region. Default `true`. */
  region?: boolean;
}

/** Cards a loading grid draws when its host names no page size: a typical page. */
const ADMIN_CONTENT_CARD_GRID_SKELETON_CARDS = 12;

/**
 * The grid's loading state on its own: one page of cards, each in its own loading form (drawn in a loading scope, so
 * a card that switches itself draws its own skeleton), in the grid's columns and cells, each cell marked as a list
 * item like a loaded one. `AdminContentCardGrid` draws exactly this while it loads; a page that has no grid yet (a
 * Suspense fallback) draws it directly.
 */
export function AdminContentCardGridSkeleton({
  count = ADMIN_CONTENT_CARD_GRID_SKELETON_CARDS,
  Skeleton = AdminContentCardPlaceholder,
  className,
  label = 'Loading',
  region = true,
}: AdminContentCardGridSkeletonProps) {
  return (
    <LoadingFallback label={label} status={region} className={cn(ADMIN_CONTENT_CARD_GRID_CLASS, className)}>
      <LoadingItems count={count}>
        {() => (
          <div className={GRID_CELL_CLASS} data-loading-item>
            <Skeleton />
          </div>
        )}
      </LoadingItems>
    </LoadingFallback>
  );
}

export interface AdminContentCardGridProps<T> {
  items: readonly T[];
  /** One page of cards: the loading skeleton count and the reserved slot count. */
  pageSize: number;
  /** The page is still being read (a loading scope does the same): one page of cards in their loading form. */
  loading?: boolean;
  itemKey: (item: T) => string | number;
  renderCard: (item: T) => ReactNode;
  /** Rendered when `items` is empty, floated top-aligned over a full page of reserved slots. */
  empty: ReactNode;
  /**
   * The card in its loading form, used for loading and for the reserved (invisible) slots. Default `AdminContentCard`'s
   * own loading form; a grid of another card (e.g. `HowIWorkCard`) passes that card rendered with `loading`, so the
   * heights match.
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
  loading: loadingProp,
  itemKey,
  renderCard,
  empty,
  Skeleton = AdminContentCardPlaceholder,
  className,
  loadingLabel,
  loadingRegion,
}: AdminContentCardGridProps<T>) {
  const gridClass = cn(ADMIN_CONTENT_CARD_GRID_CLASS, className);
  const loading = useLoadingScope() || loadingProp;

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
        <div key={itemKey(item)} className={GRID_CELL_CLASS} data-loading-item>
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
