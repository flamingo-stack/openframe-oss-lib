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
 * mounted, `inert` and `aria-hidden`, so a page keeps its state while the other side
 * has the room. Once it has been on screen it also stays laid out, unpainted, at the
 * width it last had: a `display: none` box measures 0, which a stick-to-bottom thread
 * reads as a jump to its end (it pulls the reader back down when the column returns),
 * a page's breakpoints read as a phone, and every enter animation in it replays on the
 * way back. Its scrollers keep their offsets. A column never shown yet is `display: none`.
 */
export type AppLayoutWorkAreaMode = 'chat' | 'split' | 'page';

/** The narrowest either column gets in `split`. */
export const WORK_AREA_MIN_COLUMN_WIDTH = 360;
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

/** The width each column last had on screen, px; `null` for a column never shown. */
interface KeptWidths {
  chat: number | null;
  page: number | null;
}

const NO_KEPT_WIDTHS: KeptWidths = { chat: null, page: null };

/**
 * A hidden column that has been on screen: out of the row's flow, at the width it kept (its
 * style), never wider than the row, pinned to its side of the row, painted at `opacity-0`.
 * Not `invisible`: a descendant may set `visibility: visible` (a remote screen's canvas, an
 * expanded list) and paint through it, and every descendant with a `duration-*` and the
 * default `transition-property: all` transitions the inherited visibility on the way back,
 * which keeps it hidden for the first frame (a blink). `inert` and `aria-hidden` (on the
 * column) take it out of focus, the accessibility tree and find-in-page; `-z-10` stacks it
 * under the column on screen, which spans the row, so nothing in it wins a hit test, a
 * descendant's own `pointer-events: auto` included, even where `inert` is not supported.
 */
const KEPT_HIDDEN_CLASS = 'pointer-events-none absolute inset-y-0 -z-10 max-w-full opacity-0';

/** Which sides of a sideways scroller's content are out of view. */
interface HiddenSides {
  start: boolean;
  end: boolean;
}

/** A squeezed column not measured yet shows its start: the rest of it is past its end. */
const AT_START: HiddenSides = { start: false, end: true };
const NO_HIDDEN_SIDES: HiddenSides = { start: false, end: false };

function hiddenSidesOf(element: HTMLElement): HiddenSides {
  // Nothing laid out (no layout engine, a column not drawn yet): assume its start.
  if (element.scrollWidth === 0) return AT_START;
  const overflow = element.scrollWidth - element.clientWidth;
  if (overflow <= 1) return NO_HIDDEN_SIDES;
  return { start: element.scrollLeft > 1, end: element.scrollLeft < overflow - 1 };
}

/**
 * The sides of `element`'s content scrolled out of view, live (its scroll, its size), while
 * `active`: where a squeezed column's shadow goes, on the side that hides something.
 */
