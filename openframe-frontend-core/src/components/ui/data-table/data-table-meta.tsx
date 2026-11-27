'use client';

import { isValidElement, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { useDataTableLayout } from './data-table-grid';

export interface DataTableMetaProps {
  /** The row's text, on its left: normally `<DataTable.RowCount />`, or `<DataTable.PageRange />` on a paged table. */
  children: ReactNode;
  /** The pager (`<DataTable.Pagination />`): right of the text. */
  pagination?: ReactNode;
  /** The row's controls at its right end (the auto-refresh picker), after a divider when there is a pager. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The row right above a table (the design's `meta row`): the results count, or the page's range, on the left; the
 * pager and the auto-refresh picker on the right. A direct child of `DataTable`, it stays out of a grid table's scroll
 * area, so the pager never scrolls with the rows.
 *
 * - From the content's md width: one line, `range · pagination | actions`.
 * - Below it: the text and the actions on the first line, the pager on its own line under them (rows-per-page on the
 *   left, the arrows on the right).
 *
 * The row keeps the height of its one line of text when it holds nothing (`DataTable.RowCount` draws nothing for a
 * search with no results), so the table under it does not move up and back down as results come and go.
 */
export function DataTableMeta({ children, pagination, actions, className }: DataTableMetaProps) {
  const controls = !!pagination || !!actions;
  const grid = useDataTableLayout() === 'grid';
  return (
    <div
      data-table-meta
      // A card table's markup carries no grid attribute: `data-grid-meta` marks the grid's row only.
      data-grid-meta={grid || undefined}
      className={cn(
        // `text-h6` is the count's own type step: `1lh` here is that line's height.
        'flex min-h-[calc(1lh+var(--spacing-system-xxs))] flex-wrap items-center gap-x-[var(--spacing-system-mf)] gap-y-[var(--spacing-system-xsf)] text-h6',
        // The 32px controls take the design's 8 under them; the count alone keeps its 4.
        controls ? 'pb-[var(--spacing-system-xsf)]' : 'pb-[var(--spacing-system-xxs)]',
        className,
      )}
    >
      <div className="order-1 flex min-w-0 flex-1 items-center gap-[var(--spacing-system-mf)]">{children}</div>
      {pagination && (
        <div className="order-3 w-full content-md:order-2 content-md:w-auto content-md:shrink-0">{pagination}</div>
      )}
      {pagination && actions && (
        <span aria-hidden data-grid-meta-divider className="order-3 hidden h-6 w-px bg-ods-border content-md:block" />
      )}
      {actions && <div className="order-2 flex shrink-0 items-center content-md:order-4">{actions}</div>}
    </div>
  );
}

/**
 * The components a grid with a height keeps above its scroll viewport, so the row never scrolls with the rows: this
 * row, and a component that draws nothing but it (`DataTableMetaRow`), which registers itself with
 * {@link hoistAsTableMeta}.
 */
const TABLE_META_TYPES = new Set<unknown>([DataTableMeta]);

/** Keep this component, a wrapper that draws only `DataTableMeta`, above a grid's scroll viewport too. */
export function hoistAsTableMeta(type: unknown): void {
  TABLE_META_TYPES.add(type);
}

/** The child is the row above the table (the table root keeps it out of a grid's scroll viewport). */
export function isTableMetaElement(child: ReactNode): boolean {
  return isValidElement(child) && TABLE_META_TYPES.has(child.type);
}
