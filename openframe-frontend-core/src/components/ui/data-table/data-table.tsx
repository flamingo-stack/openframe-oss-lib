'use client';

import type { Table } from '@tanstack/react-table';
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../../utils/cn';
import {
  DataTableLayoutContext,
  GRID_PIN_LEFT_VAR,
  GRID_PIN_RIGHT_VAR,
  GRID_ROOT_CLASS,
  GridGradient,
  GridScrollProvider,
  buildGridLayout,
  createGridScrollController,
  gridGeometryVars,
  useGridControllerElements,
  type DataTableLayout,
  type GridScroll,
} from './data-table-grid';
import {
  createGridPrefsStore,
  GridPrefsContext,
  GridSettingsContext,
  type DataTableSettings,
  type GridPrefsContextValue,
} from './data-table-grid-prefs';
import { createDataTableLoadMoreStore, DataTableLoadMoreContext } from './data-table-load-more';
import { DataTableMeta } from './data-table-meta';
import './types';

// The context holds the table at its ERASED row type; each `useDataTableContext<T>`
// call re-applies the consumer's own `T` (the sub-components are always
// rendered inside a `<DataTable table={...}>` of that same `T`).
const DataTableContext = createContext<Table<unknown> | null>(null);

export function useDataTableContext<T = unknown>(): Table<T> {
  const ctx = useContext(DataTableContext);
  if (!ctx) {
    throw new Error('<DataTable.Header/Body/...> must be used inside <DataTable table={...}>');
  }
  return ctx as Table<T>;
}

/**
 * The table, or `null` outside a `<DataTable>`. For the one sub-component that
 * has a job to do without a table: `<DataTable.InfiniteFooter>` is still a
 * working scroll sentinel there, it just cannot tell whether a page added rows.
 */
export function useOptionalDataTableContext(): Table<unknown> | null {
  return useContext(DataTableContext);
}

export interface DataTableProps<T> {
  table: Table<T>;
  children: ReactNode;
  className?: string;
  /**
   * `cards` (default): every row is its own card. `grid`: one bordered block of 48px rows with column dividers, pinned
   * columns and horizontal scroll, at every width. The action columns are pinned right everywhere; the first data
   * column (and the checkbox column) is pinned left on a desktop with at least 720px of content (the window's `lg` and
   * the content area's `md`), and scrolls with the rest on a tablet, a phone and in a narrower content column.
   */
  layout?: DataTableLayout;
  /**
   * Grid layout only. A stated height (`360`, `'60vh'`) makes the table its own scroll viewport, both ways, with the
   * header row sticky inside it. `'fill'` takes the height left in the page under the table's top (measured against
   * the nearest scrolling ancestor), so the table scrolls and the page does not. Without it the page scrolls and
   * only the body scrolls sideways.
   */
  maxHeight?: number | string;
  /**
   * Grid layout with `maxHeight`. Room left after the last row inside the scroll viewport, as a CSS length: for a
   * table that runs under something floating over the page's end (`'var(--composer-dock-inset, 0px)'`).
   */
  scrollEndInset?: string;
  /**
   * Grid layout only. Puts the settings gear in the header of the last column: a menu where the viewer hides, shows
   * and reorders the data columns (and switches auto-refresh, when the page offers it). With `storageKey` the layout,
   * resized widths included, is kept in the browser. `{}` is settings with nothing kept.
   */
  settings?: DataTableSettings;
}

