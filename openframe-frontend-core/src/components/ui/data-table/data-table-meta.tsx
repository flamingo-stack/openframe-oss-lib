'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';

export interface DataTableMetaProps {
  /** What the row holds: normally `<DataTable.RowCount />`. */
  children: ReactNode;
  className?: string;
}

/**
 * The row right above a grid table (the design's `table/meta`): the results count, at every width like the grid
 * itself.
 *
 * The row keeps the height of its one line of text when it holds nothing (`DataTable.RowCount` draws nothing for a
 * search with no results), so the table under it does not move up and back down as results come and go.
 */
export function DataTableMeta({ children, className }: DataTableMetaProps) {
  return (
    <div
      data-grid-meta
      className={cn(
        // `text-h6` is the count's own type step: `1lh` here is that line's height.
        'flex min-h-[calc(1lh+var(--spacing-system-xxs))] items-center gap-[var(--spacing-system-mf)] pb-[var(--spacing-system-xxs)] text-h6',
        className,
      )}
    >
      {children}
    </div>
  );
}
