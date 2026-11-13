'use client';

import type { Column } from '@tanstack/react-table';
import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type CSSProperties,
  type UIEvent,
  type WheelEvent,
} from 'react';
import { cn } from '../../../utils/cn';
import { GRID_ACTION_COLUMN_SIZE } from './data-table-grid-columns';
import { alignJustify } from './utils';

/**
 * The table's two layouts. `cards` (default): every row is its own card. `grid`: one bordered block of 48px rows with
 * column dividers, pinned columns and horizontal scroll, at every width (a grid table has no card form).
 */
export type DataTableLayout = 'cards' | 'grid';

export const DataTableLayoutContext = createContext<DataTableLayout>('cards');

export function useDataTableLayout(): DataTableLayout {
  return useContext(DataTableLayoutContext);
}

/* ───────────────────────────── column geometry ───────────────────────────── */

export type GridColumnKind = 'select' | 'data' | 'action' | 'filler';

export interface GridColumn {
  id: string;
  /** The column's place in the grid's own order: what its CSS variables are named after (`--dtc<index>-w`). */
  index: number;
  kind: GridColumnKind;
  /** Width in px (a filler has none: it takes the whole free width). */
  size: number;
  pin?: 'left' | 'right';
  /** A pinned column's distance from its edge of the scroll viewport, in px. */
  offset: number;
  /** The first column of the pinned-right block: it carries the block's inner divider. */
  startsRightBlock: boolean;
  /** An action column with another action column after it: it carries the divider between the two. */
  dividedRight: boolean;
  /**
   * The last data column: it takes the free width when the columns are narrower than the table, so the table has no
   * empty column before its actions. Its `size` is then its least width.
   */
  grow: boolean;
  /** The table's last column when it has settings: its header cell holds the gear that opens the settings menu. */
  settings: boolean;
  align?: 'left' | 'center' | 'right';
}

export interface GridLayout {
  columns: GridColumn[];
  /**
   * Summed width of the columns pinned to each side, in px: where the horizontal gradients start. The left block is
   * pinned on a desktop with room for it only (see `GRID_LEFT_PIN_CLASS`).
   */
  pinnedLeft: number;
  pinnedRight: number;
}

/**
 * The filler is not a table column: it is the free width of a table that has no data column to give it to (selection
 * and actions only). With data columns the last of them takes the free width (`GridColumn.grow`).
 */
export const GRID_FILLER_ID = '__grid-filler';

/** The settings column of a table that has settings and no action column: its header cell holds the gear. */
export const GRID_SETTINGS_ID = '__grid-settings';

export interface GridLayoutOptions {
  /** Widths the viewer set, in px, by column id. A column without one keeps its designed size. */
  sizing?: Record<string, number>;
  /** Data column ids in the viewer's order (see `mergeColumnOrder`). */
  order?: string[];
  /** Data column ids the viewer hid. */
  hidden?: string[];
  /** The table has settings: its last column's header is the gear. */
  settings?: boolean;
}

/**
 * The designed order with the viewer's order laid over it. Columns the viewer ordered come in that order; a column
 * the viewer's list does not name (it was added to the table later) goes after the column it follows by design, so
 * a new column appears where it was designed and not at the end. Ids the table does not have are dropped.
 */
export function mergeColumnOrder(designed: string[], saved: string[] | undefined): string[] {
  if (!saved?.length) return designed;
  const known = new Set(designed);
  const result = saved.filter((id, index) => known.has(id) && saved.indexOf(id) === index);
  const placed = new Set(result);
  for (const [index, id] of designed.entries()) {
    if (placed.has(id)) continue;
    // After the nearest column before it by design that is already placed; first when there is none.
    let at = 0;
    for (let before = index - 1; before >= 0; before -= 1) {
      const found = result.indexOf(designed[before]);
      if (found !== -1) {
        at = found + 1;
        break;
      }
    }
    result.splice(at, 0, id);
    placed.add(id);
  }
  return result;
}

