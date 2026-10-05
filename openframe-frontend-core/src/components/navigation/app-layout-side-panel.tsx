'use client';

import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { breakpoints, useMediaQuery } from '../../hooks/ui/use-media-query';
import { cn } from '../../utils/cn';
import { Menu01Icon } from '../icons-v2-generated';

/**
 * - `docked`: a column beside the content, resizable.
 * - `full`: covers the content area (not the navigation). Reached by dragging
 *   past the content's minimum width, or from the header toggle when there is
 *   no room to dock.
 * - `hidden`: no room to dock (or a phone) and not opened from the header.
 * - `overlay`: a phone, opened from the header; covers the content area.
 */
export type AppLayoutSidePanelMode = 'docked' | 'full' | 'hidden' | 'overlay';

export interface AppLayoutSidePanelRenderState {
  /** Width the panel body is drawn at, in px. */
  width: number;
  mode: AppLayoutSidePanelMode;
  /**
   * The panel was opened from the header (no room to dock, or a phone) and can
   * be put away again: offer a close control. A docked panel cannot close.
   */
  canClose: boolean;
  /** Put the panel away again; a no-op while it is docked. */
  close: () => void;
  /**
   * Where `collapse` takes the panel, one step back at a time: from the whole
   * area to the column it was in before (`column`), from the column to its
   * minimum (`minimum`, e.g. a list alone). Null when there is no step back.
   */
  collapsesTo: 'column' | 'minimum' | null;
  /** Step the panel back (see `collapsesTo`), animated. */
  collapse: () => void;
}

export interface AppLayoutSidePanelConfig {
  /** Panel body. Told its width so it can choose what fits. */
  children: (state: AppLayoutSidePanelRenderState) => ReactNode;
  /** Narrowest docked width, and the width it starts at: the narrowest its content draws. */
  minWidth: number;
  /** Narrowest the content may get before the panel takes over. Default 400. */
  minContentWidth?: number;
  /** localStorage key for the chosen width. Without it the width lasts the session. */
  storageKey?: string;
  /**
   * Pages that need the whole content width set this: the panel starts at its
   * minimum there. The user can still widen it; the width they chose
   * elsewhere is kept for the other pages.
   */
  collapsed?: boolean;
  /** Accessible name of the panel region. Default "Side panel". */
  label?: string;
  /**
   * Opened from the header while it cannot dock (or on a phone). Pass it to
   * open the panel from elsewhere (a deep link, a "send to chat" action);
   * omit to let the header own it. Docked, it has no effect.
   */
  open?: boolean;
  /** Called whenever the header-open state should change. */
  onOpenChange?: (open: boolean) => void;
}

/** Inset of the docked card from the window edge and the header. */
export const SIDE_PANEL_INSET = 16;
const MOBILE_QUERY = `not all and ${breakpoints.md}`;
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
/** Length of the docked <-> full morph; keep in step with `duration-300` below. */
const MORPH_MS = 300;
const STORAGE_EVENT = 'of:side-panel-size';

export interface SidePanelSize {
  /** Docked width the user chose. */
  width: number;
  /** Dragged past the content minimum: the panel takes the whole area. */
  expanded: boolean;
}

export interface SidePanelLayoutInput {
  /** Width of the row the content and the panel share; 0 before it is measured. */
  rowWidth: number;
  isMobile: boolean;
  /** Opened from the header (only meaningful while it cannot dock). */
  isOpen: boolean;
  size: SidePanelSize;
  minWidth: number;
  minContentWidth: number;
}

export interface SidePanelLayout {
  mode: AppLayoutSidePanelMode;
  /** Width the panel body is drawn at. */
  width: number;
  /** The panel can sit beside the content. */
  canDock: boolean;
  /** Widest docked width; one pixel more takes the whole area. */
  maxDockedWidth: number;
  /** Width the panel docks at, kept while it is full so it can return there. */
  dockedWidth: number;
}

