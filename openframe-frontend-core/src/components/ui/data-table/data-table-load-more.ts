'use client';

import { createContext, useContext } from 'react';

/**
 * The channel between `<DataTable.InfiniteFooter>` and `<DataTable.Body>`.
 *
 * The footer knows WHEN a next page is loading; the body knows HOW a row slot is
 * spaced — its own `gap`, the consumer's `rowClassName`, `rowHeightClassName`.
 * The footer used to draw the load-more skeleton itself, as a sibling of the
 * body: outside the body's gap container and without the row classes, so the
 * placeholder rows sat glued together and the page shifted when the real rows
 * replaced them. Teaching the footer the body's spacing would be a second
 * declaration of it at every call site. Instead the footer states a row count
 * here and the body draws those rows inside its OWN container, so they take the
 * body's spacing by construction.
 *
 * A store rather than context state: the two are siblings, the write happens in
 * a layout effect, and `useSyncExternalStore` re-renders the reader before
 * paint — no frame with the rows in the wrong place.
 */
export interface DataTableLoadMoreStore {
  subscribe: (listener: () => void) => () => void;
  /** Skeleton rows the footer is asking for; `0` when no page is loading. */
  getSkeletonRows: () => number;
  setSkeletonRows: (rows: number) => void;
  /**
   * Whether a body is on screen WITH rows to continue. Without one (an empty or
   * still-loading body, or no body at all) the footer keeps drawing its own
   * skeleton, as it always has.
   */
  getHasRowsBody: () => boolean;
  /** Returns the unregister function — hand it straight back from an effect. */
  registerRowsBody: () => () => void;
}

export function createDataTableLoadMoreStore(): DataTableLoadMoreStore {
  const listeners = new Set<() => void>();
  let skeletonRows = 0;
  let rowsBodies = 0;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSkeletonRows: () => skeletonRows,
    setSkeletonRows: rows => {
      if (rows === skeletonRows) return;
      skeletonRows = rows;
      notify();
    },
    getHasRowsBody: () => rowsBodies > 0,
    registerRowsBody: () => {
      rowsBodies += 1;
      notify();
      return () => {
        rowsBodies -= 1;
        notify();
      };
    },
  };
}

/**
 * Inert default, so a footer rendered outside a `<DataTable>` keeps working as
 * a bare sentinel instead of throwing over a channel it has no use for.
 */
const NO_LOAD_MORE_STORE: DataTableLoadMoreStore = {
  subscribe: () => () => {},
  getSkeletonRows: () => 0,
  setSkeletonRows: () => {},
  getHasRowsBody: () => false,
  registerRowsBody: () => () => {},
};

export const DataTableLoadMoreContext = createContext<DataTableLoadMoreStore>(NO_LOAD_MORE_STORE);

export function useDataTableLoadMoreStore(): DataTableLoadMoreStore {
  return useContext(DataTableLoadMoreContext);
}
