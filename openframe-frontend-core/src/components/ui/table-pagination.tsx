'use client';

import { cn } from '../../utils/cn';
import { Chevron02LeftIcon } from '../icons-v2-generated/arrows/chevron-02-left-icon';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';
import { Chevrons03LeftIcon } from '../icons-v2-generated/arrows/chevrons-03-left-icon';
import { Button } from './button';
import { useLoadingScope } from './loading-scope';
import { TableRowsPerPage } from './table-rows-per-page';

/** The rows-per-page choices when the caller names none. */
export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = [20, 50, 100];

export interface TablePaginationProps {
  hasNextPage: boolean;
  /** Previous can go somewhere (browser history, page 2's way to the first page, or the server). */
  hasPreviousPage?: boolean;
  /** The table shows its first page: Previous is disabled and First is not drawn. */
  isFirstPage?: boolean;
  /**
   * 1-based index of the page, when known. First is drawn from page 3 on (on page 2 Previous already goes to page 1),
   * and on a page whose index is unknown (a link with a cursor and no index).
   */
  page?: number;
  startCursor?: string | null;
  endCursor?: string | null;

  /** The page is being read: every button waits (disabled), so a second Next cannot resend the same cursor. */
  loading?: boolean;

  onNext?: (cursor: string) => void;
  /** Called with `startCursor` (an empty string when there is none: a pager that pages back through history). */
  onPrevious?: (cursor: string) => void;
  /** Go to the first page: the quiet button before Previous. Without it there is no First. */
  onFirst?: () => void;

  /** Rows per page: the current size, shown as "20 per page". */
  pageSize?: number;
  /** The rows-per-page choices. Default 20 / 50 / 100. */
  pageSizeOptions?: readonly number[];
  /**
   * Change the rows per page (the table goes back to its first page). The rows-per-page menu is drawn only with this
   * handler: it is off by default.
   */
  onPageSizeChange?: (pageSize: number) => void;

  className?: string;
}

const noop = () => {};

/**
 * The pager of a paged table whose first page is being read (the host has no `pageInfo` yet): Previous and Next drawn
 * and waiting, so the row above the table keeps its layout when the page answers.
 */
export const TABLE_PAGINATION_PENDING: TablePaginationProps = {
  hasNextPage: false,
  hasPreviousPage: false,
  isFirstPage: true,
  loading: true,
  onNext: noop,
  onPrevious: noop,
};

/** A disabled arrow sits on the page's deepest ground, not the card colour of the live ones. */
const ARROW_CLASS = 'disabled:bg-ods-bg-base aria-disabled:bg-ods-bg-base';

/**
 * The pager of a cursor-paged table (the design's `table/pagination`): the optional rows-per-page menu and the arrows,
 * First · Previous · Next. It belongs in the row above the table (`DataTable.Meta`'s `pagination`), right of the range
 * text, where it never scrolls with the rows.
 *
 * - Previous and Next are 32px outline icon buttons; a disabled one sits on the page ground with a dimmed glyph.
 * - First is quiet (no surface) and comes from page 3 on: on page 2 Previous is the way to page 1.
 * - There are no page numbers: the backend is cursor based.
 *
 * Below the content's md width the row spans the width: rows-per-page on the left, the arrows on the right.
 */
export function TablePagination({
  hasNextPage,
  hasPreviousPage = false,
  isFirstPage = true,
  page,
  startCursor,
  endCursor,
  loading: loadingProp = false,
  onNext,
  onPrevious,
  onFirst,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  className,
}: TablePaginationProps) {
  const loading = useLoadingScope() || loadingProp;
  const firstShown = !!onFirst && !isFirstPage && page !== 2;

  const handleNext = () => {
    if (hasNextPage && endCursor && onNext) onNext(endCursor);
  };

  const handlePrevious = () => {
    if (hasPreviousPage && onPrevious) onPrevious(startCursor ?? '');
  };

  return (
    <nav
      aria-label="Pagination"
      data-table-pagination
      className={cn('flex min-w-0 items-center gap-[var(--spacing-system-xsf)]', className)}
    >
      {onPageSizeChange && (
        <TableRowsPerPage
          pageSize={pageSize ?? pageSizeOptions[0] ?? 0}
          options={pageSizeOptions}
          onChange={onPageSizeChange}
          disabled={loading}
        />
      )}
      <div className="ml-auto flex shrink-0 items-center gap-[var(--spacing-system-xsf)]">
        {firstShown && (
          <Button
            variant="transparent"
            size="icon-sm"
            onClick={onFirst}
            disabled={loading}
            leftIcon={<Chevrons03LeftIcon />}
            aria-label="Go to first page"
          />
        )}
        {onPrevious && (
          <Button
            variant="outline"
            size="icon-sm"
            onClick={handlePrevious}
            disabled={!hasPreviousPage || loading}
            className={ARROW_CLASS}
            leftIcon={<Chevron02LeftIcon />}
            aria-label="Go to previous page"
          />
        )}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleNext}
          disabled={!hasNextPage || loading}
          className={ARROW_CLASS}
          leftIcon={<Chevron02RightIcon />}
          aria-label="Go to next page"
        />
      </div>
    </nav>
  );
}
