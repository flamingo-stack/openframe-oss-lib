'use client';

import type { Column } from '@tanstack/react-table';
import type React from 'react';
import { useContext, useSyncExternalStore } from 'react';
import { cn } from '../../../utils/cn';
import { PanelResizeGrip } from '../panel-resize-handle';
import { useGridScroll, type GridColumn } from './data-table-grid';
import { GridPrefsContext, useGridPref } from './data-table-grid-prefs';

/**
 * The narrowest a grid column may be, by what its cells hold (the design's "min width rules"): about nine characters
 * of text before the ellipsis, plus the leading mark and its gap. A column states its own with `minSize`; these are
 * the values to state.
 */
export const GRID_MIN_WIDTH = { text: 120, icon: 148, media: 160 } as const;

/** A tag is never cut: a column with tags is at least its widest tag plus the cell's two insets. */
const TAG_INSET = 24;
/** The pinned first data column takes at most this share of the table's width. */
const PINNED_MAX_SHARE = 0.4;
/** How far an arrow key moves the column's edge, in px. */
const KEY_STEP = 16;
/** How many loaded rows an auto-fit measures. */
const AUTO_FIT_ROWS = 200;

/** What ends a resize drag. */
const DRAG_END_EVENTS = ['pointerup', 'pointercancel', 'lostpointercapture'] as const;

const getNoColumn = () => null;

/**
 * An element's width if nothing inside it were cut: measured on a hidden copy whose parts keep their natural size.
 * The copy carries the cell's own classes, so its insets and gaps are the cell's.
 */
function naturalWidth(element: HTMLElement): number {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.style.cssText = 'position:absolute;visibility:hidden;left:-99999px;top:0;width:max-content;max-width:none;';
  for (const handle of Array.from(copy.querySelectorAll('[data-grid-resize-handle]'))) handle.remove();
  for (const part of Array.from(copy.querySelectorAll<HTMLElement>('*'))) {
    part.style.setProperty('flex', 'none');
    part.style.setProperty('overflow', 'visible');
    part.style.setProperty('max-width', 'none');
    part.style.setProperty('min-width', 'auto');
    part.style.setProperty('text-overflow', 'clip');
  }
  element.parentElement?.appendChild(copy);
  const width = Math.ceil(copy.getBoundingClientRect().width);
  copy.remove();
  return width;
}

interface ResizeLimits {
  min: number;
  max: number;
}

/**
 * How narrow and how wide a column may go. The minimum is the largest of the rules that apply: the column's own
 * `minSize`, its header's content (a header label is never cut) and, where its cells hold tags, the widest tag.
 * There is no maximum, except for the pinned first data column.
 */
function resizeLimits(column: Column<unknown, unknown>, gridColumn: GridColumn, headerCell: HTMLElement): ResizeLimits {
  const root = headerCell.closest<HTMLElement>('[data-grid-root]');
  // The table library's own default minimum (20px) is not a stated one: a resizable column holds at least a text
  // column's nine characters.
  const stated = Math.max(column.columnDef.minSize ?? 0, GRID_MIN_WIDTH.text);
  let widestTag = 0;
  const tags = root?.querySelectorAll<HTMLElement>(`[data-grid-col="${CSS.escape(gridColumn.id)}"] [data-part="tag"]`);
  for (const tag of Array.from(tags ?? [])) {
    widestTag = Math.max(widestTag, Math.ceil(tag.getBoundingClientRect().width));
  }
  const min = Math.max(stated, naturalWidth(headerCell), widestTag > 0 ? widestTag + TAG_INSET : 0);
  const statedMax = column.columnDef.maxSize ?? Number.POSITIVE_INFINITY;
  const max =
    gridColumn.pin === 'left' && root
      ? Math.min(statedMax, Math.floor(root.clientWidth * PINNED_MAX_SHARE))
      : statedMax;
  return { min, max: Math.max(min, max) };
}

/** The width a header cell is drawn at, in px; `null` where there is no layout to measure. */
function drawnWidth(headerCell: HTMLElement): number | null {
  const width = Math.round(headerCell.getBoundingClientRect().width);
  return width > 0 ? width : null;
}

const clamp = (value: number, { min, max }: ResizeLimits) => Math.min(Math.max(Math.round(value), min), max);

/** The column's widest content among the loaded rows and its header: what a double click on the handle fits to. */
function widestContent(gridColumn: GridColumn, headerCell: HTMLElement): number {
  const root = headerCell.closest<HTMLElement>('[data-grid-root]');
  const cells = root?.querySelectorAll<HTMLElement>(`[data-grid-col="${CSS.escape(gridColumn.id)}"]`) ?? [];
  let widest = naturalWidth(headerCell);
  for (const cell of Array.from(cells).slice(0, AUTO_FIT_ROWS)) widest = Math.max(widest, naturalWidth(cell));
  return widest;
}