/**
 * Where the panel goes for a given room. Pure, so the rules read in one place:
 * a phone gets the overlay; a row with room for both minimums docks (or is
 * full when dragged past); otherwise it hides until opened from the header.
 * An unmeasured row docks, so the first paint matches the common case.
 */
export function resolveSidePanelLayout({
  rowWidth,
  isMobile,
  isOpen,
  size,
  minWidth,
  minContentWidth,
}: SidePanelLayoutInput): SidePanelLayout {
  const measured = rowWidth > 0;
  const room = rowWidth - minContentWidth - SIDE_PANEL_INSET;
  const canDock = !isMobile && (!measured || room >= minWidth);
  const maxDockedWidth = measured ? Math.max(minWidth, room) : Number.POSITIVE_INFINITY;

  let mode: AppLayoutSidePanelMode;
  if (isMobile) mode = isOpen ? 'overlay' : 'hidden';
  else if (!canDock) mode = isOpen ? 'full' : 'hidden';
  else mode = size.expanded ? 'full' : 'docked';

  const dockedWidth = Math.min(Math.max(size.width, minWidth), maxDockedWidth);
  let width: number;
  if (mode === 'docked') width = dockedWidth;
  else if (mode === 'overlay') width = rowWidth;
  else width = Math.max(0, rowWidth - 2 * SIDE_PANEL_INSET);

  return { mode, width, canDock, maxDockedWidth, dockedWidth };
}

function parseSize(raw: string | null): SidePanelSize | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SidePanelSize> | null;
    if (!parsed || typeof parsed.width !== 'number' || !Number.isFinite(parsed.width)) return null;
    return { width: parsed.width, expanded: parsed.expanded === true };
  } catch {
    return null;
  }
}

function subscribeToStoredSize(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}

/**
 * The persisted size, read through `useSyncExternalStore` so the server and
 * the hydrating client both render the default and the stored width arrives
 * on the render after: a size in the first render would be a hydration
 * mismatch on the panel's inline width.
 */
