'use client';

import { ChevronLeft, ChevronRight, RotateCcw, Home } from 'lucide-react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from './button';

export interface CursorPaginationProps {
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  isFirstPage?: boolean;
  startCursor?: string | null;
  endCursor?: string | null;

  currentCount?: number;
  totalCount?: number | null;
  itemName?: string;

  loading?: boolean;

  onNext?: (cursor: string) => void;
  onPrevious?: (cursor: string) => void;
  onReset?: () => void;

  className?: string;
  showInfo?: boolean;
  compact?: boolean;
  resetButtonLabel?: string;
  resetButtonIcon?: 'home' | 'rotate';
  /** @internal The skeleton's state: the count line a bar, the buttons drawn but inert. */
  skeleton?: boolean;
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
  loading = false,
  onNext,
  onPrevious,
  onReset,
  className,
  showInfo = true,
  compact = false,
  resetButtonLabel = 'First',
  resetButtonIcon = 'home',
  skeleton = false,
}: CursorPaginationProps) {
  const handleNext = () => {
    if (hasNextPage && endCursor && onNext) {
      onNext(endCursor);
    }
  };

  const handlePrevious = () => {
    if (hasPreviousPage && startCursor && onPrevious) {
      onPrevious(startCursor);
    }
  };

  const handleReset = () => {
    if (onReset) {
      onReset();
    }
  };

  const ResetIcon = resetButtonIcon === 'rotate' ? RotateCcw : Home;

  const getDisplayText = () => {
    if (!showInfo || !currentCount) return null;

    if (totalCount) {
      return `Showing ${currentCount} of ${totalCount} ${itemName}`;
    } else if (hasNextPage) {
      return `Showing ${currentCount}+ ${itemName}`;
    } else {
      return `Showing ${currentCount} ${itemName}`;
    }
  };

  const displayText = getDisplayText();

  return (
    <div className={cn('flex items-center justify-between gap-4', compact ? 'py-2' : 'py-3', className)}>
      {/* Info text */}
      {showInfo && (
        <div className="text-ods-text-secondary text-h6">
          {skeleton ? (
            <TextLineSkeleton type="inherit" as="span" className="w-40" />
          ) : (
            displayText || <span>&nbsp;</span>
          )}
        </div>
      )}

      {/* Navigation buttons (in the skeleton: the real buttons, their labels the pager's own words, inert) */}
      <div className="flex items-center gap-2" inert={skeleton || undefined} aria-hidden={skeleton || undefined}>
        {onReset ? (
          <Button
            variant="outline"
            size={compact ? 'small-legacy' : 'default'}
            onClick={handleReset}
            disabled={isFirstPage || loading}
            className={cn(compact && 'h-8 px-3')}
            leftIcon={<ResetIcon className="h-4 w-4" />}
            aria-label="Go to first page"
          >
            <span className={compact ? 'hidden content-md:inline' : ''}>{resetButtonLabel}</span>
          </Button>
        ) : (
          hasPreviousPage !== undefined &&
          onPrevious && (
            <Button
              variant="outline"
              size={compact ? 'small-legacy' : 'default'}
              onClick={handlePrevious}
              disabled={!hasPreviousPage || loading}
              className={cn(compact && 'h-8 px-3')}
              leftIcon={<ChevronLeft className="h-4 w-4" />}
              aria-label="Go to previous page"
            >
              <span className={compact ? 'hidden content-md:inline' : ''}>Previous</span>
            </Button>
          )
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
          <span className={compact ? 'hidden content-md:inline' : ''}>Next</span>
        </Button>
      </div>
    </div>
  );
}

/**
 * The pager while its page is read: the same row, the count line as a bar, and the pager's own buttons (their labels
 * are the pager's words) drawn inert. Takes the pager's configuration; its cursors and counts are not known yet.
 */
export function CursorPaginationSkeleton(
  props: Pick<
    CursorPaginationProps,
    'hasPreviousPage' | 'onPrevious' | 'onReset' | 'className' | 'showInfo' | 'compact' | 'resetButtonLabel' | 'resetButtonIcon'
  >,
) {
  return <CursorPagination {...props} hasNextPage={false} skeleton />;
}

export function CursorPaginationSimple({
  hasNextPage,
  hasPreviousPage,
  isFirstPage = true,
  onNext,
  onPrevious,
  onReset,
  loading = false,
  className,
}: Pick<
  CursorPaginationProps,
  'hasNextPage' | 'hasPreviousPage' | 'isFirstPage' | 'onNext' | 'onPrevious' | 'onReset' | 'loading' | 'className'
>) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {onReset ? (
        <Button
          variant="transparent"
          size="icon"
          onClick={onReset}
          disabled={isFirstPage || loading}
          className="h-8 w-8"
          leftIcon={<Home className="h-4 w-4" />}
          aria-label="First"
        />
      ) : (
        hasPreviousPage !== undefined &&
        onPrevious && (
          <Button
            variant="transparent"
            size="icon"
            onClick={() => onPrevious?.('')}
            disabled={!hasPreviousPage || loading}
            className="h-8 w-8"
            leftIcon={<ChevronLeft className="h-4 w-4" />}
            aria-label="Previous"
          />
        )
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