/**
 * The grid's column order and pinning, THE table's rule rather than each screen's choice: selection columns first and
 * pinned left with the first data column, action columns last and pinned right. The last data column takes the free
 * width. The viewer's layout (`order`, `hidden`, `sizing`) applies to the data columns only.
 */
export function buildGridLayout<T>(
  visibleColumns: Column<T, unknown>[],
  { sizing, order, hidden, settings = false }: GridLayoutOptions = {},
): GridLayout {
  const select: GridColumn[] = [];
  const designed: GridColumn[] = [];
  const action: GridColumn[] = [];
  for (const column of visibleColumns) {
    const meta = column.columnDef.meta;
    const kind: GridColumnKind = meta?.gridKind ?? 'data';
    const entry: GridColumn = {
      id: column.id,
      index: 0,
      kind,
      // A resized column's width is read from the viewer's layout when the caller hands it in: that is the value
      // that changes, where the column object itself never does.
      size: (kind === 'data' ? sizing?.[column.id] : undefined) ?? column.getSize(),
      offset: 0,
      startsRightBlock: false,
      dividedRight: false,
      grow: false,
      settings: false,
      align: meta?.align,
    };
    (kind === 'select' ? select : kind === 'action' ? action : designed).push(entry);
  }

  const byId = new Map(designed.map(column => [column.id, column]));
  const ordered = mergeColumnOrder(
    designed.map(column => column.id),
    order,
  ).map(id => byId.get(id) as GridColumn);
  const hiddenIds = new Set(hidden);
  const shown = ordered.filter(column => !hiddenIds.has(column.id));
  // A stored layout that hides every column the table now has would leave a table of nothing: it is not applied.
  const data = shown.length > 0 ? shown : ordered;

  if (settings) {
    if (action.length === 0) {
      action.push({
        id: GRID_SETTINGS_ID,
        index: 0,
        kind: 'action',
        size: GRID_ACTION_COLUMN_SIZE,
        offset: 0,
        startsRightBlock: false,
        dividedRight: false,
        grow: false,
        settings: false,
      });
    }
    action[action.length - 1].settings = true;
  }

  let pinnedLeft = 0;
  for (const column of [...select, ...data.slice(0, 1)]) {
    column.pin = 'left';
    column.offset = pinnedLeft;
    pinnedLeft += column.size;
  }
  let pinnedRight = 0;
  for (const column of [...action].reverse()) {
    column.pin = 'right';
    column.offset = pinnedRight;
    pinnedRight += column.size;
  }
  const firstAction = action[0];
  if (firstAction) firstAction.startsRightBlock = true;
  // Each action is a column of its own (the design's `column / more`, `column / open`): a divider between every two.
  for (const column of action.slice(0, -1)) column.dividedRight = true;

  const filler: GridColumn = {
    id: GRID_FILLER_ID,
    index: 0,
    kind: 'filler',
    size: 0,
    offset: 0,
    startsRightBlock: false,
    dividedRight: false,
    grow: false,
    settings: false,
  };
  const lastData = data[data.length - 1];
  if (lastData) lastData.grow = true;
  const columns = lastData ? [...select, ...data, ...action] : [...select, filler, ...action];
  for (const [index, column] of columns.entries()) column.index = index;
  return { columns, pinnedLeft, pinnedRight };
}

/**
 * The left block (the checkbox column and the first data column) is pinned on a desktop with room for it: the WINDOW
 * is at its `lg` step (1280px) AND the content area is at its `md` step (720px). Two conditions, because they say
 * different things:
 * - the window says which device it is. A tablet and a phone never pin the block, whatever the content's width, so
 *   the content area's `lg` cannot be the rule: in a three-column shell a desktop's page column is a tablet's width
 *   (about 900px in a 1440px window), and the column stays pinned there.
 * - the content area says whether there is room. Under 720px of content a desktop page lays out as a phone's (the
 *   mobile type scale, the compact page actions), and a pinned column would leave the others almost no width.
 * Outside a content area `content-md` falls back to the window's `md`, which `lg` already implies. The action columns
 * are pinned right at every width.
 */
const GRID_LEFT_PIN_CLASS = 'lg:content-md:sticky lg:content-md:z-[1]';

