'use client';

import { ChevronLeft, ChevronRight, RotateCcw, Home } from 'lucide-react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from './button';
import { useLoadingScope } from './loading-scope';

export interface CursorPaginationProps {
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  isFirstPage?: boolean;
  startCursor?: string | null;
  endCursor?: string | null;

  currentCount?: number;
  totalCount?: number | null;
  itemName?: string;
  /**
   * 1-based position of the page's first row. With it the info text is the range ("21–40 of 340 devices", "21–40
   * devices" with no total); without it, the count ("Showing 20 of 340 devices").
   */
  rangeStart?: number;

  /**
   * The pager's page is being read: every button is disabled. Before the first count is known (no `currentCount`), and
   * inside a loading scope, the pager draws its skeleton: the count line a bar, its own buttons real and inert.
   */
  loading?: boolean;

  onNext?: (cursor: string) => void;
  /** Called with `startCursor` (an empty string when there is none: a pager that pages back through history). */
  onPrevious?: (cursor: string) => void;
  /**
   * Go to the first page. Drawn NEXT TO Previous (First · Previous · Next), disabled on the first page. Prefer it over
   * `onReset`, which replaces Previous.
   */
  onFirst?: () => void;
  /** Legacy: a First button drawn INSTEAD of Previous. Ignored when `onFirst` is set. */
  onReset?: () => void;

  className?: string;
  showInfo?: boolean;
  compact?: boolean;
  resetButtonLabel?: string;
  resetButtonIcon?: 'home' | 'rotate';
}

/** The info line: the range when the page's position is known, the count otherwise. */
export function cursorPaginationText({
  currentCount,
  totalCount,
  hasNextPage,
  itemName,
  rangeStart,
}: Pick<CursorPaginationProps, 'currentCount' | 'totalCount' | 'hasNextPage' | 'rangeStart'> & {
  itemName: string;
}): string | null {
  if (!currentCount) return null;
  if (rangeStart !== undefined && rangeStart > 0) {
    const range = `${rangeStart}–${rangeStart + currentCount - 1}`;
    return totalCount ? `${range} of ${totalCount} ${itemName}` : `${range} ${itemName}`;
  }
  if (totalCount) return `Showing ${currentCount} of ${totalCount} ${itemName}`;
  if (hasNextPage) return `Showing ${currentCount}+ ${itemName}`;
  return `Showing ${currentCount} ${itemName}`;
}

