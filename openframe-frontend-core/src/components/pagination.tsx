'use client';

import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { type ButtonHTMLAttributes, type HTMLAttributes, type MouseEvent, type ReactNode, forwardRef } from 'react';
import Link from '../embed-shims/next-link';
import { cn } from '../utils/cn';
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

/** A click the browser should handle itself: a new tab, a new window, a download. */
function opensElsewhere(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

const Pagination = ({ currentPage, totalPages, onPageChange, className, getPageHref }: PaginationProps) => {
  /** One control: a link to its page when the list has addresses and the control is enabled, else a button. */
  const control = (
    page: number,
    props: { variant: 'accent' | 'outline'; className: string; disabled?: boolean; label: string; current?: boolean },
    children: ReactNode,
  ) => {
    if (getPageHref && !props.disabled) {
      return (
        <Button variant={props.variant} size="icon" className={props.className} asChild>
          <Link
            href={getPageHref(page)}
            prefetch={false}
            aria-label={props.label}
            aria-current={props.current ? 'page' : undefined}
            onClick={event => {
              if (opensElsewhere(event)) return;
              event.preventDefault();
              onPageChange(page);
            }}
          >
            {children}
          </Link>
        </Button>
      );
    }
    return (
      <Button
        variant={props.variant}
        size="icon"
        onClick={() => onPageChange(page)}
        disabled={props.disabled}
        aria-label={props.label}
        aria-current={props.current ? 'page' : undefined}
        className={props.className}
      >
        {children}
      </Button>
    );
  };

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
          {control(
            currentPage - 1,
            {
              variant: 'outline',
              className: '!h-10 !w-10 content-md:!h-10 content-md:!w-10',
              disabled: currentPage === 1,
              label: 'Go to previous page',
            },
            <ChevronLeft className="h-4 w-4" />,
          )}
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
              {control(
                page,
                {
                  variant: currentPage === page ? 'accent' : 'outline',
                  className: '!h-9 !w-9 content-md:!h-9 content-md:!w-9',
                  label: `Page ${page}`,
                  current: currentPage === page,
                },
                page,
              )}
            </li>
          );
        })}

        <li>
          {control(
            currentPage + 1,
            {
              variant: 'outline',
              className: '!h-10 !w-10 content-md:!h-10 content-md:!w-10',
              disabled: currentPage === totalPages,
              label: 'Go to next page',
            },
            <>
              <ChevronRight className="h-4 w-4" />
              <span className="sr-only">Next page</span>
            </>,
          )}
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