export function DataTableRoot<T>({
  table,
  children,
  className,
  layout = 'cards',
  maxHeight,
  scrollEndInset,
  settings,
}: DataTableProps<T>) {
  // One per table: how `<DataTable.InfiniteFooter>` hands its load-more rows to
  // `<DataTable.Body>` — see `data-table-load-more.ts`.
  const [loadMoreStore] = useState(createDataTableLoadMoreStore);

  // Erase the row type on the way in; `useDataTableContext<T>` restores it on
  // the way out. `Table<T>` is invariant in `T`, so this assertion pair is
  // what an erased context costs — it replaces a `Table<any>` context that
  // erased the row type for every consumer, not just at the seam.
  return (
    <DataTableContext.Provider value={table as Table<unknown>}>
      <DataTableLoadMoreContext.Provider value={loadMoreStore}>
        <DataTableLayoutContext.Provider value={layout}>
          {layout === 'grid' ? (
            <DataTableGridRoot
              className={className}
              maxHeight={maxHeight}
              scrollEndInset={scrollEndInset}
              settings={settings}
            >
              {children}
            </DataTableGridRoot>
          ) : (
            <div className={cn('flex w-full flex-col', className)}>{children}</div>
          )}
        </DataTableLayoutContext.Provider>
      </DataTableLoadMoreContext.Provider>
    </DataTableContext.Provider>
  );
}

/** The grid header's height in px: where the fixed-height viewport's top gradient starts. */
const GRID_HEADER_HEIGHT = 48;
/** A `fill` table is never shorter than its header and a few rows, however little the page leaves it. */
const MIN_FILL_HEIGHT = 240;
/** A `fill` table's height where it cannot measure the page: a server render. */
const FILL_HEIGHT_FALLBACK = '70dvh';

const getNoColumn = () => null;

/** The nearest ancestor that scrolls vertically, or `null` when the document does. */
function findScrollParent(element: HTMLElement): HTMLElement | null {
  const { body, documentElement } = element.ownerDocument;
  for (let node = element.parentElement; node && node !== body && node !== documentElement; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
  }
  return null;
}

/**
 * The height left for a `fill` table: from its top to the end of its scrolling ancestor, less the bottom paddings in
 * between (the page's own end spacing). Measured before the table's first paint, so it is never drawn at the fallback
 * height, and again whenever the page or what is above the table changes size.
 */
function useFillHeight(element: HTMLDivElement | null, enabled: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);
  // A layout effect: its first measure lands in the same commit, before the browser paints. In a passive effect (or
  // from the observer's first report) the table was painted once at the fallback height on every mount, and its
  // bottom edge jumped a frame later.
  useIsomorphicLayoutEffect(() => {
    if (!enabled || !element) return undefined;
    const parent = findScrollParent(element);
    const measure = () => {
      const parentTop = parent ? parent.getBoundingClientRect().top : 0;
      const parentHeight = parent ? parent.clientHeight : window.innerHeight;
      const scrolled = parent ? parent.scrollTop : window.scrollY;
      let paddingBelow = 0;
      for (let node = element.parentElement; node; node = node.parentElement) {
        paddingBelow += Number.parseFloat(getComputedStyle(node).paddingBottom) || 0;
        if (node === parent || node === element.ownerDocument.body) break;
      }
      const top = element.getBoundingClientRect().top - parentTop + scrolled;
      setHeight(Math.max(MIN_FILL_HEIGHT, Math.floor(parentHeight - top - paddingBelow)));
    };
    measure();
    window.addEventListener('resize', measure);
    if (typeof ResizeObserver === 'undefined') return () => window.removeEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    observer.observe(parent ?? element.ownerDocument.documentElement);
    // What sits above the table (a banner, a toolbar that wraps) moves its top without resizing the page.
    for (let node = element.parentElement; node && node !== parent; node = node.parentElement) observer.observe(node);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [element, enabled]);
  return height;
}

/**
 * The root of a grid table: it owns the table's scroll state and its geometry (the columns' widths and pins, as CSS
 * variables every cell reads). With `maxHeight` it is also the one scroll viewport that wraps header, body and footers
 * (so an infinite footer's sentinel is inside it), with `<DataTable.Meta>` kept above.
 */
