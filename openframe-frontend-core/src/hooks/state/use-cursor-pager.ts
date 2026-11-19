/**
 * useCursorPager - a cursor-paged table whose position lives in the URL.
 *
 * The URL carries the page's `cursor` (the previous page's `pageInfo.endCursor`), a display-only `page` index (it labels
 * the range "21–40", nothing reads rows by it) and, on lists that page back on the server, `dir=before`. All three are
 * prefixed like the table's other params (`useApiParams` `prefix`).
 *
 * - Next pushes a history entry, so the browser's Back pages back by itself.
 * - Previous is `history.back()` when the Navigation API shows the entry behind this one IS this table's previous
 *   page (same path, same params, page - 1). Otherwise page 2 goes to the first page, and a list with `serverPrev`
 *   asks the server for the page before `startCursor`. With neither, Previous is off and First is the way back.
 * - The table's filters clear the pager in the same URL write: give their `useApiParams` `resetKeys:
 *   CURSOR_PAGER_KEYS` (and `resetHistory: 'push'`). `resetOn` is the safety net for anything else: a cursor whose
 *   filters changed under it is never sent, and is dropped from the URL.
 *
 * @example
 * const pager = useCursorPager({ prefix: 'cve', pageSize: 20, resetOn: filtersKey });
 * const data = useLazyLoadQuery(query, { ...filters, ...pager.variables });
 * <DataTable.CursorFooter {...pager.footerProps(data.list.pageInfo)} totalCount={data.list.filteredCount} />
 */

'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ParamSchema } from '../../utils/search-params';
import { prefixedParamName, useApiParams } from './use-api-params';

/** The pager's own URL keys (schema-style; prefixed in the URL). Pass them as the filters' `resetKeys`. */
export const CURSOR_PAGER_KEYS = ['cursor', 'page', 'dir'] as const;

const PAGER_SCHEMA = {
  cursor: { type: 'string' },
  page: { type: 'int', min: 1 },
  dir: { type: 'string' },
} satisfies ParamSchema;

export interface UseCursorPagerOptions {
  /** The table's URL prefix (the same one its filters use). */
  prefix?: string;
  /** Rows per page (the query's `first` / `last`). */
  pageSize: number;
  /** The list pages back on the server (`last` / `before` return the page before the cursor, in display order). */
  serverPrev?: boolean;
  /**
   * The list's `hasPreviousPage` is trustworthy: `false` on page 2+ means the server ignored the cursor and answered
   * page 1 (see {@link isStaleCursorPage}).
   */
  reliableHasPrev?: boolean;
  /**
   * Content key of everything a cursor depends on (filters, search, sort). A cursor that stays in the URL while this
   * changes was issued under other filters: it is not sent, and it is dropped.
   */
  resetOn?: string;
}

/** The part of a Relay `pageInfo` the pager reads. */
export interface CursorPageInfo {
  hasNextPage: boolean;
  hasPreviousPage?: boolean | null;
  startCursor?: string | null;
  endCursor?: string | null;
}

/** Query variables for the current page. Unused keys are `null`, so a query may declare all four. */
export type CursorPagerVariables =
  | { first: number; after: string | null; last: null; before: null }
  | { first: null; after: null; last: number; before: string };

export interface CursorPagerFooterProps {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isFirstPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
  rangeStart: number | undefined;
  onNext: (cursor: string) => void;
  onPrevious: (cursor: string) => void;
  onFirst: () => void;
}