function useHiddenSides(element: HTMLElement | null, active: boolean): HiddenSides {
  const [sides, setSides] = useState<HiddenSides>(AT_START);
  useIsomorphicLayoutEffect(() => {
    if (!active || !element) {
      setSides(AT_START);
      return undefined;
    }
    const update = () =>
      setSides(previous => {
        const next = hiddenSidesOf(element);
        return previous.start === next.start && previous.end === next.end ? previous : next;
      });
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [element, active]);
  return active ? sides : NO_HIDDEN_SIDES;
}

/** A squeezed column's edge fade: the page background fading out (the lib's edge fade, as the quick actions' carousel). */
const SQUEEZE_SHADOW_CLASS =
  'pointer-events-none absolute inset-y-0 z-10 w-6 to-transparent duration-150 animate-in fade-in motion-reduce:animate-none';

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
   * column's own scroller does it), its header stays on screen, and a shadow on each of its
   * edges that hides content (scrolled out of view) marks it: at first its far edge, the
   * page's right one, the chat's at the divider. Omit (default): no column gets narrower
   * than `minColumnWidth`.
   *
   * With it the split also holds in a row narrower than two `minColumnWidth`s (down to two
   * floors): the chat column keeps `minColumnWidth` there and the page column is the one
   * squeezed, until the user drags the divider in this mount. Without it such a row shows
   * the page column alone.
   */
  squeezeFloor?: number;
  /**
   * Called with the columns actually on screen whenever they change: `mode`, or `page`
   * when there is no chat or no room for a split. A host that draws chrome per column
   * (a composer under the page alone, a header's Full screen) follows this, not `mode`.
   */
  onShownModeChange?: (shown: AppLayoutWorkAreaMode) => void;
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
 * `minColumnWidth` and scrolled sideways, a shadow on each side it hides; with no room
 * for two such columns the area shows the page column alone (`onShownModeChange` says so).
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
  onShownModeChange,
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
  // The divider was moved in this mount (and not reset since): its share holds in a narrow row too.
  const [moved, setMoved] = useState(false);
  const share = chosenShare ?? storedShare ?? DEFAULT_CHAT_SHARE;

  const measured = rowWidth > 0;
  const squeezes = squeezeFloor !== undefined && squeezeFloor > 0 && squeezeFloor < 1;
  // The narrowest a column gets on screen: `minColumnWidth`, or its squeeze floor.
  const floor = squeezes ? Math.round(minColumnWidth * squeezeFloor) : minColumnWidth;
  // Room for two columns at their narrowest: two min widths, or two floors when they squeeze.
  const canSplit = !measured || rowWidth >= 2 * floor;
  const hasChat = chat !== null;
  const shown: AppLayoutWorkAreaMode = !hasChat ? 'page' : mode === 'split' && !canSplit ? 'page' : mode;
  const maxChatWidth = Math.max(floor, rowWidth - floor);
  const clampChatWidth = useCallback((next: number) => clamp(next, floor, maxChatWidth), [floor, maxChatWidth]);
  // A row too narrow for two min widths: the chat keeps its min width and the page is the one
  // squeezed, whatever share an earlier, wider row left — until the divider is moved here.
  const narrowRow = squeezes && measured && rowWidth < 2 * minColumnWidth;
  const chatWidth = measured
    ? Math.round(clampChatWidth(narrowRow && !moved ? Math.max(share * rowWidth, minColumnWidth) : share * rowWidth))
    : null;

  // The latest callback, for an effect that runs only when the columns change. Before paint:
  // a host drawing chrome per column (the composer's place) moves it in the same frame.
  const onShownModeChangeRef = useRef(onShownModeChange);
  useIsomorphicLayoutEffect(() => {
    onShownModeChangeRef.current = onShownModeChange;
  });
  useIsomorphicLayoutEffect(() => {
    onShownModeChangeRef.current?.(shown);
  }, [shown]);

  // The width the drag has reached, until it is released: what the chat column draws while it
  // is dragged. State, not a write to the DOM: the row can change under a drag (a sidebar
  // toggled and animating, the window resized), and each render then drew the chosen share's width over the
  // dragged one — the column jumped back and forth. Cheap: the columns' content is the same
  // elements every render, and React skips them.
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const dragChatWidth = useCallback((next: number) => setDragWidth(Math.round(next)), []);
  const shownChatWidth = dragWidth === null ? chatWidth : Math.round(clampChatWidth(dragWidth));

  const chooseWidth = useCallback(
    (next: number) => {
      setDragWidth(null);
      if (!measured) return;
      const nextShare = clampChatWidth(next) / rowWidth;
      setChosenShare(nextShare);
      setMoved(true);
      storage?.save({ share: nextShare });
    },
    [measured, clampChatWidth, rowWidth, storage],
  );
  const resetWidth = useCallback(() => {
    setDragWidth(null);
    setChosenShare(DEFAULT_CHAT_SHARE);
    setMoved(false);
    storage?.clear();
  }, [storage]);

  const setChatNode = useCallback((node: HTMLDivElement | null) => {
    chatRef.current = node;
    setChatElement(node);
  }, []);
  const chatContentWidth = useContentWidth(chatElement);
  const [pageElement, setPageElement] = useState<HTMLDivElement | null>(null);

  const chatHidden = shown === 'page';
  const pageHidden = shown === 'chat';
  // Each column's width on screen, px; `null` while it is hidden or the row is not measured.
  const chatOnScreen = !measured ? null : shown === 'chat' ? rowWidth : shown === 'split' ? shownChatWidth : null;
  const pageOnScreen = !measured
    ? null
    : shown === 'page'
      ? rowWidth
      : shown === 'split' && shownChatWidth !== null
        ? rowWidth - shownChatWidth
        : null;
  // The width each column last had on screen. A hidden column stays laid out at it (see
  // `AppLayoutWorkAreaMode`); one never shown has none and is `display: none`.
  const [lastWidths, setLastWidths] = useState<KeptWidths>(NO_KEPT_WIDTHS);
  if (
    (chatOnScreen !== null && chatOnScreen !== lastWidths.chat) ||
    (pageOnScreen !== null && pageOnScreen !== lastWidths.page)
  ) {
    setLastWidths({ chat: chatOnScreen ?? lastWidths.chat, page: pageOnScreen ?? lastWidths.page });
  }
  const chatKeptWidth = chatHidden ? lastWidths.chat : null;
  const pageKeptWidth = pageHidden ? lastWidths.page : null;
  // Which column is narrower than `minColumnWidth`: on screen in `split`, or kept hidden at
  // such a width (its content keeps the min width, so it does not reflow on the way).
  const chatLaidOut = chatKeptWidth ?? (shown === 'split' ? chatOnScreen : null);
  const pageLaidOut = pageKeptWidth ?? (shown === 'split' ? pageOnScreen : null);
  const squeeze: Squeeze = {
    chat: squeezes && chatLaidOut !== null && chatLaidOut < minColumnWidth,
    page: squeezes && pageLaidOut !== null && pageLaidOut < minColumnWidth,
  };
  const chatColumnState = useMemo<WorkAreaColumnState>(
    () => ({ squeezed: squeeze.chat, minWidth: minColumnWidth }),
    [squeeze.chat, minColumnWidth],
  );
  const pageColumnState = useMemo<WorkAreaColumnState>(
    () => ({ squeezed: squeeze.page, minWidth: minColumnWidth }),
    [squeeze.page, minColumnWidth],
  );
  // The squeezed columns' scrollers: the chat column itself; in the page column the host's
  // scroller (`AppLayout`'s `<main>`, `data-work-area-scroller`), else the column.
  const [pageScroller, setPageScroller] = useState<HTMLElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    if (!pageElement) return;
    setPageScroller(pageElement.querySelector<HTMLElement>('[data-work-area-scroller]') ?? pageElement);
  }, [pageElement, squeeze.page]);
  const chatHiddenSides = useHiddenSides(chatElement, squeeze.chat && !chatHidden);
  const pageHiddenSides = useHiddenSides(pageScroller, squeeze.page && !pageHidden);
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
            chatHidden && (chatKeptWidth === null ? 'hidden' : cn(KEPT_HIDDEN_CLASS, 'left-0')),
          )}
          style={
            shown === 'split'
              ? ({
                  ...minWidthVar,
                  width: shownChatWidth ?? `${DEFAULT_CHAT_SHARE * 100}%`,
                  '--work-area-visible-width': shownChatWidth === null ? '100%' : `${shownChatWidth}px`,
                } as CSSProperties)
              : chatKeptWidth !== null
                ? ({
                    ...minWidthVar,
                    width: chatKeptWidth,
                    '--work-area-visible-width': `${chatKeptWidth}px`,
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
          {/* A squeezed column's shadows along the divider: the chat's end, the page's start
              (past the page's `border-l`, the divider's line, which it would cover otherwise). */}
          {chatHiddenSides.end && (
            <div
              aria-hidden
              data-testid="work-area-squeeze-shadow"
              data-work-area-shadow="chat-end"
              className={cn(SQUEEZE_SHADOW_CLASS, 'right-0 bg-gradient-to-l from-ods-bg')}
            />
          )}
          {pageHiddenSides.start && (
            <div
              aria-hidden
              data-testid="work-area-squeeze-shadow"
              data-work-area-shadow="page-start"
              className={cn(SQUEEZE_SHADOW_CLASS, 'left-px bg-gradient-to-r from-ods-bg')}
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
            onReset={resetWidth}
            ariaLabel={`Resize ${chatLabel.toLowerCase()} column`}
            className="inset-y-0 left-0 w-6 -translate-x-1/2 justify-center pl-0"
            grip={<PanelResizeGrip />}
          />
        </div>
      )}
      <div
        ref={setPageElement}
        aria-hidden={pageHidden || undefined}
        inert={pageHidden}
        data-testid="work-area-page-column"
        data-work-area-column="page"
        data-squeezed={squeeze.page || undefined}
        style={pageKeptWidth !== null ? { ...minWidthVar, width: pageKeptWidth } : minWidthVar}
        className={cn(
          // `group/work-area-page`: `AppLayout`'s `<main>` widens its content while squeezed.
          'group/work-area-page relative isolate flex min-h-0 min-w-0 flex-1',
          shown === 'split' && 'border-l border-ods-border',
          pageHidden && (pageKeptWidth === null ? 'hidden' : cn(KEPT_HIDDEN_CLASS, 'right-0')),
          pageClassName,
        )}
      >
        <WorkAreaColumnContext.Provider value={pageColumnState}>{page}</WorkAreaColumnContext.Provider>
      </div>
      {/* The squeezed columns' shadows at the row's outer edges: the chat's start, the page's end. */}
      {chatHiddenSides.start && (
        <div
          aria-hidden
          data-testid="work-area-squeeze-shadow"
          data-work-area-shadow="chat-start"
          className={cn(SQUEEZE_SHADOW_CLASS, 'left-0 bg-gradient-to-r from-ods-bg')}
        />
      )}
      {pageHiddenSides.end && (
        <div
          aria-hidden
          data-testid="work-area-squeeze-shadow"
          data-work-area-shadow="page-end"
          className={cn(SQUEEZE_SHADOW_CLASS, 'right-0 bg-gradient-to-l from-ods-bg')}
        />
      )}
    </div>
  );
}