export function CursorPagination({
  hasNextPage,
  hasPreviousPage,
  isFirstPage = true,
  startCursor,
  endCursor,
  currentCount,
  totalCount,
  itemName = 'items',
  rangeStart,
  loading: loadingProp = false,
  onNext,
  onPrevious,
  onFirst,
  onReset,
  className,
  showInfo = true,
  compact = false,
  resetButtonLabel = 'First',
  resetButtonIcon = 'home',
}: CursorPaginationProps) {
  const loading = useLoadingScope() || loadingProp;
  // Its data is the count: until the first one is known, the pager draws its skeleton (a page read with a count shown
  // keeps the count and only disables the buttons).
  const skeleton = loading && !currentCount;
  // `onFirst` draws First beside Previous; the legacy `onReset` draws it instead of Previous.
  const firstAction = onFirst ?? onReset;
  const previousShown = hasPreviousPage !== undefined && !!onPrevious && (!!onFirst || !onReset);

  const handleNext = () => {
    if (hasNextPage && endCursor && onNext) {
      onNext(endCursor);
    }
  };

  const handlePrevious = () => {
    if (!hasPreviousPage || !onPrevious) return;
    // The legacy pager pages back with the server cursor alone; the First · Previous pager may page back through
    // history, with no cursor of its own.
    if (onFirst) onPrevious(startCursor ?? '');
    else if (startCursor) onPrevious(startCursor);
  };

  const ResetIcon = resetButtonIcon === 'rotate' ? RotateCcw : Home;
  const displayText = showInfo
    ? cursorPaginationText({ currentCount, totalCount, hasNextPage, itemName, rangeStart })
    : null;
  // Below the content's md width the labels go (each button keeps its aria-label) and the info line sits above the
  // buttons; `compact` always hid the labels there.
  const labelClass = 'hidden content-md:inline';

  return (
    <div
      className={cn(
        'flex flex-col items-stretch gap-[var(--spacing-system-xsf)] content-md:flex-row content-md:items-center content-md:justify-between content-md:gap-4',
        compact ? 'py-2' : 'py-3',
        className,
      )}
    >
      {/* Info text */}
      {showInfo && (
        <div className="min-w-0 truncate text-ods-text-secondary text-h6">
          {skeleton ? (
            <TextLineSkeleton type="inherit" as="span" className="w-40" />
          ) : (
            displayText || <span>&nbsp;</span>
          )}
        </div>
      )}

      {/* Navigation buttons (in the skeleton: the real buttons, their labels the pager's own words, inert) */}
      <div
        className="flex items-center justify-end gap-2"
        inert={skeleton || undefined}
        aria-hidden={skeleton || undefined}
      >
        {firstAction && (
          <Button
            variant="outline"
            size={compact ? 'small-legacy' : 'default'}
            onClick={firstAction}
            disabled={isFirstPage || loading}
            className={cn(compact && 'h-8 px-3')}
            leftIcon={<ResetIcon className="h-4 w-4" />}
            aria-label="Go to first page"
          >
            <span className={labelClass}>{resetButtonLabel}</span>
          </Button>
        )}

        {previousShown && (
          <Button
            variant="outline"
            size={compact ? 'small-legacy' : 'default'}
            onClick={handlePrevious}
            disabled={!hasPreviousPage || loading}
            className={cn(compact && 'h-8 px-3')}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
            aria-label="Go to previous page"
          >
            <span className={labelClass}>Previous</span>
          </Button>
        )}

        <Button
          variant="outline"
          size={compact ? 'small-legacy' : 'default'}
          onClick={handleNext}
          disabled={!hasNextPage || loading}
          className={cn(compact && 'h-8 px-3')}
          rightIcon={<ChevronRight className="h-4 w-4" />}
          aria-label="Go to next page"
        >
          <span className={labelClass}>Next</span>
        </Button>
      </div>
    </div>
  );
}

export function CursorPaginationSimple({
  hasNextPage,
  hasPreviousPage,
  isFirstPage = true,
  onNext,
  onPrevious,
  onFirst,
  onReset,
  loading = false,
  className,
}: Pick<
  CursorPaginationProps,
  | 'hasNextPage'
  | 'hasPreviousPage'
  | 'isFirstPage'
  | 'onNext'
  | 'onPrevious'
  | 'onFirst'
  | 'onReset'
  | 'loading'
  | 'className'
>) {
  const firstAction = onFirst ?? onReset;
  const previousShown = hasPreviousPage !== undefined && !!onPrevious && (!!onFirst || !onReset);

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {firstAction && (
        <Button
          variant="transparent"
          size="icon"
          onClick={firstAction}
          disabled={isFirstPage || loading}
          className="h-8 w-8"
          leftIcon={<Home className="h-4 w-4" />}
          aria-label="First"
        />
      )}

      {previousShown && (
        <Button
          variant="transparent"
          size="icon"
          onClick={() => onPrevious?.('')}
          disabled={!hasPreviousPage || loading}
          className="h-8 w-8"
          leftIcon={<ChevronLeft className="h-4 w-4" />}
          aria-label="Previous"
        />
      )}

      <Button
        variant="transparent"
        size="icon"
        onClick={() => onNext?.('')}
        disabled={!hasNextPage || loading}
        className="h-8 w-8"
        rightIcon={<ChevronRight className="h-4 w-4" />}
        aria-label="Next"
      />
    </div>
  );
}
