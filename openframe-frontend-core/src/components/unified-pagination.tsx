'use client';

import { useSearchParams, usePathname } from '../embed-shims/next-navigation';
import { withQuery } from '../utils/search-params';
import { Pagination } from './pagination';

interface UnifiedPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange?: (page: number) => void;
  className?: string;
  /**
   * Write `?page=` into the URL on every change (default true, the historical
   * behaviour). Set false when the CALLER owns the URL — a surface whose whole
   * filter state is one schema would otherwise get two writers racing on it.
   */
  syncUrl?: boolean;
  /**
   * Keep the row's height when there is only one page, instead of rendering
   * nothing. Stops a one-page result from shifting the content above it.
   */
  reserveSpace?: boolean;
}

export function UnifiedPagination({
  currentPage,
  totalPages,
  onPageChange,
  className = 'mt-8 flex justify-center w-full',
  syncUrl = true,
  reserveSpace = false,
}: UnifiedPaginationProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const handlePageChange = (page: number) => {
    // Preserve current scroll position
    const currentScrollY = window.scrollY;

    // Call the callback to update local state (prevents reload)
    if (onPageChange) {
      onPageChange(page);
    }

    // Update URL for bookmarking without navigation — unless the caller owns
    // the URL (`syncUrl={false}`), in which case a second writer here would
    // race the caller's own param write.
    if (syncUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', page.toString());
      window.history.replaceState(null, '', withQuery(pathname, params.toString()));
    }

    // Restore scroll position after a brief delay to allow content to render
    setTimeout(() => {
      window.scrollTo({
        top: currentScrollY,
        behavior: 'instant', // Instant to prevent any scroll animation
      });
    }, 0);
  };

  // Don't render pagination if there's only one page (optionally holding the
  // row's height so the content above it does not shift).
  //
  // The reserved row renders the REAL control, hidden — an empty div reserves
  // nothing, and a hardcoded spacer height silently drifts the day the control
  // changes. `invisible` keeps the box, `aria-hidden` + `pointer-events-none`
  // keep it out of the accessibility tree and out of the way.
  if (totalPages <= 1) {
    return reserveSpace ? (
      <div className={className} aria-hidden="true">
        <div className="pointer-events-none invisible">
          <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />
        </div>
      </div>
    ) : null;
  }

  return (
    <div className={className}>
      <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
    </div>
  );
}
