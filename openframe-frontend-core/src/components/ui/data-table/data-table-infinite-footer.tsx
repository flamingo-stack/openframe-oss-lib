'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect';
import { Button } from '../button';
import { useOptionalDataTableContext } from './data-table';
import { useDataTableLoadMoreStore } from './data-table-load-more';
import { DataTableSkeleton, ROW_STACK_CLASSES } from './data-table-skeleton';

export interface DataTableInfiniteFooterProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  /** Skeleton rows shown while fetching. Default `3`. */
  skeletonRows?: number;
  /**
   * `IntersectionObserver` rootMargin — how far ahead of the sentinel the next
   * page is requested. Default `'0px 0px 100% 0px'`: one scroller-height below
   * the fold, so at a reading pace the rows are there before the user is.
   * A percentage resolves against the scroller, so the lead scales with the
   * screen instead of being two rows on every device.
   */
  rootMargin?: string;
  /**
   * Rows LOADED so far, before any client-side narrowing. Pass it when the
   * table shows fewer rows than it has fetched — a search box or an ownership
   * filter applied over the loaded pages.
   *
   * The footer parks itself when a fetch adds nothing (see below), and it
   * judges "nothing" by the table's rows. For such a table a page can arrive in
   * full and still add no VISIBLE row, which is not a stall: the match may be on
   * the next page, and walking on is the only way to reach it. This is the
   * count that does move then.
   */
  loadedCount?: number;
}

const DEFAULT_ROOT_MARGIN = '0px 0px 100% 0px';

/** Server snapshot: effects have not run, so no body has registered yet. */
const getNoBody = () => false;

/**
 * The nearest ancestor that actually scrolls vertically, or `null` for the
 * viewport.
 *
 * It has to be the observer's `root`, because `rootMargin` grows the ROOT's box
 * and nothing else: on the way up from the target every scrolling ancestor
 * clips the intersection to its own scrollport, margin or not. The apps scroll
 * `AppLayout`'s `<main className="overflow-y-auto">`, not the window, so an
 * observer rooted on the viewport had its 200px lead clipped away entirely —
 * measured, the request went out with the sentinel 7px from the fold, i.e. once
 * the user had already run out of rows, on every page.
 *
 * `scrollHeight > clientHeight` is what makes it "actually scrolls": an
 * `overflow-x-auto` wrapper (tables get one for narrow screens) computes
 * `overflow-y: auto` too, and as a root it would be as tall as the whole table —
 * the sentinel would sit inside it permanently and every page would load at once.
 * `<body>` / `<html>` stop the walk for the same reason: a page that scrolls the
 * document is the viewport case, and the element itself is document-tall.
 */
function findScrollParent(element: HTMLElement): HTMLElement | null {
  const { body, documentElement } = element.ownerDocument;
  for (let node = element.parentElement; node && node !== body && node !== documentElement; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

/**
 * Infinite-scroll trigger for a `DataTable`. Place after `<DataTable.Body>`.
 * When the sentinel comes within `rootMargin` of the scroller's fold, calls
 * `onLoadMore`.
 *
 * The skeleton rows shown while fetching are drawn by the BODY, not here: they
 * have to continue its rows at the same pitch, and only the body knows its gap,
 * `rowClassName` and `rowHeightClassName`. This component asks for them through
 * the table's load-more store (`data-table-load-more.ts`) and draws its own
 * only when there is no body with rows to continue.
 *
 * **It stops asking when asking gets nowhere.** A fetch that ends with no new
 * row — a failed request, or a server answering an empty page that still claims
 * a next one — used to re-arm the observer with the sentinel still in view, so
 * the same request went straight back out: a tight loop against the API, one
 * error toast per lap, until the user scrolled away. Now that outcome parks the
 * auto-trigger and offers a Load more button instead; the next fetch that makes
 * progress re-arms it. A table that narrows its loaded pages on the client must
 * pass `loadedCount`, or a page with no visible match reads as no progress.
 */
export function DataTableInfiniteFooter({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  skeletonRows = 3,
  rootMargin = DEFAULT_ROOT_MARGIN,
  loadedCount,
}: DataTableInfiniteFooterProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Refreshed after every commit, declared before the observer effect so it
  // wins the same flush. Not in the render body: the reader is the
  // IntersectionObserver callback, which cannot fire before a commit.
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  const loadMore = useDataTableLoadMoreStore();
  const bodyDrawsRows = useSyncExternalStore(loadMore.subscribe, loadMore.getHasRowsBody, getNoBody);
  const requestedRows = isFetchingNextPage ? skeletonRows : 0;
  // A layout effect, so the body's re-render lands before paint: no frame
  // between "fetching" and the rows appearing.
  useIsomorphicLayoutEffect(() => {
    loadMore.setSkeletonRows(requestedRows);
    return () => loadMore.setSkeletonRows(0);
  }, [loadMore, requestedRows]);

  // Did the last fetch add anything? Read off the table's own rows, which needs
  // no cooperation from the consumer — no error prop to forget to pass; only a
  // table that narrows its loaded pages has to say so, through `loadedCount`. The
  // TAIL (how many rows, and which one is last) rather than the count alone: a
  // search that replaces 40 rows with 20 while a page is in flight ends that
  // fetch with FEWER rows, and that is a new list, not a stalled one.
  const tableRows = useOptionalDataTableContext()?.getRowModel().rows;
  const progressCount = loadedCount ?? tableRows?.length;
  const lastRowId = tableRows?.[tableRows.length - 1]?.id ?? '';
  const tail = progressCount === undefined ? null : `${progressCount}:${lastRowId}`;
  // Adjusted during render, not in an effect, so the verdict lands in the same
  // commit as the fetch ending — before the observer effect can re-arm.
  const [wasFetching, setWasFetching] = useState(isFetchingNextPage);
  const [tailAtFetchStart, setTailAtFetchStart] = useState<string | null>(null);
  const [stalledTail, setStalledTail] = useState<string | null>(null);
  if (wasFetching !== isFetchingNextPage) {
    setWasFetching(isFetchingNextPage);
    if (isFetchingNextPage) {
      setTailAtFetchStart(tail);
      setStalledTail(null);
    } else if (tail !== null && tail === tailAtFetchStart) {
      setStalledTail(tail);
    }
  }
  // Keyed on the tail it was decided at: rows that change afterwards (a late
  // render, a new search) lift it without anyone having to remember to.
  const isStalled = hasNextPage && !isFetchingNextPage && stalledTail !== null && stalledTail === tail;

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || isStalled) return undefined;
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    // Re-created after every page, which is also what chains the next request
    // when one page was not enough to push the sentinel out of range: a new
    // observer always reports where its target stands.
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) onLoadMoreRef.current();
      },
      { root: findScrollParent(sentinel), rootMargin },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isStalled, rootMargin]);

  return (
    <>
      {isFetchingNextPage && !bodyDrawsRows && (
        <div className={ROW_STACK_CLASSES}>
          <DataTableSkeleton rows={skeletonRows} />
        </div>
      )}
      {isStalled && (
        <div className="flex justify-center pt-[var(--spacing-system-mf)]">
          <Button variant="outline" onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
      {/* The skeleton rows are purely visual, so this is the only signal a
          screen reader gets that the list is growing under it. */}
      <div role="status" className="sr-only">
        {isFetchingNextPage ? 'Loading more results' : ''}
      </div>
      {hasNextPage && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
    </>
  );
}