function DataTableGridRoot({
  children,
  className,
  maxHeight,
  scrollEndInset,
  settings,
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: number | string;
  scrollEndInset?: string;
  settings?: DataTableSettings;
}) {
  const fixed = maxHeight !== undefined;
  const fill = maxHeight === 'fill';
  // One controller per mode: a table that gains or loses its stated height starts a new scroll state.
  const scroll = useMemo<GridScroll>(
    () => ({ mode: fixed ? 'fixed' : 'page', controller: createGridScrollController(fixed) }),
    [fixed],
  );
  const { controller } = scroll;
  const { viewportRef, onViewportScroll } = useGridControllerElements(controller);
  const [viewport, setViewportElement] = useState<HTMLDivElement | null>(null);
  const setViewport = useCallback(
    (element: HTMLDivElement | null) => {
      viewportRef(element);
      setViewportElement(element);
    },
    [viewportRef],
  );
  const fillHeight = useFillHeight(viewport, fill);

  // The viewer's column layout (hidden, order, widths): one store per table, kept in the browser under the table's
  // `storageKey`.
  const settingsEnabled = settings !== undefined;
  const storageKey = settings?.storageKey;
  const prefsContext = useMemo<GridPrefsContextValue>(
    () => ({ store: createGridPrefsStore(storageKey), settingsEnabled }),
    [storageKey, settingsEnabled],
  );
  const { store } = prefsContext;
  const prefs = useSyncExternalStore(store.subscribe, store.get, store.getServer);

  // The geometry: rebuilt when a column is resized, hidden or moved, set as variables so no row renders for a resize.
  const table = useDataTableContext();
  const visibleColumns = table.getVisibleFlatColumns();
  const resizingColumnId = useSyncExternalStore(controller.resizing.subscribe, controller.resizing.get, getNoColumn);
  const geometry = useMemo(
    () => gridGeometryVars(buildGridLayout(visibleColumns, { ...prefs, settings: settingsEnabled }), resizingColumnId),
    [visibleColumns, prefs, settingsEnabled, resizingColumnId],
  );

  if (!fixed) {
    return (
      <GridProviders scroll={scroll} prefs={prefsContext} settings={settings}>
        <div data-grid-root className={cn('flex w-full flex-col', GRID_ROOT_CLASS, className)} style={geometry}>
          {children}
        </div>
      </GridProviders>
    );
  }

  const parts = Children.toArray(children);
  const isMeta = (child: ReactNode) => isValidElement(child) && child.type === DataTableMeta;
  const maxHeightValue = fill
    ? fillHeight === null
      ? FILL_HEIGHT_FALLBACK
      : `${fillHeight}px`
    : typeof maxHeight === 'number'
      ? `${maxHeight}px`
      : maxHeight;
  return (
    <GridProviders scroll={scroll} prefs={prefsContext} settings={settings}>
      <div data-grid-root className={cn('flex w-full flex-col', GRID_ROOT_CLASS, className)} style={geometry}>
        {parts.filter(isMeta)}
        <div className="relative overflow-hidden rounded-md border border-ods-border bg-ods-card">
          <div
            ref={setViewport}
            className="max-h-[var(--data-table-max-height)] overflow-auto"
            style={{ '--data-table-max-height': maxHeightValue } as CSSProperties}
            onScroll={onViewportScroll}
          >
            {parts.filter(child => !isMeta(child))}
            {scrollEndInset && <div aria-hidden style={{ height: scrollEndInset }} />}
          </div>
          <GridGradient edge="left" offset={GRID_PIN_LEFT_VAR} />
          <GridGradient edge="right" offset={GRID_PIN_RIGHT_VAR} />
          <GridGradient edge="top" top={GRID_HEADER_HEIGHT} />
          <GridGradient edge="bottom" />
        </div>
      </div>
    </GridProviders>
  );
}

/** What every part of a grid table reads: its scroll state, its column layout, its settings. */
function GridProviders({
  scroll,
  prefs,
  settings,
  children,
}: {
  scroll: GridScroll;
  prefs: GridPrefsContextValue;
  settings: DataTableSettings | undefined;
  children: ReactNode;
}) {
  return (
    <GridScrollProvider value={scroll}>
      <GridPrefsContext.Provider value={prefs}>
        <GridSettingsContext.Provider value={settings ?? null}>{children}</GridSettingsContext.Provider>
      </GridPrefsContext.Provider>
    </GridScrollProvider>
  );
}
