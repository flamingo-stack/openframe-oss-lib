'use client';

import { cn } from '../../../utils/cn';
import { CursorPagination, type CursorPaginationProps } from '../cursor-pagination';
import { useLoadingScope } from '../loading-scope';
import { useDataTableContext } from './data-table';

export interface DataTableCursorFooterProps extends Omit<CursorPaginationProps, 'currentCount'> {
  /**
   * Override the shown current count. Defaults to the number of currently rendered rows
   * from the table instance.
   */
  currentCount?: number;
}

/**
 * Cursor-based First · Prev · Next footer for a `DataTable`. Place after `<DataTable.Body>`.
 * Thin wrapper around `<CursorPagination>` with a border-top separator above it.
 *
 * An empty first page draws no footer: the table's empty state is the whole answer. An empty LATER page keeps it, so
 * First stays reachable.
 */
export function DataTableCursorFooter({ className, currentCount, showInfo, ...rest }: DataTableCursorFooterProps) {
  const table = useDataTableContext();
  const loadingScope = useLoadingScope();
  const rowsCount = table.getRowModel().rows.length;
  const count = currentCount ?? rowsCount;

  if (count === 0 && !(rest.loading || loadingScope) && (rest.isFirstPage ?? true)) return null;

  return (
    <CursorPagination
      {...rest}
      currentCount={count}
      showInfo={showInfo ?? true}
      className={cn(
        'mt-[var(--spacing-system-xsf)] border-t border-ods-border pt-[var(--spacing-system-sf)]',
        className,
      )}
    />
  );
}