export interface UseCursorPagerReturn {
  /** The cursor the current page is read with (`null` on the first page, and for a cursor issued under other filters). */
  cursor: string | null;
  /** 1-based display index; `undefined` when the URL has a cursor but no page (an old or hand-made link). */
  page: number | undefined;
  /** The page was read backward (`last` / `before`). */
  backward: boolean;
  isFirstPage: boolean;
  /** 1-based position of the page's first row, for the range text; `undefined` when unknown. */
  rangeStart: number | undefined;
  /** Spread into the query variables. */
  variables: CursorPagerVariables;
  /** The entry behind this one is this table's previous page: Previous is `history.back()`. */
  canGoBackInHistory: boolean;
  goNext: (endCursor: string) => void;
  goPrevious: (startCursor?: string | null) => void;
  goFirst: () => void;
  /** Leave the cursor (a stale or tampered one) without a history entry: the table shows its first page. */
  dropCursor: () => void;
  /** Props for `CursorPagination` / `DataTable.CursorFooter`, from the page's `pageInfo`. */
  footerProps: (pageInfo: CursorPageInfo | null | undefined) => CursorPagerFooterProps;
  /** The page that came back cannot be the one the cursor asked for ({@link isStaleCursorPage}): drop the cursor. */
  isStale: (pageInfo: CursorPageInfo | null | undefined, rowCount: number) => boolean;
  /** The pager's keys, for the filters' `useApiParams` `resetKeys`. */
  resetKeys: typeof CURSOR_PAGER_KEYS;
}

/**
 * The page answered with rows that cannot be the page the cursor asked for: the server ignored or rejected the cursor
 * and answered (or would answer) its first page. True for an empty page 2+, and, on lists whose `hasPreviousPage` is
 * reliable, for a forward page 2+ that says it has nothing before it. Transport errors are NOT a stale cursor.
 */
export function isStaleCursorPage({
  cursor,
  backward = false,
  rowCount,
  pageInfo,
  reliableHasPrev = false,
}: {
  cursor: string | null;
  backward?: boolean;
  rowCount: number;
  pageInfo: CursorPageInfo | null | undefined;
  reliableHasPrev?: boolean;
}): boolean {
  if (!cursor) return false;
  if (rowCount === 0) return true;
  return reliableHasPrev && !backward && pageInfo?.hasPreviousPage === false;
}

// ── Navigation API (Chrome 102+, Safari 26+): read defensively, it is not in every TS `lib.dom` ─────────────────────

interface NavigationEntryLike {
  url: string | null;
  index: number;
}

interface NavigationLike {
  currentEntry?: NavigationEntryLike | null;
  entries?: () => NavigationEntryLike[];
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function readNavigation(): NavigationLike | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { navigation?: NavigationLike }).navigation;
}

/** The URL of the history entry behind the current one, or `null` (none, another document, or no Navigation API). */
export function previousHistoryEntryUrl(): string | null {
  const navigation = readNavigation();
  const current = navigation?.currentEntry;
  if (!current || typeof navigation.entries !== 'function' || current.index <= 0) return null;
  return navigation.entries()[current.index - 1]?.url ?? null;
}

