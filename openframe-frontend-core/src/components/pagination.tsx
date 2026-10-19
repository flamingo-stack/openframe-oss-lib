'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { type ButtonHTMLAttributes, type HTMLAttributes, type MouseEvent, type ReactNode, forwardRef } from 'react';
import Link from '../embed-shims/next-link';
import { cn } from '../utils/cn';
import { isModifierClick } from './chat/utils/chat-nav-resolution';
import { InteractiveSkeleton } from './loading/unified-skeleton';
import { Button } from './ui/button';
import { useLoadingScope } from './ui/loading-scope';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  /**
   * The address of a page of this list. With it every enabled control is a real
   * link (`<a href>`), so a crawler that runs no script can reach every page of
   * the list, and a person can open a page in a new tab. A plain click still
   * changes the page in place through `onPageChange`. Without it the controls
   * are buttons.
   */
  getPageHref?: (page: number) => string;
  /**
   * The list is still being read: the pager draws its own skeleton, for `totalPages` on `currentPage` when the count
   * is known (more than one page), else for a list of many pages. Also drawn in a page's loading scope.
   */
  loading?: boolean;
}

interface PaginationControlProps {
  /** The page this control goes to. */
  page: number;
  /** The control's accessible name ("Page 3", "Go to next page"). */
  label: string;
  variant: 'accent' | 'outline';
  className: string;
  /** The control marks the page being shown. */
  current?: boolean;
  /** There is no such page (previous on the first page, next on the last). */
  disabled?: boolean;
  /** Which neighbour the control leads to, stated to crawlers and assistive technology as `rel`. */
  rel?: 'prev' | 'next';
  onPageChange: (page: number) => void;
  getPageHref?: (page: number) => string;
  children: ReactNode;
}

/**
 * One control of the pager. With a page address it is a link: the href is the
 * page's real URL, so it works with no script, in a new tab and for a crawler,
 * and a plain click is taken over to change the page in place (the progressive
 * enhancement every in-page link in this library uses). With no address, or
 * when there is no such page, it is a button: a link must always lead somewhere.
 */
function PaginationControl({
  page,
  label,
  variant,
  className,
  current,
  disabled,
  rel,
  onPageChange,
  getPageHref,
  children,
}: PaginationControlProps) {
  const ariaCurrent = current ? ('page' as const) : undefined;

  if (!getPageHref || disabled) {
    return (
      <Button
        variant={variant}
        size="icon"
        className={className}
        disabled={disabled}
        aria-label={label}
        aria-current={ariaCurrent}
        onClick={() => onPageChange(page)}
      >
        {children}
      </Button>
    );
  }

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // A new tab or window is the browser's to open, at the link's own address.
    if (isModifierClick(event)) return;
    event.preventDefault();
    onPageChange(page);
  };

  return (
    <Button variant={variant} size="icon" className={className} asChild>
      <Link
        href={getPageHref(page)}
        prefetch={false}
        rel={rel}
        aria-label={label}
        aria-current={ariaCurrent}
        onClick={handleClick}
      >
        {children}
      </Link>
    </Button>
  );
}

const NEIGHBOUR_CLASS = '!h-10 !w-10 content-md:!h-10 content-md:!w-10';
const PAGE_CLASS = '!h-9 !w-9 content-md:!h-9 content-md:!w-9';

/**
 * The controls the pager draws between previous and next: page numbers, and `-1` / `-2` for an ellipsis. Read by
 * the pager and by its skeleton, so the skeleton draws the same controls.
 */
export function paginationSlots(currentPage: number, totalPages: number): number[] {
  const pages: number[] = [];
  const maxPagesToShow = 5;

  if (totalPages <= maxPagesToShow) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  // Always show first page
  pages.push(1);

  // Calculate start and end of page range
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);

  // Adjust if at the beginning or end
  if (currentPage <= 2) {
    end = Math.min(totalPages - 1, 4);
  } else if (currentPage >= totalPages - 1) {
    start = Math.max(2, totalPages - 3);
  }

  if (start > 2) pages.push(-1); // -1 represents ellipsis
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push(-2); // -2 represents ellipsis
  if (totalPages > 1) pages.push(totalPages);

  return pages;
}

/** The ellipsis between page numbers, read by the pager and by its skeleton. */
function PaginationEllipsisSlot() {
  return (
    <span className="flex h-9 w-9 items-center justify-center text-muted-foreground text-h6">
      <MoreHorizontal className="h-4 w-4" />
      <span className="sr-only">More pages</span>
    </span>
  );
}

/** The pager's row and its list, read by the pager and by its skeleton, so the skeleton is the pager's size. */
const PAGINATION_NAV_CLASS = 'mx-auto flex w-full justify-center';
const PAGINATION_LIST_CLASS = 'flex flex-row items-center gap-1';
/**
 * The page count the skeleton draws the pager for when the count is read with the list: a list of many pages, on
 * its first page (prev, pages 1-4, the ellipsis, the last page, next), the pager's widest first-page shape.
 */