/**
 * On the grid's root: the left gradient starts at the pinned-left block's edge where that block is pinned (the rule
 * of `GRID_LEFT_PIN_CLASS`), and at the viewport's own edge where it is not.
 */
export const GRID_ROOT_CLASS = '[--dt-pin-l:0px] lg:content-md:[--dt-pin-l:var(--dt-pin-l-wide)]';

/** One grid row, header or body: as wide as its columns, never narrower than the viewport. */
export const GRID_ROW_CLASS = 'flex w-max min-w-full';

/** A grid cell's box: 48px, its dividers, its fill, and its pin. The content goes inside. */
export function gridCellClass(column: GridColumn, section: 'header' | 'body'): string {
  return cn(
    'flex h-12 items-center border-b border-ods-border',
    section === 'header'
      ? 'bg-ods-bg transition-colors duration-200'
      : 'bg-ods-card transition-colors group-hover/gridrow:bg-ods-bg-hover',
    // `grow`: at least its own width (the basis is the cell's `width`), and the free width on top of it.
    column.kind === 'filler' ? 'min-w-0 flex-1' : column.grow ? 'flex-auto shrink-0' : 'flex-none',
    column.kind === 'data' &&
      cn(
        'min-w-0 gap-[var(--spacing-system-xsf)] overflow-hidden border-r px-[var(--spacing-system-sf)]',
        alignJustify(column.align),
      ),
    column.kind === 'select' && 'justify-center border-r',
    column.kind === 'action' && 'justify-center',
    column.pin === 'right' && 'sticky z-[1]',
    column.pin === 'left' && GRID_LEFT_PIN_CLASS,
    // The pinned-right block's inner divider. It overlaps the column before it by its own 1px, so where that column
    // ends in a divider of its own the two read as one line.
    column.startsRightBlock && '-ml-px border-l',
    column.dividedRight && 'border-r',
  );
}

/**
 * A grid cell's width and pin, read from the table's CSS variables rather than written as numbers: a column that is
 * being resized changes one variable on the table's root, and no row is rendered again for it.
 */
export function gridCellStyle(column: GridColumn): CSSProperties | undefined {
  if (column.kind === 'filler') return undefined;
  const name = `--dtc${column.index}`;
  return {
    width: `var(${name}-w)`,
    ...(column.pin === 'left' ? { left: `var(${name}-o)` } : {}),
    ...(column.pin === 'right' ? { right: `var(${name}-o)` } : {}),
    // The resize guide: a 2px accent line down the column's edge while it is being dragged (`-g` is 1 then).
    ...(column.kind === 'data'
      ? { boxShadow: `inset calc(var(${name}-g, 0) * -2px) 0 0 var(--color-accent-primary)` }
      : {}),
  };
}

/** Where the horizontal gradients start: the pinned blocks' widths, as the table's variables. */
export const GRID_PIN_LEFT_VAR = 'var(--dt-pin-l)';
export const GRID_PIN_RIGHT_VAR = 'var(--dt-pin-r)';

/**
 * The table's geometry as CSS variables, set on the grid's root: each column's width, each pinned column's offset,
 * the pinned blocks' widths, and which column is being resized.
 */
export function gridGeometryVars(layout: GridLayout, resizingColumnId: string | null): CSSProperties {
  const vars: Record<string, string> = {
    // Read through `--dt-pin-l`, which the root's class sets to this where the left block is pinned and to 0 where it
    // is not (`GRID_ROOT_CLASS`).
    '--dt-pin-l-wide': `${layout.pinnedLeft}px`,
    '--dt-pin-r': `${layout.pinnedRight}px`,
  };
  for (const column of layout.columns) {
    if (column.kind === 'filler') continue;
    const name = `--dtc${column.index}`;
    vars[`${name}-w`] = `${column.size}px`;
    if (column.pin) vars[`${name}-o`] = `${column.offset}px`;
    if (column.id === resizingColumnId) vars[`${name}-g`] = '1';
  }
  return vars;
}

/* ───────────────────────────── scroll ───────────────────────────── */