function subscribeNavigation(onChange: () => void): () => void {
  const navigation = readNavigation();
  if (navigation?.addEventListener) {
    navigation.addEventListener('currententrychange', onChange);
    return () => navigation.removeEventListener?.('currententrychange', onChange);
  }
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

/** Every param of a query string except the pager's own, in a canonical order. */
function withoutPagerKeys(search: URLSearchParams, prefix: string): string {
  const rest = new URLSearchParams(search);
  for (const key of CURSOR_PAGER_KEYS) rest.delete(prefixedParamName(prefix, key));
  rest.sort();
  return rest.toString();
}

/**
 * `previousUrl` is this table's page `page - 1`: the same path and the same params (the entity id and the filters
 * included), only the pager's keys differ, and its page index is one less.
 */
export function isPreviousPageEntry(
  previousUrl: string | null,
  currentUrl: string,
  prefix: string,
  page: number | undefined,
): boolean {
  if (!previousUrl || page === undefined || page < 2) return false;
  let previous: URL;
  let current: URL;
  try {
    previous = new URL(previousUrl);
    current = new URL(currentUrl);
  } catch {
    return false;
  }
  if (previous.origin !== current.origin || previous.pathname !== current.pathname) return false;
  if (withoutPagerKeys(previous.searchParams, prefix) !== withoutPagerKeys(current.searchParams, prefix)) return false;
  const previousCursor = previous.searchParams.get(prefixedParamName(prefix, 'cursor'));
  const previousPage = previousCursor ? Number(previous.searchParams.get(prefixedParamName(prefix, 'page'))) : 1;
  return previousPage === page - 1;
}

export function useCursorPager({
  prefix = '',
  pageSize,
  serverPrev = false,
  reliableHasPrev = false,
  resetOn,
}: UseCursorPagerOptions): UseCursorPagerReturn {
  const { params, setParams } = useApiParams(PAGER_SCHEMA, { prefix });
  const urlCursor = params.cursor ? params.cursor : null;

  // The filters a cursor was issued under. A cursor that changed came from a page move (or a link), so it belongs to
  // the current filters; the filters changing under an UNCHANGED cursor make it foreign. "Adjust state while
  // rendering": the anchor must come from a committed render, never from a discarded attempt.
  const [anchor, setAnchor] = useState<{ cursor: string | null; resetOn: string | undefined }>({
    cursor: urlCursor,
    resetOn,
  });
  if (anchor.cursor !== urlCursor) setAnchor({ cursor: urlCursor, resetOn });
  const foreign = urlCursor !== null && anchor.cursor === urlCursor && anchor.resetOn !== resetOn;

  const cursor = foreign ? null : urlCursor;
  const page = cursor ? params.page : 1;
  const backward = !!cursor && serverPrev && params.dir === 'before';
  const isFirstPage = cursor === null;
  const rangeStart = page === undefined ? undefined : (page - 1) * pageSize + 1;

  const canGoBackInHistory = useSyncExternalStore(
    subscribeNavigation,
    () => isPreviousPageEntry(previousHistoryEntryUrl(), window.location.href, prefix, page),
    () => false,
  );

  const goFirst = useCallback(() => {
    setParams({ cursor: null, page: null, dir: null }, { history: 'push' });
  }, [setParams]);

  const dropCursor = useCallback(() => {
    setParams({ cursor: null, page: null, dir: null }, { history: 'replace' });
  }, [setParams]);

  const goNext = useCallback(
    (endCursor: string) => {
      if (!endCursor) return;
      setParams({ cursor: endCursor, page: page === undefined ? null : page + 1, dir: null }, { history: 'push' });
    },
    [setParams, page],
  );

  const goPrevious = useCallback(
    (startCursor?: string | null) => {
      if (canGoBackInHistory) {
        window.history.back();
        return;
      }
      if (page === 2) {
        goFirst();
        return;
      }
      if (serverPrev && startCursor) {
        setParams(
          { cursor: startCursor, page: page === undefined ? null : page - 1, dir: 'before' },
          { history: 'push' },
        );
      }
    },
    [canGoBackInHistory, page, serverPrev, setParams, goFirst],
  );

  // The safety net: a cursor issued under other filters leaves the URL (without a history entry).
  useEffect(() => {
    if (foreign) dropCursor();
  }, [foreign, dropCursor]);

  const variables = useMemo(
    (): CursorPagerVariables =>
      backward && cursor
        ? { first: null, after: null, last: pageSize, before: cursor }
        : { first: pageSize, after: cursor, last: null, before: null },
    [backward, cursor, pageSize],
  );

  const footerProps = useCallback(
    (pageInfo: CursorPageInfo | null | undefined): CursorPagerFooterProps => {
      const startCursor = pageInfo?.startCursor ?? null;
      return {
        // A page read backward always has the page it came from after it.
        hasNextPage: backward ? true : !!pageInfo?.hasNextPage,
        hasPreviousPage:
          !isFirstPage && (canGoBackInHistory || page === 2 || (serverPrev && !!startCursor && page !== 1)),
        isFirstPage,
        startCursor,
        endCursor: pageInfo?.endCursor ?? null,
        rangeStart,
        onNext: goNext,
        onPrevious: goPrevious,
        onFirst: goFirst,
      };
    },
    [backward, isFirstPage, canGoBackInHistory, page, serverPrev, rangeStart, goNext, goPrevious, goFirst],
  );

  const isStale = useCallback(
    (pageInfo: CursorPageInfo | null | undefined, rowCount: number) =>
      isStaleCursorPage({ cursor, backward, rowCount, pageInfo, reliableHasPrev }),
    [cursor, backward, reliableHasPrev],
  );

  return {
    cursor,
    page,
    backward,
    isFirstPage,
    rangeStart,
    variables,
    canGoBackInHistory,
    goNext,
    goPrevious,
    goFirst,
    dropCursor,
    footerProps,
    isStale,
    resetKeys: CURSOR_PAGER_KEYS,
  };
}
