'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import type { NoDataProps } from '../no-data';
import { useDataTableContext } from './data-table';
import { DataTableEmpty } from './data-table-empty';
import { DataTableRow } from './data-table-row';
import { DataTableSkeleton, ROW_HEIGHT_DESKTOP, ROW_HEIGHT_MOBILE, ROW_SHELL_CLASSES } from './data-table-skeleton';

export interface DataTableBodyProps<T = unknown> {
  /** Show skeleton rows while `loading` is true and data is empty. */
  loading?: boolean;
  /** @deprecated Use `emptyState` instead. Legacy single-line message; mapped to the empty state's title. */
  emptyMessage?: string;
  /** Props for the empty state (NoData) shown when there are no rows. Overrides `emptyMessage`. */
  emptyState?: NoDataProps;
  /** Skeleton row count when loading. Default `10`. */
  skeletonRows?: number;
  className?: string;
  /**
   * Per-row class name. Prefer `useCallback` for function form to avoid
   * breaking `React.memo` on rows.
   */
  rowClassName?: string | ((item: T, index: number) => string);
  /** Dense row height. */
  compact?: boolean;
  /**
   * Treat the design row height as a minimum so multi-line cell content grows
   * the row instead of clipping. Default keeps the fixed height.
   */
  autoHeight?: boolean;
  /**
   * REPLACES the design row height for THIS table's rows, its pad rows and its
   * skeleton alike — one number, so they cannot disagree.
   *
   * Why a prop and not a className: `minRows` promises a stable table height,
   * but its pad rows and the skeleton were hard-coded to the design height
   * while a row passing `autoHeight` renders as tall as its content. A table
   * with 112px rows padded a short page with 78px placeholders and came up
   * 34px per missing row too short — on a 15-row page with 5 results, 340px of
   * jump against every other page. Appending a height through `rowClassName`
   * cannot fix it either: tailwind-merge drops the plain `h-[66px]` but keeps
   * the `md:h-[78px]` beside it, so the override holds on a phone and loses on
   * a desktop. Pass it here and every row slot in the table agrees.
   *
   * Responsive values belong in the string itself, e.g. `'h-[200px] md:h-[112px]'`.
   */
  rowHeightClassName?: string;
  /**
   * Click anywhere on a row (except elements with `data-no-row-click`). Prefer
   * `useCallback` to avoid breaking `React.memo` on rows.
   */
  onRowClick?: (item: T) => void;
  /**
   * Turn each row into a `next/link` to the returned URL. Ignored if
   * `onRowClick` is set. Prefer `useCallback` for the same reason.
   */
  rowHref?: (item: T) => string | null | undefined;
  /**
   * Keep table height stable by padding with invisible rows when data is short.
   * Typically set to the same value as `skeletonRows`. Pass `0` to disable.
   */
  minRows?: number;
  /**
   * Render expandable content below a row, inside the same card. Return a node to
   * attach it (the cells row gains a bottom divider), or null/undefined for none.
   * Interactive content inside must carry `data-no-row-click`.
   */
  renderSubRow?: (item: T) => ReactNode;
}

/**
 * Renders skeleton / empty state / rows based on table context state. Place
 * inside `<DataTable>`. Rows use `React.memo` for performance — memoize
 * `onRowClick` / `rowHref` / `rowClassName` (if function) with `useCallback`
 * in the consumer to get the full benefit.
 */
export function DataTableBody<T = unknown>({
  loading,
  emptyMessage,
  emptyState,
  skeletonRows = 10,
  className,
  rowClassName,
  compact,
  autoHeight,
  rowHeightClassName,
  onRowClick,
  rowHref,
  minRows,
  renderSubRow,
}: DataTableBodyProps<T>) {
  const table = useDataTableContext<T>();
  const rows = table.getRowModel().rows;

  if (loading && rows.length === 0) {
    return (
      <div className={cn('flex w-full flex-col gap-[var(--spacing-system-xsf)]', className)}>
        <DataTableSkeleton rows={skeletonRows} rowHeightClassName={rowHeightClassName} />
      </div>
    );
  }

  if (rows.length === 0) {
    const empty = emptyState ? (
      <DataTableEmpty {...emptyState} />
    ) : emptyMessage != null ? (
      <DataTableEmpty title={emptyMessage} description={undefined} />
    ) : (
      <DataTableEmpty />
    );

    // `minRows` promises a STABLE table height. An empty board is exactly when
    // a collapsing table is most visible — the pagination and everything under
    // it jump up the moment a filter matches nothing — so reserve the same row
    // slots here and center the empty state over them.
    if (minRows) {
      return (
        <div className={cn('relative flex w-full flex-col gap-[var(--spacing-system-xsf)]', className)}>
          <PlaceholderRows count={minRows} rowHeightClassName={rowHeightClassName} />
          <div className="absolute inset-0 flex items-center justify-center">{empty}</div>
        </div>
      );
    }

    return <div className={cn('flex w-full flex-col gap-[var(--spacing-system-xsf)]', className)}>{empty}</div>;
  }

  const padCount = minRows ? Math.max(0, minRows - rows.length) : 0;

  return (
    <div className={cn('flex w-full flex-col gap-[var(--spacing-system-xsf)]', className)}>
      {rows.map((row, index) => {
        const item = row.original;
        const href = rowHref?.(item) ?? undefined;
        const cls = typeof rowClassName === 'function' ? rowClassName(item, index) : rowClassName;
        return (
          <DataTableRow<T>
            key={row.id}
            row={row}
            onClick={onRowClick}
            href={href}
            compact={compact}
            autoHeight={autoHeight}
            rowHeightClassName={rowHeightClassName}
            className={cls}
            subRow={renderSubRow?.(item)}
          />
        );
      })}
      {padCount > 0 && <PlaceholderRows count={padCount} rowHeightClassName={rowHeightClassName} />}
    </div>
  );
}

/**
 * Invisible rows that occupy exactly one row slot each.
 *
 * THE height reservation for a table whose page is short or empty — both call
 * sites use it, so a padded page and an empty one are the same height by
 * construction rather than by two matching guesses.
 */
function PlaceholderRows({ count, rowHeightClassName }: { count: number; rowHeightClassName?: string }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`placeholder-${i}`}
          // `border-transparent`, not no border: a real row card draws a 1px
          // border on each side, so its outer block is the inner height PLUS 2.
          // A pad row without one is 2px shorter than the row it stands in for
          // — invisible per row, 54px over a 27-row remainder, which is the
          // same shift `minRows` exists to prevent.
          className={cn(
            'pointer-events-none relative overflow-hidden rounded-md border border-transparent',
            // The stated slot height belongs on the CARD, exactly as a real
            // row carries it — a real row with a sub-row is taller than its
            // cells, so reserving the cells' height here left every pad row
            // short by the sub-row.
            rowHeightClassName,
          )}
          aria-hidden="true"
        >
          <div
            className={cn('hidden py-0 md:flex', ROW_SHELL_CLASSES, rowHeightClassName ? 'h-full' : ROW_HEIGHT_DESKTOP)}
          />
          <div
            className={cn(
              'flex justify-start py-0 md:hidden',
              ROW_SHELL_CLASSES,
              rowHeightClassName ? 'h-full' : ROW_HEIGHT_MOBILE,
            )}
          />
        </div>
      ))}
    </>
  );
}