/** Which edges of the scroll viewport have more content behind them, as bits (a stable snapshot for the store). */
const EDGE = { left: 1, right: 2, top: 4, bottom: 8 } as const;
export type GridEdge = keyof typeof EDGE;

function readEdges(element: HTMLElement, vertical: boolean): number {
  let edges = 0;
  if (element.scrollLeft > 0) edges |= EDGE.left;
  if (element.scrollWidth - element.scrollLeft - element.clientWidth > 1) edges |= EDGE.right;
  if (vertical) {
    if (element.scrollTop > 0) edges |= EDGE.top;
    if (element.scrollHeight - element.scrollTop - element.clientHeight > 1) edges |= EDGE.bottom;
  }
  return edges;
}

interface EdgeStore {
  subscribe: (listener: () => void) => () => void;
  get: () => number;
  set: (edges: number) => void;
}

function createEdgeStore(): EdgeStore {
  const listeners = new Set<() => void>();
  let edges = 0;
  return {
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => edges,
    set: next => {
      if (next === edges) return;
      edges = next;
      for (const listener of listeners) listener();
    },
  };
}

const getNoEdges = () => 0;

/**
 * One table's scroll state: which elements scroll, and which edges have more content. A plain object made once per
 * table (not React state or refs): its elements are written by ref callbacks and read inside scroll events only, and
 * the one thing a render reads, the edges, is a store with its own subscription.
 */
/** A value with subscribers: what a render reads through `useSyncExternalStore`. */
export interface ValueStore<T> {
  subscribe: (listener: () => void) => () => void;
  get: () => T;
  set: (value: T) => void;
}

function createValueStore<T>(initial: T): ValueStore<T> {
  const listeners = new Set<() => void>();
  let value = initial;
  return {
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get: () => value,
    set: next => {
      if (Object.is(next, value)) return;
      value = next;
      for (const listener of listeners) listener();
    },
  };
}

export interface GridScrollController {
  edges: EdgeStore;
  /** The id of the column being resized, or `null`: the root draws its guide, its header its accent handle. */
  resizing: ValueStore<string | null>;
  /** Page mode: the header's own viewport, kept at the body's `scrollLeft`. */
  setHeaderViewport: (element: HTMLDivElement | null) => void;
  /** The element that scrolls horizontally: the body (page mode) or the table's one viewport (fixed mode). */
  setViewport: (element: HTMLDivElement | null) => void;
  onViewportScroll: (event: UIEvent<HTMLDivElement>) => void;
  /** Page mode: a horizontal wheel over the header (its viewport does not scroll itself) moves the body. */
  onHeaderWheel: (event: WheelEvent<HTMLDivElement>) => void;
  /**
   * Page mode: the header's viewport is `overflow: hidden`, but it still scrolls when a control inside it is focused
   * or scrolled into view (Tab to a filter that is off-screen). The body follows, so the two never part.
   */
  onHeaderScroll: (event: UIEvent<HTMLDivElement>) => void;
}

/**
 * Header and body are two viewports in page mode, because a header that is `sticky` to the page cannot live inside the
 * body's horizontal scroll container (an `overflow-x` box is a scroll container on both axes): the body's position is
 * written to the header inside the scroll event, before the frame is painted.
 *
 * `vertical`: the viewport also scrolls vertically (fixed-height mode), so the top and bottom edges are tracked too.
 */
