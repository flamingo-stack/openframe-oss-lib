'use client';

import { cn } from '../../../utils/cn';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../loading-scope';
import { useDataTableContext } from './data-table';

export interface DataTableRowCountProps {
  /** Singular item name. Pluralized by adding an "s". */
  itemName?: string;
  /**
   * Override the count. Use this for server-paginated tables where the table
   * context only knows about loaded rows, not the total. Defaults to the
   * number of rows currently in the table's row model.
   */
  totalCount?: number;
  /** Custom pluralizer for irregular nouns. */
  pluralize?: (count: number, itemName: string) => string;
  /** Hide when the count is zero. Default `true`. */
  hideWhenEmpty?: boolean;
  className?: string;
}

const ROW_COUNT_CLASS = 'whitespace-nowrap text-ods-text-secondary text-h6';

/** The row count while the rows are read: the same line, the number a bar and the (plural) item name real. */
export function DataTableRowCountSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <span className={cn(ROW_COUNT_CLASS, className)} aria-hidden>
      <TextLineSkeleton type="inherit" as="span" className="inline-block w-6 align-top" /> {label}
    </span>
  );
}

/**
 * Renders "8 devices" (or your custom `itemName`) for the current row model.
 * Place wherever you want — above the table, in a toolbar, in a header right
 * slot.
 *
 * For server-paginated tables, pass `totalCount` explicitly — the table
 * context only knows about loaded rows.
 *
 * @example
 * <DataTable.Header rightSlot={
 *   <DataTable.RowCount itemName="device" totalCount={pageInfo.total} />
 * } />
 */
export function DataTableRowCount({
  itemName = 'result',
  totalCount,
  pluralize,
  hideWhenEmpty = true,
  className,
}: DataTableRowCountProps) {
  const table = useDataTableContext();
  // While the page is read the count is not known: the number is a bar beside the item name.
  const inScope = useLoadingScope();
  const count = totalCount ?? table.getRowModel().rows.length;
  if (inScope) {
    return <DataTableRowCountSkeleton label={pluralize?.(2, itemName) ?? `${itemName}s`} className={className} />;
  }

  if (hideWhenEmpty && count === 0) return null;

  const label = pluralize?.(count, itemName) ?? (count === 1 ? itemName : `${itemName}s`);

  return (
    <span className={cn(ROW_COUNT_CLASS, className)}>
      {count} {label}
    </span>
  );
}
