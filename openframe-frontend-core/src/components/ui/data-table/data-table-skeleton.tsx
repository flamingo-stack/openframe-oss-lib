'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { useDataTableContext } from './data-table';
import { getHideClasses } from './utils';

/**
 * Consistent INNER row heights. The row card wraps these in a 1px border on
 * each side, so the outer block lands on the designed 68px / 80px total —
 * hence the 66/78 values here.
 */
export const ROW_HEIGHT_DESKTOP = 'h-[66px] md:h-[78px]';
export const ROW_HEIGHT_MOBILE = 'h-[66px]';

/**
 * The row shell's inset and column gap.
 *
 * Shared by the real row (`data-table-row`), the skeleton rows below and the
 * pad rows in `data-table-body`, because a difference between them is a visible
 * shift on load — and there WAS one: all three placeholders used
 * `--spacing-system-sf` (12px) in their mobile variant while the real row uses
 * `--spacing-system-mf` (16px) at every width, so a loading table sat 4px closer
 * to the card edge than the loaded one and its content nudged over when data
 * arrived. Kept as a constant rather than three copies so that cannot drift again.
 */
export const ROW_SHELL_CLASSES = 'items-center gap-[var(--spacing-system-mf)] px-[var(--spacing-system-mf)]';

export interface DataTableSkeletonProps {
  rows?: number;
  className?: string;
  rowClassName?: string;
  /**
   * REPLACES the design row height, for a table whose rows are not that tall.
   * Sizes the CARD, as a real row does.
   * Appending a height through `rowClassName` cannot do this: tailwind-merge
   * drops the plain `h-[66px]` but keeps `md:h-[78px]`, so the override held
   * on a phone and lost on a desktop. See `DataTableBodyProps.rowHeightClassName`.
   */
  rowHeightClassName?: string;
}

export function DataTableSkeleton({ rows = 10, className, rowClassName, rowHeightClassName }: DataTableSkeletonProps) {
  const table = useDataTableContext();
  const columns = table.getVisibleFlatColumns();
  const firstColumnId = columns[0]?.id;

  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'relative animate-pulse overflow-hidden rounded-md border border-ods-border bg-ods-card',
            // The slot height sits on the card, matching a real row.
            rowHeightClassName,
            className,
          )}
        >
          <div
            className={cn(
              'hidden py-0 md:flex',
              ROW_SHELL_CLASSES,
              rowHeightClassName ? 'h-full' : ROW_HEIGHT_DESKTOP,
              rowClassName,
            )}
          >
            {columns.map(column => {
              const meta = column.columnDef.meta;
              return (
                <div
                  key={column.id}
                  className={cn(
                    'flex shrink-0 flex-col justify-center',
                    meta?.width || 'flex-1',
                    // Same responsive hiding the real header and row apply.
                    // Without it a `hideAt` column was drawn in the skeleton and
                    // absent from the loaded table, so below that breakpoint the
                    // remaining columns were sized against a different total and
                    // the whole row re-laid-out the moment data arrived.
                    getHideClasses(meta?.hideAt),
                  )}
                >
                  <div className="mb-[var(--spacing-system-xxs)] h-5 w-3/4 rounded-sm bg-ods-bg-surface" />
                  {index % 2 === 0 && column.id === firstColumnId && (
                    <div className="h-4 w-1/2 rounded-sm bg-ods-bg-surface opacity-60" />
                  )}
                </div>
              );
            })}
          </div>
          <div
            className={cn(
              'flex justify-start py-0 md:hidden',
              ROW_SHELL_CLASSES,
              rowHeightClassName ? 'h-full' : ROW_HEIGHT_MOBILE,
              rowClassName,
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col justify-center py-[var(--spacing-system-sf)]">
              <div className="mb-[var(--spacing-system-xsf)] h-4 w-3/4 rounded-sm bg-ods-bg-surface" />
              <div className="h-3 w-1/2 rounded-sm bg-ods-bg-surface opacity-60" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * The empty state, floating centred over a full page's worth of reserved row
 * slots. Both table bodies render this — an empty table is exactly when a
 * collapsing one is most visible (the pagination and everything under it jump
 * the moment a filter matches nothing), and two hand-matched copies of the
 * wrapper would drift the way the two placeholder components already had.
 */
export function ReservedEmptyState({
  count,
  gapClassName,
  rowHeightClassName,
  innerHeightClassName,
  children,
}: {
  count: number;
  gapClassName: string;
  rowHeightClassName?: string;
  innerHeightClassName?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative flex w-full flex-col', gapClassName)}>
      <PlaceholderRows
        count={count}
        rowHeightClassName={rowHeightClassName}
        innerHeightClassName={innerHeightClassName}
      />
      {/* `sticky left-0` + `w-screen max-w-full`: hosts wrap tables in a
          horizontal scroller with a forced min-width, and an overlay centred on
          that CANVAS puts the message off-screen on a phone. This centres it on
          the visible area instead, and collapses to plain centring when the
          table is not wider than its container. */}
      <div className="absolute inset-0 flex items-center">
        <div className="sticky left-0 flex w-screen max-w-full justify-center">{children}</div>
      </div>
    </div>
  );
}

/**
 * Invisible rows that occupy exactly one row slot each.
 *
 * THE height reservation for a table whose page is short or empty — every call
 * site uses it (data-table's pad + empty branches AND the legacy `Table`'s), so
 * a padded page and an empty one are the same height by construction rather
 * than by matching guesses in each component.
 */
export function PlaceholderRows({
  count,
  rowHeightClassName,
  innerHeightClassName,
}: {
  count: number;
  /** Height on the CARD, as `DataTableRow` carries it. */
  rowHeightClassName?: string;
  /** Height on the INNER row instead — the legacy `Table` puts it there and
   *  lets the card's border add the remaining 2px, so its pad rows must too. */
  innerHeightClassName?: string;
}) {
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
            className={cn(
              'hidden py-0 md:flex',
              ROW_SHELL_CLASSES,
              innerHeightClassName ?? (rowHeightClassName ? 'h-full' : ROW_HEIGHT_DESKTOP),
            )}
          />
          <div
            className={cn(
              'flex justify-start py-0 md:hidden',
              ROW_SHELL_CLASSES,
              innerHeightClassName ?? (rowHeightClassName ? 'h-full' : ROW_HEIGHT_MOBILE),
            )}
          />
        </div>
      ))}
    </>
  );
}