export function createGridScrollController(vertical: boolean): GridScrollController {
  const edges = createEdgeStore();
  let header: HTMLDivElement | null = null;
  let viewport: HTMLDivElement | null = null;
  let observer: ResizeObserver | null = null;

  const measure = () => {
    if (viewport) edges.set(readEdges(viewport, vertical));
  };

  return {
    edges,
    resizing: createValueStore<string | null>(null),
    setHeaderViewport: element => {
      header = element;
      if (header && viewport) header.scrollLeft = viewport.scrollLeft;
    },
    setViewport: element => {
      observer?.disconnect();
      observer = null;
      viewport = element;
      if (!element) return;
      measure();
      // The edges are also a matter of size: rows arriving, a column appearing or the page resizing changes what is
      // left to scroll without a scroll event.
      if (typeof ResizeObserver === 'undefined') return;
      observer = new ResizeObserver(measure);
      observer.observe(element);
      for (const child of Array.from(element.children)) observer.observe(child);
    },
    onViewportScroll: event => {
      const element = event.currentTarget;
      if (header && header.scrollLeft !== element.scrollLeft) header.scrollLeft = element.scrollLeft;
      edges.set(readEdges(element, vertical));
    },
    onHeaderWheel: event => {
      if (viewport && event.deltaX !== 0) viewport.scrollLeft += event.deltaX;
    },
    onHeaderScroll: event => {
      const left = event.currentTarget.scrollLeft;
      // The body's own scroll event then measures the edges; equal positions end the exchange.
      if (viewport && viewport.scrollLeft !== left) viewport.scrollLeft = left;
    },
  };
}

export interface GridScroll {
  /**
   * `page`: the page scrolls vertically, the header is sticky to the page and the body is the horizontal scroller.
   * `fixed`: one viewport of a stated height scrolls both ways, the header row sticky inside it.
   */
  mode: 'page' | 'fixed';
  controller: GridScrollController;
}

const GridScrollContext = createContext<GridScroll | null>(null);
export const GridScrollProvider = GridScrollContext.Provider;

export function useGridScroll(): GridScroll {
  const scroll = useContext(GridScrollContext);
  if (!scroll) throw new Error('A grid table part must be used inside <DataTable layout="grid">');
  return scroll;
}

/**
 * The grid's element hooks as plain callbacks, for a `ref` and its handlers: the controller's own methods, each behind
 * a stable function, so a component passes callbacks to its elements and never reads the controller while it renders.
 */
export function useGridScrollElements() {
  const { controller } = useGridScroll();
  return useGridControllerElements(controller);
}

export function useGridControllerElements(controller: GridScrollController) {
  const viewportRef = useCallback((element: HTMLDivElement | null) => controller.setViewport(element), [controller]);
  const headerViewportRef = useCallback(
    (element: HTMLDivElement | null) => controller.setHeaderViewport(element),
    [controller],
  );
  const onViewportScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => controller.onViewportScroll(event),
    [controller],
  );
  const onHeaderWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => controller.onHeaderWheel(event),
    [controller],
  );
  const onHeaderScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => controller.onHeaderScroll(event),
    [controller],
  );
  return { viewportRef, headerViewportRef, onViewportScroll, onHeaderWheel, onHeaderScroll };
}

/**
 * A 40px shade on one edge of the scroll viewport, shown only while there is more content behind that edge: the
 * design's `scroll-gradient`, as the table spec places it (bg-color `openframe`, the page's colour, darker than the
 * header and the rows it lies on). A horizontal one starts at the pinned block's edge (`offset`), never over a pinned
 * column; render it in the `relative` box around the viewport.
 */
export function GridGradient({
  edge,
  offset = 0,
  top = 0,
}: {
  edge: GridEdge;
  offset?: number | string;
  top?: number;
}) {
  const { edges } = useGridScroll().controller;
  const visible = (useSyncExternalStore(edges.subscribe, edges.get, getNoEdges) & EDGE[edge]) !== 0;
  const horizontal = edge === 'left' || edge === 'right';
  const angle = { left: '270deg', right: '90deg', top: '0deg', bottom: '180deg' }[edge];
  return (
    <div
      aria-hidden
      data-grid-gradient={edge}
      data-visible={visible}
      className={cn(
        'pointer-events-none absolute z-[2] transition-opacity duration-150',
        horizontal ? 'inset-y-0 w-10' : 'inset-x-0 h-10',
        edge === 'bottom' && 'bottom-0',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      style={{
        background: `linear-gradient(${angle}, transparent 0%, var(--color-bg) 100%)`,
        ...(edge === 'left' ? { left: offset } : {}),
        ...(edge === 'right' ? { right: offset } : {}),
        ...(edge === 'top' ? { top } : {}),
      }}
    />
  );
}
