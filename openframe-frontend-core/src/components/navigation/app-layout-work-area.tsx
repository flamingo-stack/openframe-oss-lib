'use client';

import {
  createContext,
  type CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ContentAreaWidthContext, contentBreakpointFor } from '../../hooks/ui/use-content-breakpoint';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { useIsomorphicLayoutEffect } from '../../hooks/ui/use-isomorphic-layout-effect';
import { cn } from '../../utils/cn';
import { clamp } from '../../utils/common';
import { createLocalStorageAdapter } from '../../utils/local-storage-adapter';
import { PanelResizeGrip, PanelResizeHandle } from '../ui/panel-resize-handle';

/**
 * Which columns of the work area show:
 * - `chat`: the chat column takes the whole area, the page column is hidden;
 * - `split`: both, side by side, the divider between them;
 * - `page`: the page column takes the whole area, the chat column is hidden.
 *
 * The host decides it (from its route and its own state). A hidden column stays
 * mounted — `hidden`, `inert` and `aria-hidden` — so a thread keeps its scroll and
 * a page its state while the other side has the room.
 */
export type AppLayoutWorkAreaMode = 'chat' | 'split' | 'page';

/** The narrowest either column gets in `split`. */
export const WORK_AREA_MIN_COLUMN_WIDTH = 360;
/** How far past the squeeze floor a drag goes before `onSqueezePast` fires, px. */
export const SQUEEZE_PAST_PX = 48;
/** Where the divider starts until the user moves it: the middle. */
const DEFAULT_CHAT_SHARE = 0.5;

/**
 * What a column of the work area knows about its own width: whether it is squeezed
 * (`squeezeFloor`) — narrower on screen than `minWidth`, its content laid out at
 * `minWidth` and scrolled sideways inside it — and that width. Outside a work area:
 * `null`.
 */
export interface WorkAreaColumnState {
  squeezed: boolean;
  /** The width the column's content is laid out at while squeezed, px. */
  minWidth: number;
}

export const WorkAreaColumnContext = createContext<WorkAreaColumnState | null>(null);

/** The work-area column this is drawn in (`WorkAreaColumnState`), or `null` outside one. */
export function useWorkAreaColumn(): WorkAreaColumnState | null {
  return useContext(WorkAreaColumnContext);
}

interface Squeeze {
  chat: boolean;
  page: boolean;
}

const NOT_SQUEEZED: Squeeze = { chat: false, page: false };

export interface AppLayoutWorkAreaProps {
  mode: AppLayoutWorkAreaMode;
  /**
   * The chat column's content (its header, thread and composer). `null`: no chat
   * column at all — the page column alone, in the same element tree a chat column
   * joins later, so the page does not remount when it arrives.
   */
  chat: ReactNode;
  /** The page column's content. */
  page: ReactNode;
  /** Narrowest column in `split`, px. Default {@link WORK_AREA_MIN_COLUMN_WIDTH}. */
  minColumnWidth?: number;
  /**
   * Lets the divider squeeze a column below `minColumnWidth`, down to this share of
   * it (0.3: 108px of 360), so the other one keeps growing. A squeezed column keeps
   * its content at `minColumnWidth` and scrolls it sideways (`useWorkAreaColumn`: the
   * column's own scroller does it), its header stays on screen, and a shadow along the
   * divider marks it. Omit (default): no column gets narrower than `minColumnWidth`.
   */
  squeezeFloor?: number;
  /**
   * With `squeezeFloor`: the divider is dragged on past the floor (the column on that
   * side already squeezed to it) — `'start'` past the chat's floor, toward the area's
   * start; `'end'` past the page's, toward its end. Once per drag, `SQUEEZE_PAST_PX`
   * beyond it. A host collapses the sidebar on that side, so the drag keeps winning room.
   */
  onSqueezePast?: (side: 'start' | 'end') => void;
  /**
   * `localStorage` key for the divider position, kept as the chat column's share
   * of the area (so a wider window widens both). Omit to keep it for the mount only.
   */
  storageKey?: string;
  /** Accessible name of the chat column. Default "Chat". */
  chatLabel?: string;
  /** Classes of the page column (the `<main>` box sits inside it). */
  pageClassName?: string;
  className?: string;
}

interface StoredShare {
  share: number;
}

function isStoredShare(value: unknown): value is StoredShare {
  if (typeof value !== 'object' || value === null) return false;
  const { share } = value as { share?: unknown };
  return typeof share === 'number' && Number.isFinite(share) && share > 0 && share < 1;
}

/** An element's width, kept only when it crosses a content breakpoint (as `AppLayout` does for `<main>`). */
function useContentWidth(element: HTMLElement | null): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!element) return undefined;
    const update = () => {
      const next = element.clientWidth;
      setWidth(previous =>
        previous !== null && contentBreakpointFor(previous) === contentBreakpointFor(next) ? previous : next,
      );
    };
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
}