function useStoredSize(storageKey: string | undefined, fallback: SidePanelSize) {
  const raw = useSyncExternalStore(
    subscribeToStoredSize,
    () => {
      if (!storageKey) return null;
      try {
        return window.localStorage.getItem(storageKey);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const [sessionSize, setSessionSize] = useState<SidePanelSize | null>(null);
  const size = (storageKey ? parseSize(raw) : sessionSize) ?? fallback;

  const setSize = (next: SidePanelSize) => {
    if (!storageKey) {
      setSessionSize(next);
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage refused (quota, privacy mode): keep it for the session.
      setSessionSize(next);
    }
    window.dispatchEvent(new Event(STORAGE_EVENT));
  };

  return [size, setSize] as const;
}

/**
 * The panel is growing into the whole area (`expand`), shrinking back into the
 * column (`collapse`) or narrowing within it (`narrow`). While it grows the
 * content stays where it is under it, and is hidden only once the panel covers
 * it; while it shrinks the content is already laid out at its new width.
 */
export type SidePanelMorph = 'expand' | 'collapse' | 'narrow';

export interface AppLayoutSidePanelState extends SidePanelLayout {
  minWidth: number;
  /** Opened from the header while it cannot dock. */
  isOpen: boolean;
  morph: SidePanelMorph | null;
  /**
   * Dragged wider than any column can be and not yet let go: the panel follows
   * the pointer over the content, laid out at its narrowest beneath it.
   */
  peekWidth: number | null;
  /** The panel covers the content area: the content can be hidden. */
  coversContent: boolean;
  /** The panel is drawn over part of the content (a morph or a peek). */
  overlapsContent: boolean;
  endMorph: () => void;
  collapsesTo: AppLayoutSidePanelRenderState['collapsesTo'];
  collapse: () => void;
  toggle: () => void;
  close: () => void;
  resize: (next: number) => void;
  /**
   * A pointer drag to `next`. Wider than any column can be, the panel follows
   * the pointer over the content instead of jumping to the whole area.
   */
  drag: (next: number) => void;
  /**
   * The drag ended at `next`: a panel left between the widest column and the
   * whole area settles on the nearer of the two, animated.
   */
  release: (next: number) => void;
}

/**
 * Owns the side panel's geometry. Lives in `AppLayout`, not the panel, because
 * the header's toggle reads it too. Returns null without a config.
 */
export function useAppLayoutSidePanel(
  config: AppLayoutSidePanelConfig | undefined,
  row: HTMLElement | null,
): AppLayoutSidePanelState | null {
  const enabled = config !== undefined;
  const minWidth = config?.minWidth ?? 0;
  const minContentWidth = config?.minContentWidth ?? 400;
  const collapsed = config?.collapsed ?? false;
  const minimum: SidePanelSize = { width: minWidth, expanded: false };

  const [rowWidth, setRowWidth] = useState(0);
  useIsomorphicLayoutEffect(() => {
    if (!enabled || !row) return undefined;
    const update = () => setRowWidth(row.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [enabled, row]);

  const isMobile = useMediaQuery(MOBILE_QUERY) === true;
  const reduceMotion = useMediaQuery(REDUCED_MOTION_QUERY) === true;
  const [morph, setMorph] = useState<SidePanelMorph | null>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);
  const [storedSize, setStoredSize] = useStoredSize(config?.storageKey, minimum);
  const [ownIsOpen, setOwnIsOpen] = useState(false);
  const isOpen = config?.open ?? ownIsOpen;
  const onOpenChange = config?.onOpenChange;
  const setIsOpen = (next: boolean) => {
    if (config?.open === undefined) setOwnIsOpen(next);
    onOpenChange?.(next);
  };

  // A page that needs the full width starts the panel at its minimum without
  // touching the width the user chose elsewhere: a drag there lasts until the
  // page lets go.
  const [collapsedSize, setCollapsedSize] = useState<SidePanelSize | null>(null);
  const [prevCollapsed, setPrevCollapsed] = useState(collapsed);
  if (collapsed !== prevCollapsed) {
    setPrevCollapsed(collapsed);
    setCollapsedSize(null);
  }
  const size = collapsed ? (collapsedSize ?? minimum) : storedSize;
  const setSize = collapsed ? setCollapsedSize : setStoredSize;

  const layout = resolveSidePanelLayout({ rowWidth, isMobile, isOpen, size, minWidth, minContentWidth });

  // Room came back (the navigation collapsed, the window widened): return to
  // the column. Dropping the header-open flag means losing the room again
  // hides the panel rather than throwing it over the content.
  const [prevCanDock, setPrevCanDock] = useState(layout.canDock);
  if (layout.canDock !== prevCanDock) {
    setPrevCanDock(layout.canDock);
    setOwnIsOpen(false);
  }
  // A controlled host hears about the return after the commit (a parent's
  // setState cannot run in this render), and only on the transition: a host
  // may open the panel while it is docked (a deep link), which is not undone.
  const prevCanDockRef = useRef(layout.canDock);
  useEffect(() => {
    const couldDock = prevCanDockRef.current;
    prevCanDockRef.current = layout.canDock;
    if (!couldDock && layout.canDock && config?.open) onOpenChange?.(false);
  }, [layout.canDock, config?.open, onOpenChange]);

  if (!enabled) return null;

  const animate = (next: SidePanelMorph) => {
    if (!reduceMotion) setMorph(next);
  };
  const fullWidth = Math.max(0, rowWidth - 2 * SIDE_PANEL_INSET);
  // Only while there is a column to peek out of: losing the room (or a phone)
  // drops it.
  const peekWidth = layout.canDock ? liveWidth : null;
  const dock = (next: number) => setSize({ width: Math.max(minWidth, Math.round(next)), expanded: false });

  const resize = (next: number) => {
    // Past the content's minimum the panel takes the whole area; dragging
    // back under it docks again at the dragged width.
    const expand = next > layout.maxDockedWidth;
    // Crossing between the column and the whole area is animated, not a
    // jump. Only for a resize: a page load or room coming back just lands.
    if (layout.canDock) {
      if (expand && layout.mode === 'docked') animate('expand');
      else if (!expand && layout.mode === 'full') animate('collapse');
    }
    if (expand) setSize({ width: size.width, expanded: true });
    else dock(next);
  };

  let collapsesTo: AppLayoutSidePanelRenderState['collapsesTo'] = null;
  if (layout.mode === 'full' && layout.canDock) collapsesTo = layout.dockedWidth > minWidth ? 'column' : 'minimum';
  else if (layout.mode === 'docked' && layout.width > minWidth) collapsesTo = 'minimum';

  return {
    ...layout,
    minWidth,
    isOpen,
    morph,
    peekWidth,
    coversContent: layout.mode === 'full' && morph !== 'expand' && peekWidth === null,
    overlapsContent: morph !== null || peekWidth !== null,
    endMorph: () => setMorph(null),
    collapsesTo,
    collapse: () => {
      if (collapsesTo === null) return;
      if (layout.mode === 'full') {
        // Back to the column it left, at the width it had there.
        animate('collapse');
        setSize({ width: size.width, expanded: false });
      } else {
        animate('narrow');
        setSize({ width: minWidth, expanded: false });
      }
    },
    toggle: () => setIsOpen(!isOpen),
    close: () => setIsOpen(false),
    resize,
    drag: next => {
      if (next > layout.maxDockedWidth) {
        // Wider than a column can be: follow the pointer over the content, which
        // is laid out at its narrowest (the widest column) underneath.
        if (size.expanded || size.width !== layout.maxDockedWidth) dock(layout.maxDockedWidth);
        setLiveWidth(Math.min(Math.round(next), fullWidth));
        return;
      }
      // Within the column: an ordinary resize, picking up where a peek was.
      setLiveWidth(null);
      dock(next);
    },
    release: next => {
      setLiveWidth(null);
      // Let go within the column: the drag already put it there.
      if (next <= layout.maxDockedWidth) return;
      // Settle on the nearer of the two, from where the pointer left it.
      if (next > (layout.maxDockedWidth + fullWidth) / 2) {
        // Dragged all the way: nothing left to animate.
        if (next < fullWidth) animate('expand');
        setSize({ width: layout.maxDockedWidth, expanded: true });
      } else {
        animate('narrow');
        dock(layout.maxDockedWidth);
      }
    },
  };
}

interface SidePanelResizeHandleProps {
  state: AppLayoutSidePanelState;
  label: string;
  controls: string;
}

function SidePanelResizeHandle({ state, label, controls }: SidePanelResizeHandleProps) {
  const { width, minWidth, maxDockedWidth, mode, peekWidth, resize, drag, release } = state;
  const startRef = useRef<{ x: number; width: number } | null>(null);
  // Pointer moves outpace frames; resize once per frame with the latest one.
  const frameRef = useRef<number | null>(null);
  const pendingRef = useRef<number | null>(null);
  // Unmeasured row (first paint): no upper bound to announce or jump to yet.
  const measured = Number.isFinite(maxDockedWidth);
  // The width the keyboard steps from: in `full`, one past the docked maximum.
  const current = peekWidth ?? (mode === 'full' && measured ? maxDockedWidth + 1 : width);

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const scheduleDrag = (next: number) => {
    pendingRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingRef.current !== null) drag(pendingRef.current);
    });
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    // From the whole area the drag starts at the panel's real width, so its
    // edge stays under the pointer instead of jumping to the widest column.
    startRef.current = { x: event.clientX, width: mode === 'full' && measured ? width : current };
    pendingRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    // The handle sits on the panel's left edge: dragging left widens it.
    scheduleDrag(start.width - (event.clientX - start.x));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    startRef.current = null;
    // Land the last move before deciding where the panel settles.
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      if (pendingRef.current !== null) drag(pendingRef.current);
    }
    if (pendingRef.current !== null) release(pendingRef.current);
    pendingRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // already released
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 40 : 16;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = current + step;
    else if (event.key === 'ArrowRight') next = Math.min(current, maxDockedWidth) - step;
    else if (event.key === 'Home') next = minWidth;
    else if (event.key === 'End' && measured) next = maxDockedWidth + 1;
    if (next === null) return;
    event.preventDefault();
    resize(next);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-controls={controls}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(current)}
      aria-valuemin={minWidth}
      aria-valuemax={measured ? Math.round(maxDockedWidth + 1) : undefined}
      aria-valuetext={mode === 'full' ? 'Full width' : `${Math.round(width)} pixels`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="group absolute inset-y-0 left-0 z-10 flex w-4 -translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center outline-none"
    >
      <span
        aria-hidden
        className="flex h-8 w-4 items-center justify-center rounded-sm border border-ods-border bg-ods-card text-ods-text-secondary transition-colors group-hover:border-ods-border-hover group-focus-visible:border-ods-accent group-focus-visible:text-ods-accent"
      >
        <Menu01Icon size={12} />
      </span>
    </div>
  );
}

