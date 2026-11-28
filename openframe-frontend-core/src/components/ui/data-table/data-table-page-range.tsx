'use client';

import { cn } from '../../../utils/cn';
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { cursorPaginationText } from '../cursor-pagination';
import { useLoadingScope } from '../loading-scope';
import { useOptionalDataTableContext } from './data-table';

export interface DataTablePageRangeProps {
  /** 1-based position of the page's first row. Without it the text is the count ("Showing 20 of 216 results"). */
  rangeStart?: number;
  /** The server's total, when the list knows it ("21–40 of 340 results"); "21–40 results" without it. */
  totalCount?: number | null;
  /** Singular item name, pluralized with an "s" unless the total (or, with no total, the page) is one row. */
  itemName?: string;
  /** Custom pluralizer for irregular nouns. */
  pluralize?: (count: number, itemName: string) => string;
  /** Read only for the count form without a total ("Showing 20+ results"). */
  hasNextPage?: boolean;
  /** Override the page's row count. Defaults to the rows in the table's row model (outside a `DataTable`, pass it). */
  currentCount?: number;
  /** The table holds no page of its own yet (its first page, or placeholder rows, is being read): the text is a bar. */
  loading?: boolean;
  className?: string;
}

const RANGE_CLASS = 'min-w-0 truncate whitespace-nowrap text-ods-text-secondary text-h6';

/**
 * The page's range on a paged table, on the left of `DataTable.Meta`: "21–40 of 340 results". It takes the place of
 * the row count. Draws nothing for an empty page (the row keeps its height), and a bar while the first page is read.
 */
export function DataTablePageRange({
  rangeStart,
  totalCount,
  itemName = 'result',
  pluralize,
  hasNextPage = false,
  currentCount,
  loading = false,
  className,
}: DataTablePageRangeProps) {
  const table = useOptionalDataTableContext();
  const inScope = useLoadingScope() || loading;
  const count = currentCount ?? table?.getRowModel().rows.length ?? 0;
  const plural = pluralize?.(2, itemName) ?? `${itemName}s`;

  // The rows are still being read (placeholder rows, or none): the range is not known yet. A NEXT page read keeps the
  // last page's text (the caller passes `loading` only while the table holds no page of its own).
  if (inScope) {
    return (
      <span className={cn(RANGE_CLASS, className)} aria-hidden>
        <TextLineSkeleton type="inherit" as="span" className="inline-block w-16 align-top" /> {plural}
      </span>
    );
  }

  const one = (totalCount ?? count) === 1;
  const text = cursorPaginationText({
    currentCount: count,
    totalCount,
    hasNextPage,
    rangeStart,
    itemName: one ? (pluralize?.(1, itemName) ?? itemName) : plural,
  });
  if (!text) return null;
  return <span className={cn(RANGE_CLASS, className)}>{text}</span>;
}