/**
 * The chat column and the page column of `AppLayout`, side by side or one at a
 * time (`mode`). In `split` a divider sits between them: drag it, step it with
 * the arrow keys (Shift for bigger steps), Home / End for the extremes, double
 * click for the middle. Neither column gets narrower than `minColumnWidth` —
 * unless `squeezeFloor` lets the divider fold one further, its content kept at
 * `minColumnWidth` and scrolled sideways, a shadow along the divider; with no room
 * for two such columns the area shows the page column alone.
 *
 * Both columns are content areas (`ods-content-area`): their tokens, their
 * `content-md:` / `content-lg:` classes and `useContentBreakpoint()` follow the
 * column's own width.
 */
export function AppLayoutWorkArea({
  mode,
  chat,
  page,
  minColumnWidth = WORK_AREA_MIN_COLUMN_WIDTH,
  squeezeFloor,
  onSqueezePast,
  storageKey,
  chatLabel = 'Chat',
  pageClassName,
  className,
}: AppLayoutWorkAreaProps) {
  const [row, setRow] = useState<HTMLDivElement | null>(null);
  const [chatElement, setChatElement] = useState<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const [rowWidth, setRowWidth] = useState(0);
  useIsomorphicLayoutEffect(() => {
    if (!row) return undefined;
    const update = () => setRowWidth(row.clientWidth);
    update();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [row]);

  // The stored share is read once hydrated: the server cannot read it, and a
  // width that differs on the hydrating client is a hydration mismatch.
  const hydrated = useIsHydrated();
  const storage = useMemo(
    () =>
      storageKey
        ? createLocalStorageAdapter<StoredShare>({
            key: storageKey,
            validate: isStoredShare,
            logTag: `[work-area:${storageKey}]`,
          })
        : null,
    [storageKey],
  );
  const storedShare = useMemo(() => (hydrated ? (storage?.load()?.share ?? null) : null), [hydrated, storage]);
  const [chosenShare, setChosenShare] = useState<number | null>(null);
  const share = chosenShare ?? storedShare ?? DEFAULT_CHAT_SHARE;

  const measured = rowWidth > 0;
  const canSplit = !measured || rowWidth >= 2 * minColumnWidth;
  const hasChat = chat !== null;
  const shown: AppLayoutWorkAreaMode = !hasChat ? 'page' : mode === 'split' && !canSplit ? 'page' : mode;
  // The narrowest a column gets on screen: `minColumnWidth`, or its squeeze floor.
  const floor =
    squeezeFloor !== undefined && squeezeFloor > 0 && squeezeFloor < 1
      ? Math.round(minColumnWidth * squeezeFloor)
      : minColumnWidth;
  const maxChatWidth = Math.max(floor, rowWidth - floor);
  const clampChatWidth = useCallback((next: number) => clamp(next, floor, maxChatWidth), [floor, maxChatWidth]);
  const chatWidth = measured ? Math.round(clampChatWidth(share * rowWidth)) : null;

  // The width the drag has reached, until it is released: what the chat column draws while it
  // is dragged. State, not a write to the DOM: the row can change under a drag (a sidebar
  // folding away, frame by frame), and each render then drew the chosen share's width over the
  // dragged one — the column jumped back and forth. Cheap: the columns' content is the same
  // elements every render, and React skips them.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragChatWidth = useCallback((next: number) => setDragWidth(Math.round(next)), []);
  const shownChatWidth = dragWidth === null ? chatWidth : Math.round(clampChatWidth(dragWidth));

  // Once per drag: the host's answer (a sidebar folding away) is not asked for twice.
  const squeezedPastRef = useRef(false);
  const squeezable = floor < minColumnWidth;
  const dragPastLimit = useCallback(
    (edge: 'min' | 'max', by: number) => {
      if (!squeezable || !onSqueezePast || squeezedPastRef.current || by < SQUEEZE_PAST_PX) return;
      squeezedPastRef.current = true;
      onSqueezePast(edge === 'min' ? 'start' : 'end');
    },
    [squeezable, onSqueezePast],
  );

  const chooseWidth = useCallback(
    (next: number) => {
      squeezedPastRef.current = false;
      setDragWidth(null);
      if (!measured) return;
      const nextShare = clampChatWidth(next) / rowWidth;
      setChosenShare(nextShare);
      storage?.save({ share: nextShare });
    },
    [measured, clampChatWidth, rowWidth, storage],
  );
  const resetWidth = useCallback(() => {
    setDragWidth(null);
    setChosenShare(DEFAULT_CHAT_SHARE);
    storage?.clear();
  }, [storage]);

  const setChatNode = useCallback((node: HTMLDivElement | null) => {
    chatRef.current = node;
    setChatElement(node);
  }, []);
  const chatContentWidth = useContentWidth(chatElement);

  const chatHidden = shown === 'page';
  const pageHidden = shown === 'chat';
  // Which column is narrower than `minColumnWidth` at the width on screen.
  const squeeze: Squeeze =
    shown === 'split' && shownChatWidth !== null && measured
      ? { chat: shownChatWidth < minColumnWidth, page: rowWidth - shownChatWidth < minColumnWidth }
      : NOT_SQUEEZED;
  const chatColumnState = useMemo<WorkAreaColumnState>(
    () => ({ squeezed: squeeze.chat, minWidth: minColumnWidth }),
    [squeeze.chat, minColumnWidth],
  );
  const pageColumnState = useMemo<WorkAreaColumnState>(
    () => ({ squeezed: squeeze.page, minWidth: minColumnWidth }),
    [squeeze.page, minColumnWidth],
  );
  // The width a squeezed column's content keeps, for its scroller (`[&>*]:min-w-[var(--work-area-min-width)]`).
  const minWidthVar = { '--work-area-min-width': `${minColumnWidth}px` } as CSSProperties;

  return (
    <div ref={setRow} className={cn('relative flex min-h-0 min-w-0 flex-1', className)} data-work-area={shown}>
      {/* Conditional in place: the page column keeps its position among the children
          whether or not there is a chat column. */}
      {hasChat && (
        <div
          ref={setChatNode}
          role="region"
          aria-label={chatLabel}
          aria-hidden={chatHidden || undefined}
          inert={chatHidden}
          data-work-area-column="chat"
          data-squeezed={squeeze.chat || undefined}
          className={cn(
            // `group/work-area-chat`: the column's scroller widens its content while squeezed.
            // `isolate`: the column's own z-indexed layers stay under the divider's shadow and handle.
            'group/work-area-chat ods-content-area relative isolate flex min-h-0 min-w-0 flex-col',
            // Squeezed: the chat (thread and composer alike) keeps the min width and scrolls
            // sideways here; its header sticks to what is on screen. Its root sits in the
            // content scope (`contents`). The composer's menus open upwards inside the column.
            squeeze.chat
              ? 'overflow-x-auto overflow-y-hidden [&>div>*]:min-w-[var(--work-area-min-width)]'
              : 'overflow-hidden',
            shown === 'chat' && 'flex-1',
            shown === 'split' && 'shrink-0',
            chatHidden && 'hidden',
          )}
          style={
            shown === 'split'
              ? ({
                  ...minWidthVar,
                  width: shownChatWidth ?? `${DEFAULT_CHAT_SHARE * 100}%`,
                  '--work-area-visible-width': shownChatWidth === null ? '100%' : `${shownChatWidth}px`,
                } as CSSProperties)
              : minWidthVar
          }
        >
          <WorkAreaColumnContext.Provider value={chatColumnState}>
            <ContentAreaWidthContext.Provider value={chatContentWidth}>
              <div className="ods-content-scope">{chat}</div>
            </ContentAreaWidthContext.Provider>
          </WorkAreaColumnContext.Provider>
        </div>
      )}
      {shown === 'split' && (
        // A zero-wide slot on the columns' border: the handle straddles it.
        <div className="relative w-0 shrink-0">
          {/* A squeezed column is folded under the divider: a shadow along it, on its side. */}
          {(squeeze.chat || squeeze.page) && (
            <div
              aria-hidden
              data-testid="work-area-squeeze-shadow"
              data-work-area-shadow={squeeze.chat ? 'chat' : 'page'}
              className={cn(
                // The lib's edge fade (the quick actions' carousel, scrolled tables): the page
                // background fading out. Over the columns, which are their own stacking contexts.
                'pointer-events-none absolute inset-y-0 z-10 w-6 to-transparent duration-150 animate-in fade-in motion-reduce:animate-none',
                squeeze.chat ? 'right-0 bg-gradient-to-l from-ods-bg' : 'left-0 bg-gradient-to-r from-ods-bg',
              )}
            />
          )}
          <PanelResizeHandle
            side="left"
            variant="inLayout"
            size={shownChatWidth ?? 0}
            minSize={floor}
            maxSize={maxChatWidth}
            clampSize={clampChatWidth}
            onSize={chooseWidth}
            onDrag={dragChatWidth}
            onDragPastLimit={dragPastLimit}
            onReset={resetWidth}
            ariaLabel={`Resize ${chatLabel.toLowerCase()} column`}
            className="inset-y-0 left-0 w-6 -translate-x-1/2 justify-center pl-0"
            grip={<PanelResizeGrip />}
          />
        </div>
      )}
      <div
        aria-hidden={pageHidden || undefined}
        inert={pageHidden}
        data-work-area-column="page"
        data-squeezed={squeeze.page || undefined}
        style={minWidthVar}
        className={cn(
          // `group/work-area-page`: `AppLayout`'s `<main>` widens its content while squeezed.
          'group/work-area-page relative isolate flex min-h-0 min-w-0 flex-1',
          shown === 'split' && 'border-l border-ods-border',
          pageHidden && 'hidden',
          pageClassName,
        )}
      >
        <WorkAreaColumnContext.Provider value={pageColumnState}>{page}</WorkAreaColumnContext.Provider>
      </div>
    </div>
  );
}