export const PAGINATION_SKELETON_TOTAL_PAGES = 10;

const Pagination = ({ currentPage, totalPages, onPageChange, className, getPageHref, loading }: PaginationProps) => {
  // One switch: while the list is read (a prop, or a page's loading scope) the pager is drawn as its skeleton, for
  // the page count when it is already known.
  if (useLoadingScope() || loading) {
    const known = totalPages > 1;
    return (
      <PaginationSkeleton
        className={className}
        totalPages={known ? totalPages : undefined}
        currentPage={known ? currentPage : undefined}
      />
    );
  }

  const pageNumbers = paginationSlots(currentPage, totalPages);

  return (
    <nav role="navigation" aria-label="pagination" className={cn(PAGINATION_NAV_CLASS, className)}>
      <ul className={PAGINATION_LIST_CLASS}>
        <li>
          <PaginationControl
            page={currentPage - 1}
            label="Go to previous page"
            variant="outline"
            className={NEIGHBOUR_CLASS}
            disabled={currentPage === 1}
            rel="prev"
            onPageChange={onPageChange}
            getPageHref={getPageHref}
          >
            <ChevronLeft className="h-4 w-4" />
          </PaginationControl>
        </li>

        {pageNumbers.map((page, index) => {
          if (page < 0) {
            // Render ellipsis
            return (
              <li key={`ellipsis-${index}`}>
                <PaginationEllipsisSlot />
              </li>
            );
          }

          return (
            <li key={page}>
              <PaginationControl
                page={page}
                label={`Page ${page}`}
                variant={currentPage === page ? 'accent' : 'outline'}
                className={PAGE_CLASS}
                current={currentPage === page}
                onPageChange={onPageChange}
                getPageHref={getPageHref}
              >
                {page}
              </PaginationControl>
            </li>
          );
        })}

        <li>
          <PaginationControl
            page={currentPage + 1}
            label="Go to next page"
            variant="outline"
            className={NEIGHBOUR_CLASS}
            disabled={currentPage === totalPages}
            rel="next"
            onPageChange={onPageChange}
            getPageHref={getPageHref}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </PaginationControl>
        </li>
      </ul>
    </nav>
  );
};

/**
 * The pager while its list is read: the same row and the controls the pager draws for `totalPages` on
 * `currentPage` (`paginationSlots`), each page control a box of its size and the ellipsis as it is.
 */
function PaginationSkeleton({
  totalPages = PAGINATION_SKELETON_TOTAL_PAGES,
  currentPage = 1,
  className,
}: {
  totalPages?: number;
  currentPage?: number;
  className?: string;
}) {
  return (
    <div className={cn(PAGINATION_NAV_CLASS, className)} aria-hidden inert>
      <ul className={PAGINATION_LIST_CLASS}>
        <li>
          <InteractiveSkeleton.Button className={NEIGHBOUR_CLASS} />
        </li>
        {paginationSlots(currentPage, Math.max(totalPages, 1)).map((page, index) => (
          <li key={page < 0 ? `ellipsis-${index}` : page}>
            {page < 0 ? <PaginationEllipsisSlot /> : <InteractiveSkeleton.Button className={PAGE_CLASS} />}
          </li>
        ))}
        <li>
          <InteractiveSkeleton.Button className={NEIGHBOUR_CLASS} />
        </li>
      </ul>
    </div>
  );
}

const PaginationContent = forwardRef<HTMLUListElement, HTMLAttributes<HTMLUListElement>>(
  ({ className, ...props }, ref) => {
    return <ul ref={ref} className={cn('flex items-center justify-center', className)} {...props} />;
  },
);
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = forwardRef<HTMLLIElement, HTMLAttributes<HTMLLIElement>>(({ className, ...props }, ref) => {
  return <li ref={ref} className={cn('', className)} {...props} />;
});
PaginationItem.displayName = 'PaginationItem';

const PaginationLink = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background transition-colors text-h6 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
        {...props}
      />
    );
  },
);
PaginationLink.displayName = 'PaginationLink';

const PaginationEllipsis = forwardRef<HTMLSpanElement, HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn('flex h-10 w-10 items-center justify-center text-muted-foreground', className)}
        {...props}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">More pages</span>
      </span>
    );
  },
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

const PaginationPrevious = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    return (
      <Button ref={ref} variant="outline" size="icon" className={cn('h-10 w-10', className)} {...props}>
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>
    );
  },
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => {
    return (
      <Button ref={ref} variant="outline" size="icon" className={cn('h-10 w-10', className)} {...props}>
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
    );
  },
);
PaginationNext.displayName = 'PaginationNext';

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSkeleton,
};