interface AppLayoutSidePanelProps {
  config: AppLayoutSidePanelConfig;
  state: AppLayoutSidePanelState;
}

export function AppLayoutSidePanel({ config, state }: AppLayoutSidePanelProps) {
  const panelId = useId();
  const { mode, width, dockedWidth, canDock, isOpen, close, morph, endMorph, peekWidth } = state;

  // A safety net only: `transitionend` does not fire when the width ends up
  // unchanged (a resize that lands where it started). Generous, so a busy or
  // throttled page still finishes the animation before the content is hidden.
  useEffect(() => {
    if (!morph) return undefined;
    const timer = window.setTimeout(endMorph, MORPH_MS * 3);
    return () => window.clearTimeout(timer);
  }, [morph, endMorph]);

  if (mode === 'hidden') return null;
  const label = config.label ?? 'Side panel';
  // The column's footprint: docked, and while growing over the content, which
  // stays laid out at its width until the panel covers it.
  const inColumn = mode === 'docked' || morph === 'expand' || peekWidth !== null;

  // Opened from the header: Escape puts it away again.
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || !isOpen || event.defaultPrevented) return;
    event.preventDefault();
    close();
  };

  return (
    <aside
      id={panelId}
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative min-w-0',
        // Docked is decided before the viewport is known (server render, first
        // paint): keep it off phones until JS says otherwise.
        mode !== 'overlay' && inColumn && 'hidden shrink-0 md:block',
        mode !== 'overlay' && !inColumn && 'flex-1',
        // z-[99]: above the page's own layers (sticky headers, the z-50 bottom
        // action bar), BELOW the mobile burger menu (backdrop z-[100], panel
        // z-[101]), so the menu opens over a panel covering the content.
        mode === 'overlay' && 'absolute inset-0 z-[99] bg-ods-bg',
      )}
      style={mode !== 'overlay' && inColumn ? { width: dockedWidth + SIDE_PANEL_INSET } : undefined}
    >
      {/* Pinned to the right edge with an explicit width, so the move between
          the column and the whole area is one animated width. */}
      <div
        onTransitionEnd={event => {
          if (event.target === event.currentTarget) endMorph();
        }}
        onTransitionCancel={event => {
          if (event.target === event.currentTarget) endMorph();
        }}
        className={cn(
          'absolute flex',
          mode === 'overlay' ? 'inset-0' : 'inset-y-[var(--spacing-system-mf)] right-[var(--spacing-system-mf)] z-[1]',
          morph && 'transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
        )}
        style={mode === 'overlay' ? undefined : { width: peekWidth ?? width }}
      >
        {canDock && <SidePanelResizeHandle state={state} label={`Resize ${label}`} controls={panelId} />}
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ods-bg',
            mode !== 'overlay' && 'rounded-md border border-ods-border',
          )}
        >
          {config.children({
            width: peekWidth ?? width,
            mode,
            canClose: mode === 'overlay' || (mode === 'full' && !canDock),
            close,
            collapsesTo: state.collapsesTo,
            collapse: state.collapse,
          })}
        </div>
      </div>
    </aside>
  );
}
