'use client';

import { type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject, useEffect, useRef } from 'react';

import { cn } from '../../utils/cn';
import { Menu01Icon } from '../icons-v2-generated';

/**
 * The drag-to-resize handle of a side or edge panel, shared by `Drawer`,
 * `AppLayoutDrawer`, `ComposerSheet` and `NavigationSidebar`. A drag writes the
 * panel's size to the DOM (or hands it to `onDrag`) and reports it once, on
 * release; arrow keys, Home and End report at once; a double click asks for the
 * default (`onReset`).
 */

/**
 * The grip the design draws on a resizable edge (its `resize-handle`): a 16×32
 * pill in the page's background astride the panel's border, with a three-line
 * mark. `NavigationSidebar` hands it to the handle as its `grip`, and
 * `AppLayoutSidePanel`'s own handle draws it too.
 */
export function PanelResizeGrip({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-4 items-center justify-center rounded-sm border border-ods-border bg-ods-bg text-ods-text-secondary transition-colors',
        'group-hover:border-ods-border-hover group-focus-visible:border-ods-accent group-focus-visible:text-ods-accent',
        className,
      )}
    >
      <Menu01Icon size={12} />
    </span>
  );
}

type PanelSide = 'right' | 'left' | 'top' | 'bottom';

const HORIZONTAL_SIDES: ReadonlySet<PanelSide> = new Set(['left', 'right']);

/** Ends a drawer resize drag: commits the size it reached and restores the
 *  page's cursor and text selection. No-op when no drag is in progress. */
function finishDrag(
  startRef: RefObject<{ x: number; y: number; size: number } | null>,
  dragSizeRef: RefObject<number | null>,
  commit: (size: number) => void,
): void {
  if (!startRef.current) return;
  startRef.current = null;
  if (dragSizeRef.current !== null) commit(dragSizeRef.current);
  dragSizeRef.current = null;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

export interface PanelResizeHandleProps {
  side: PanelSide;
  size: number;
  minSize: number;
  maxSize: number;
  onSize: (next: number) => void;
  /** Clamp a candidate size to the min/max and the container. */
  clampSize: (next: number) => number;
  /** The panel the size applies to — written directly while dragging. Omit for a
   *  panel sized by other means (`onDrag`). */
  panelRef?: RefObject<HTMLDivElement | null>;
  /**
   * Every size the drag reaches, in place of writing `panelRef`'s inline size:
   * for a panel whose width is a custom property or a class rather than an
   * inline style, or one that marks itself while dragged. `onSize` still
   * reports once, on release.
   */
  onDrag?: (next: number) => void;
  /** A double click on the handle: back to the default size. */
  onReset?: () => void;
  /** `overlay` is the body-level `Drawer`'s handle, `inLayout` the wider one of
   *  `AppLayoutDrawer`. They differ in track width and grip colour only. */
  variant: 'overlay' | 'inLayout';
  ariaLabel?: string;
  /** Where and how big the hit area is, over the side's default track (merged last). */
  className?: string;
  /** What the handle draws in place of the default grip bar. */
  grip?: ReactNode;
}

export function PanelResizeHandle({
  side,
  size,
  minSize,
  maxSize,
  onSize,
  clampSize,
  panelRef,
  onDrag,
  onReset,
  variant,
  ariaLabel,
  className,
  grip,
}: PanelResizeHandleProps) {
  const isHorizontal = HORIZONTAL_SIDES.has(side);
  const startRef = useRef<{ x: number; y: number; size: number } | null>(null);
  // Size reached by the drag in progress, committed to React state on release.
  const dragSizeRef = useRef<number | null>(null);
  const onSizeRef = useRef(onSize);
  useEffect(() => {
    onSizeRef.current = onSize;
  }, [onSize]);
  // The handle can unmount mid-drag (a persist-mode drawer closing), and then
  // no pointer event ends the drag: end it here, or the panel keeps a width
  // React state never received and the page keeps the resize cursor.
  useEffect(() => () => finishDrag(startRef, dragSizeRef, onSizeRef.current), []);

  const direction = side === 'right' || side === 'bottom' ? -1 : 1;

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    startRef.current = { x: e.clientX, y: e.clientY, size };
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  };

  // The drag writes the panel's size straight to the DOM and commits it to
  // state once, on release. Committing every pointermove re-rendered the
  // drawer per event — ~16% of a drag's CPU in WebKit on top of the reflow the
  // resize itself costs. ResizeObserver consumers inside the panel still see
  // every change. A re-render of the drawer mid-drag (e.g. a streamed chunk)
  // does not undo the write: React diffs against its previous render, where
  // the size is unchanged, so it leaves the style alone.
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    if (!onDrag && !panelRef?.current) return;
    const delta = isHorizontal ? e.clientX - start.x : e.clientY - start.y;
    const next = clampSize(start.size + delta * direction);
    dragSizeRef.current = next;
    if (onDrag) {
      onDrag(next);
    } else if (panelRef) {
      const panel = panelRef.current;
      if (panel) panel.style[isHorizontal ? 'width' : 'height'] = `${next}px`;
    }
    e.currentTarget.setAttribute('aria-valuenow', String(Math.round(next)));
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    finishDrag(startRef, dragSizeRef, onSize);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore — pointer may already be released
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 16;
    if (isHorizontal) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSize(size + step * (side === 'right' ? 1 : -1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSize(size + step * (side === 'right' ? -1 : 1));
      }
    } else {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        onSize(size + step * (side === 'bottom' ? 1 : -1));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onSize(size + step * (side === 'bottom' ? -1 : 1));
      }
    }
    if (e.key === 'Home') {
      e.preventDefault();
      onSize(minSize);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSize(maxSize);
    }
  };

  // The handle is a SIBLING of the panel (a child of the dialog content), so the
  // panel can clip its children without clipping the handle. The content
  // wrapper pads the panel by 16px wherever the handle shows, which is what
  // `top-4 bottom-4` (or `left-4 right-4`) lines the track up with.
  const track = variant === 'inLayout' ? { w: 'w-6', h: 'h-6' } : { w: 'w-3', h: 'h-3' };
  const trackPosition =
    side === 'right'
      ? `right-full top-4 bottom-4 ${track.w} items-center justify-end pr-1`
      : side === 'left'
        ? `left-full top-4 bottom-4 ${track.w} items-center justify-start pl-1`
        : side === 'bottom'
          ? `bottom-full left-4 right-4 ${track.h} justify-center items-end pb-1`
          : `top-full left-4 right-4 ${track.h} justify-center items-start pt-1`;

  const cursorClass = isHorizontal ? 'cursor-col-resize' : 'cursor-row-resize';
  const gripClass = isHorizontal ? 'h-10 w-1' : 'w-10 h-1';

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      aria-valuenow={Math.round(size)}
      aria-valuemin={minSize}
      aria-valuemax={maxSize}
      aria-label={ariaLabel ?? (isHorizontal ? 'Resize panel width' : 'Resize panel height')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className={cn(
        'group absolute z-20 flex touch-none select-none',
        'outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
        trackPosition,
        cursorClass,
        className,
      )}
    >
      {grip ?? (
        <div
          aria-hidden
          className={cn('rounded-full', variant === 'inLayout' ? 'bg-ods-border' : 'bg-ods-bg-surface', gripClass)}
        />
      )}
    </div>
  );
}
