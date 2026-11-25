'use client';

import type { Table } from '@tanstack/react-table';
import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect';
import { breakpoints } from '../../../hooks/ui/use-media-query';
import { cn } from '../../../utils/cn';
import { useComposerDockHeight } from '../../navigation/app-layout-context';
import { useMobileActionBarHeight } from '../mobile-action-bar';
import {
  DataTableLayoutContext,
  GRID_PIN_LEFT_VAR,
  GRID_PIN_RIGHT_VAR,
  GRID_PINNED_MAX_SHARE,
  GridGradient,
  GridScrollProvider,
  buildGridLayout,
  createGridScrollController,
  gridGeometryVars,
  gridMinWidth,
  gridRootClass,
  useGridControllerElements,
  type DataTableLayout,
  type GridPinFirstColumn,
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
  /**
   * Grid layout only. When the left block (the checkbox column and the first data column) is pinned. `wide` (default):
   * the rule above, on a desktop with at least 720px of content. `desktop`: on every desktop window (1280px), also in a
   * narrow content column (the Mingo panel docked beside the page), with the first data column drawn at most 40% of the
   * table's width there; a tablet and a phone still scroll it. Only for a table whose pinned action needs the row's
   * name beside it, as the device picker's add button does. See `docs/DATA_TABLE_GRID.md`.
   */
  pinFirstColumn?: GridPinFirstColumn;
}

export function DataTableRoot<T>({
  table,
  children,
  className,
  layout = 'cards',
  maxHeight,
  scrollEndInset,
  settings,
  pinFirstColumn,
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
              pinFirstColumn={pinFirstColumn}
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
  // What `AppLayout` pads its `<main>` by (the floating dock, a phone's action bar). The dock's height is set inside
  // the dock's own ResizeObserver delivery, to land in the dock's frame (CU-17tkuw6633f); `<main>` is the dock's
  // sibling, so a content box changed there would be a notification at the same depth, left undelivered ("loop
  // completed with undelivered notifications"). So the scroll parent is watched on its border box, and a change of
  // these paddings re-measures here instead, in the same commit. Through the measure the observer's effect keeps, not
  // by running that effect again: a new observation made inside the delivery is one more at that depth.
  const dockHeight = useComposerDockHeight();
  const actionBarHeight = useMobileActionBarHeight();
  const measureRef = useRef<(() => void) | null>(null);
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
    measureRef.current = measure;
    window.addEventListener('resize', measure);
    const stop = () => {
      measureRef.current = null;
      window.removeEventListener('resize', measure);
    };
    if (typeof ResizeObserver === 'undefined') return stop;
    const observer = new ResizeObserver(measure);
    observer.observe(parent ?? element.ownerDocument.documentElement, { box: 'border-box' });
    // What sits above the table (a banner, a toolbar that wraps) moves its top without resizing the page.
    for (let node = element.parentElement; node && node !== parent; node = node.parentElement) observer.observe(node);
    return () => {
      observer.disconnect();
      stop();
    };
  }, [element, enabled]);
  useIsomorphicLayoutEffect(() => {
    measureRef.current?.();
  }, [dockHeight, actionBarHeight]);
  return height;
}

/**
 * The most a `desktop` table's first data column is drawn at, in px (`GridLayoutOptions.pinnedCap`):
 * `GRID_PINNED_MAX_SHARE` of the table's width on a desktop window, where that table pins its left block whatever the
 * content's width; `undefined` on a tablet and a phone, where the column scrolls at its own width. Only the width the
 * column is actually drawn at is kept (never above `designed`, never below `least`), so the table renders again only
 * when that width changes, not on every pixel of a window or panel resize. Measured in a layout effect, before the
 * first paint: a picker opened beside a docked panel never shows the column at its designed width first.
 */
function usePinnedCap(
  element: HTMLElement | null,
  enabled: boolean,
  designed: number | undefined,
  least: number,
): number | undefined {
  const [cap, setCap] = useState<number | undefined>(undefined);
  useIsomorphicLayoutEffect(() => {
    // An environment without matchMedia (jsdom) is not a desktop: no cap, the column keeps its width.
    if (!enabled || !element || designed === undefined || typeof window.matchMedia !== 'function') {
      setCap(undefined);
      return undefined;
    }
    const desktop = window.matchMedia(breakpoints.lg);
    const measure = () => {
      if (!desktop.matches) {
        setCap(undefined);
        return;
      }
      // The same width a resize caps a pinned column against (`resizeLimits`).
      const width = element.clientWidth;
      if (width > 0) setCap(Math.min(designed, Math.max(least, Math.floor(width * GRID_PINNED_MAX_SHARE))));
    };
    measure();
    desktop.addEventListener('change', measure);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      desktop.removeEventListener('change', measure);
      observer?.disconnect();
    };
  }, [element, enabled, designed, least]);
  return cap;
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
  pinFirstColumn = 'wide',
}: {
  children: ReactNode;
  className?: string;
  maxHeight?: number | string;
  scrollEndInset?: string;
  settings?: DataTableSettings;
  pinFirstColumn?: GridPinFirstColumn;
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
  // The store follows the key alone: a table that changes its pin rule or its settings keeps the layout it holds
  // (with no `storageKey`, the session's widths and order live only in this store).
  const store = useMemo(() => createGridPrefsStore(storageKey), [storageKey]);
  const prefsContext = useMemo<GridPrefsContextValue>(
    () => ({ store, settingsEnabled, pinFirstColumn }),
    [store, settingsEnabled, pinFirstColumn],
  );
  const prefs = useSyncExternalStore(store.subscribe, store.get, store.getServer);

  // The geometry: rebuilt when a column is resized, hidden or moved, set as variables so no row renders for a resize.
  const table = useDataTableContext();
  const visibleColumns = table.getVisibleFlatColumns();
  const resizingColumnId = useSyncExternalStore(controller.resizing.subscribe, controller.resizing.get, getNoColumn);
  const layout = useMemo(
    () => buildGridLayout(visibleColumns, { ...prefs, settings: settingsEnabled, pinFirstColumn }),
    [visibleColumns, prefs, settingsEnabled, pinFirstColumn],
  );
  // A `desktop` table caps its pinned first data column in a narrow table. The cap is geometry only: the structure the
  // header and the rows render from (`useGridStructure`) never carries a width.
  const [rootElement, setRootElement] = useState<HTMLDivElement | null>(null);
  const pinnedFirst = layout.columns.find(column => column.kind === 'data' && column.pin === 'left');
  const pinnedFirstColumn = pinnedFirst && visibleColumns.find(column => column.id === pinnedFirst.id);
  const pinnedCap = usePinnedCap(
    rootElement,
    pinFirstColumn === 'desktop',
    pinnedFirst?.size,
    pinnedFirstColumn ? gridMinWidth(pinnedFirstColumn) : 0,
  );
  const geometry = useMemo(
    () =>
      gridGeometryVars(
        pinnedCap === undefined
          ? layout
          : buildGridLayout(visibleColumns, { ...prefs, settings: settingsEnabled, pinFirstColumn, pinnedCap }),
        resizingColumnId,
      ),
    [layout, pinnedCap, visibleColumns, prefs, settingsEnabled, pinFirstColumn, resizingColumnId],
  );
  const rootClass = cn('flex w-full flex-col', gridRootClass(pinFirstColumn), className);

  if (!fixed) {
    return (
      <GridProviders scroll={scroll} prefs={prefsContext} settings={settings}>
        <div ref={setRootElement} data-grid-root className={rootClass} style={geometry}>
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
      <div ref={setRootElement} data-grid-root className={rootClass} style={geometry}>
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
