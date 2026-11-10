'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';

export interface DataTableMetaProps {
  /** What the row holds: normally `<DataTable.RowCount />`. */
  children: ReactNode;
  className?: string;
}

/**
 * The row right above a grid table (the design's `table/meta`): the results count. Drawn from `md` up, like the grid
 * itself; below it a grid table is card rows and shows no count, as a card table's header does not.
 */
export function DataTableMeta({ children, className }: DataTableMetaProps) {
  return (
    <div
      data-grid-meta
      className={cn(
        'hidden items-center gap-[var(--spacing-system-mf)] pb-[var(--spacing-system-xxs)] content-md:flex',
        className,
      )}
    >
      {children}
    </div>
  );
}
