'use client';

import { type KeyboardEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { useMediaQuery } from '../../hooks/ui/use-media-query';
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
}

export interface AppLayoutSidePanelConfig {
  /** Panel body. Told its width so it can choose what fits. */
  children: (state: AppLayoutSidePanelRenderState) => ReactNode;
  /** Narrowest docked width, and the width it starts at. Default 296. */
  minWidth?: number;
  /** Narrowest the content may get before the panel takes over. Default 400. */
  minContentWidth?: number;
  /** localStorage key for the chosen width. */
  storageKey?: string;
  /**
   * Pages that need the whole content width set this: the panel drops back to
   * its minimum when it turns on. The user can still widen it.
   */
  collapsed?: boolean;
  /** Accessible name of the panel region. */
  label?: string;
}

// The docked card's inset from the window edge, top and bottom.
const PANEL_INSET = 16;
const MOBILE_QUERY = '(max-width: 799.98px)';

interface StoredSize {
  width: number;
  expanded: boolean;
}

function readStored(storageKey: string | undefined, minWidth: number): StoredSize {
  const fallback = { width: minWidth, expanded: false };
  if (!storageKey || typeof window === 'undefined') return fallback;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<StoredSize> | null;
    if (!parsed || !Number.isFinite(parsed.width)) return fallback;
    return { width: Number(parsed.width), expanded: parsed.expanded === true };
  } catch {
    return fallback;
  }
}

export interface AppLayoutSidePanelState {
  mode: AppLayoutSidePanelMode;
  /** Width of the panel body in the current mode. */
  width: number;
  minWidth: number;
  /** Widest the panel can dock before it takes the whole content area. */
  maxDockedWidth: number;
  /** The panel can sit beside the content (else the header toggles it). */
  canDock: boolean;
  /** Opened from the header while it cannot dock. */
  isOpen: boolean;
  toggle: () => void;
  resize: (next: number) => void;
}

/**
 * Owns the side panel's geometry. Lives in `AppLayout`, not the panel, because
 * the header's toggle reads it too.
 */
export function useAppLayoutSidePanel(
  config: AppLayoutSidePanelConfig | undefined,
  row: HTMLElement | null,
): AppLayoutSidePanelState | null {
  const minWidth = config?.minWidth ?? 296;
  const minContentWidth = config?.minContentWidth ?? 400;
  const storageKey = config?.storageKey;
  const collapsed = config?.collapsed ?? false;
  const enabled = config !== undefined;

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
  const [stored, setStored] = useState<StoredSize>(() => readStored(storageKey, minWidth));
  const [isOpen, setIsOpen] = useState(false);

  const measured = rowWidth > 0;
  const maxDockedWidth = rowWidth - minContentWidth - PANEL_INSET;
  const canDock = !isMobile && (!measured || maxDockedWidth >= minWidth);

  // Room came back (the navigation collapsed, the window widened): return to
  // the column. Dropping the header-open flag means losing the room again
  // hides the panel rather than throwing it over the content.
  const [prevCanDock, setPrevCanDock] = useState(canDock);
  if (canDock !== prevCanDock) {
    setPrevCanDock(canDock);
    setIsOpen(false);
  }

  // A page that needs the full width starts the panel at its minimum without
  // touching the width the user chose elsewhere: a drag there is kept only
  // until the page lets go.
  const [collapsedSize, setCollapsedSize] = useState<StoredSize | null>(null);
  const [prevCollapsed, setPrevCollapsed] = useState(collapsed);
  if (collapsed !== prevCollapsed) {
    setPrevCollapsed(collapsed);
    setCollapsedSize(null);
  }
  const size = collapsed ? (collapsedSize ?? { width: minWidth, expanded: false }) : stored;
  const setSize = collapsed ? setCollapsedSize : setStored;

  useEffect(() => {
    if (!enabled || !storageKey) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // ignore quota / disabled storage
    }
  }, [enabled, storageKey, stored]);

  if (!config) return null;

  let mode: AppLayoutSidePanelMode;
  if (isMobile) mode = isOpen ? 'overlay' : 'hidden';
  else if (!canDock) mode = isOpen ? 'full' : 'hidden';
  else mode = size.expanded ? 'full' : 'docked';

  const dockedWidth = Math.min(Math.max(size.width, minWidth), Math.max(minWidth, maxDockedWidth));
  const width =
    mode === 'docked' ? dockedWidth : mode === 'overlay' ? rowWidth : Math.max(0, rowWidth - 2 * PANEL_INSET);

  return {
    mode,
    width,
    minWidth,
    maxDockedWidth: Math.max(minWidth, maxDockedWidth),
    canDock,
    isOpen,
    toggle: () => setIsOpen(open => !open),
    resize: next => {
      // Past the content's minimum the panel takes the whole area; dragging
      // back under it docks again at the dragged width.
      if (next > maxDockedWidth) setSize({ width: size.width, expanded: true });
      else setSize({ width: Math.max(minWidth, Math.round(next)), expanded: false });
    },
  };
}

interface SidePanelResizeHandleProps {
  state: AppLayoutSidePanelState;
  label: string;
}

function SidePanelResizeHandle({ state, label }: SidePanelResizeHandleProps) {
  const startRef = useRef<{ x: number; width: number } | null>(null);
  const { width, minWidth, maxDockedWidth, mode, resize } = state;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    startRef.current = { x: event.clientX, width };
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start) return;
    // The handle sits on the panel's left edge: dragging left widens it.
    resize(start.width - (event.clientX - start.x));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    startRef.current = null;
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
    if (event.key === 'ArrowLeft') next = width + step;
    else if (event.key === 'ArrowRight') next = (mode === 'full' ? maxDockedWidth : width) - step;
    else if (event.key === 'Home') next = minWidth;
    else if (event.key === 'End') next = maxDockedWidth + 1;
    if (next === null) return;
    event.preventDefault();
    resize(next);
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(mode === 'full' ? maxDockedWidth + 1 : width)}
      aria-valuemin={minWidth}
      aria-valuemax={maxDockedWidth + 1}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      className="group absolute inset-y-0 left-0 z-10 flex w-4 -translate-x-1/2 cursor-col-resize touch-none select-none items-center justify-center outline-none"
    >
      <span
        aria-hidden
        className="flex h-8 w-4 items-center justify-center rounded-sm border border-ods-border bg-ods-card text-ods-text-secondary transition-colors group-hover:border-ods-border-hover group-focus-visible:border-ods-accent"
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
  const { mode, width, canDock } = state;
  if (mode === 'hidden') return null;
  const label = config.label ?? 'Side panel';

  return (
    <aside
      aria-label={label}
      className={cn(
        'relative flex min-w-0',
        mode === 'docked' && 'shrink-0 py-[var(--spacing-system-mf)] pr-[var(--spacing-system-mf)]',
        mode === 'full' && 'flex-1 p-[var(--spacing-system-mf)]',
        mode === 'overlay' && 'absolute inset-0 z-[103] bg-ods-bg',
      )}
      style={mode === 'docked' ? { width: width + PANEL_INSET } : undefined}
    >
      {canDock && <SidePanelResizeHandle state={state} label={`Resize ${label}`} />}
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 overflow-hidden bg-ods-bg',
          mode !== 'overlay' && 'rounded-md border border-ods-border',
        )}
      >
        {config.children({ width, mode })}
      </div>
    </aside>
  );
}
