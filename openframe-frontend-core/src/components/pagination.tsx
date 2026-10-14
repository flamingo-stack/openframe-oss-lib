'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { type ButtonHTMLAttributes, type HTMLAttributes, type MouseEvent, type ReactNode, forwardRef } from 'react';
import Link from '../embed-shims/next-link';
import { cn } from '../utils/cn';
import { isModifierClick } from './chat/utils/chat-nav-resolution';
import { Button } from './ui/button';

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

const Pagination = ({ currentPage, totalPages, onPageChange, className, getPageHref }: PaginationProps) => {
  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      // Show all pages if there are fewer than maxPagesToShow
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
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

      // Add ellipsis if needed
      if (start > 2) {
        pages.push(-1); // -1 represents ellipsis
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push(-2); // -2 represents ellipsis
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <nav role="navigation" aria-label="pagination" className={cn('mx-auto flex w-full justify-center', className)}>
      <ul className="flex flex-row items-center gap-1">
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
                <span className="flex h-9 w-9 items-center justify-center text-muted-foreground text-h6">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More pages</span>
                </span>
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
};