/**
 * The handle on a header cell's right edge that resizes its column (the design's `resize-handle`): shown on header
 * hover, accent while dragging. A drag changes this column only: the free width goes to the last data column, and a
 * table wider than its viewport scrolls. A double click fits the column to its widest content; the arrow keys move the edge.
 */
export function GridResizeHandle({
  column,
  gridColumn,
  label,
}: {
  column: Column<unknown, unknown>;
  gridColumn: GridColumn;
  label: string;
}) {
  const { store } = useContext(GridPrefsContext);
  // This column's width only: a drag on another column does not render this handle.
  const size = useGridPref(prefs => prefs.sizing[gridColumn.id]) ?? column.getSize();
  const { controller } = useGridScroll();
  const resizing =
    useSyncExternalStore(controller.resizing.subscribe, controller.resizing.get, getNoColumn) === gridColumn.id;

  // The width is the viewer's layout: one store per table, kept in the browser when the table is named. A drag's
  // steps stay out of storage; the width is written once, when the drag ends.
  const setSize = (next: number, persist = true) =>
    store.update(
      prefs =>
        prefs.sizing[gridColumn.id] === next ? prefs : { ...prefs, sizing: { ...prefs.sizing, [gridColumn.id]: next } },
      { persist },
    );

  const onPointerDown = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    const handle = event.currentTarget;
    const headerCell = handle.closest<HTMLElement>('[data-grid-header-cell]');
    if (!headerCell) return;
    // The header cell under the handle sorts on click: the drag is the handle's own.
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    // From the width the column is drawn at: the last data column is wider than its own size while it holds the
    // table's free width.
    const startSize = drawnWidth(headerCell) ?? size;
    const limits = resizeLimits(column, gridColumn, headerCell);
    // Captured: the drag goes on while the pointer leaves the handle (and the header).
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // No such active pointer (a synthetic event): the drag still follows the events the handle receives.
    }
    controller.resizing.set(gridColumn.id);

    // One write per frame, however many moves the pointer reports in it: the last position wins.
    const view = handle.ownerDocument.defaultView;
    let pending: number | null = null;
    let frame = 0;
    const flush = () => {
      frame = 0;
      if (pending === null) return;
      setSize(pending, false);
      pending = null;
    };
    const onMove = (move: PointerEvent) => {
      pending = clamp(startSize + move.clientX - startX, limits);
      if (!view) flush();
      else if (!frame) frame = view.requestAnimationFrame(flush);
    };
    // The drag ends once, whichever way: the button is released, the pointer is cancelled, or the capture is lost
    // (the browser took the pointer for a gesture, the handle left the page) with no `pointerup` to follow.
    let ended = false;
    const onEnd = () => {
      if (ended) return;
      ended = true;
      if (frame) view?.cancelAnimationFrame(frame);
      flush();
      controller.resizing.set(null);
      store.persist();
      handle.removeEventListener('pointermove', onMove);
      for (const type of DRAG_END_EVENTS) handle.removeEventListener(type, onEnd);
    };
    handle.addEventListener('pointermove', onMove);
    for (const type of DRAG_END_EVENTS) handle.addEventListener(type, onEnd);
  };

  const onDoubleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
    const headerCell = event.currentTarget.closest<HTMLElement>('[data-grid-header-cell]');
    if (!headerCell) return;
    event.stopPropagation();
    setSize(clamp(widestContent(gridColumn, headerCell), resizeLimits(column, gridColumn, headerCell)));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const headerCell = event.currentTarget.closest<HTMLElement>('[data-grid-header-cell]');
    if (!headerCell) return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.key === 'ArrowLeft' ? -KEY_STEP : KEY_STEP;
    setSize(clamp((drawnWidth(headerCell) ?? size) + step, resizeLimits(column, gridColumn, headerCell)));
  };

  return (
    <span
      data-grid-resize-handle
      data-resizing={resizing || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${label} column`}
      aria-valuenow={size}
      tabIndex={0}
      className={cn(
        'group absolute right-0 top-1/2 z-[1] -translate-y-1/2 cursor-col-resize touch-none outline-none transition-opacity',
        resizing ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover/gridhead:opacity-100',
      )}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      // A click that ends on the handle is not a click on the header (its sort).
      onClick={event => event.stopPropagation()}
    >
      <PanelResizeGrip className={cn('rounded-r-none border-r-0', resizing && 'border-ods-accent text-ods-accent')} />
    </span>
  );
}
