'use client';

import { type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
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
/** Where the divider starts until the user moves it: the middle. */
const DEFAULT_CHAT_SHARE = 0.5;

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
 * click for the middle. Neither column gets narrower than `minColumnWidth`; with
 * no room for two such columns the area shows the page column alone.
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
  const maxChatWidth = Math.max(minColumnWidth, rowWidth - minColumnWidth);
  const clampChatWidth = useCallback(
    (next: number) => clamp(next, minColumnWidth, maxChatWidth),
    [minColumnWidth, maxChatWidth],
  );
  const chatWidth = measured ? Math.round(clampChatWidth(share * rowWidth)) : null;

  const chooseWidth = useCallback(
    (next: number) => {
      if (!measured) return;
      const nextShare = clampChatWidth(next) / rowWidth;
      setChosenShare(nextShare);
      storage?.save({ share: nextShare });
    },
    [measured, clampChatWidth, rowWidth, storage],
  );
  const resetWidth = useCallback(() => {
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
          className={cn(
            'ods-content-area relative flex min-h-0 min-w-0 flex-col overflow-hidden',
            shown === 'chat' && 'flex-1',
            shown === 'split' && 'shrink-0',
            chatHidden && 'hidden',
          )}
          style={shown === 'split' ? { width: chatWidth ?? `${DEFAULT_CHAT_SHARE * 100}%` } : undefined}
        >
          <ContentAreaWidthContext.Provider value={chatContentWidth}>
            <div className="ods-content-scope">{chat}</div>
          </ContentAreaWidthContext.Provider>
        </div>
      )}
      {shown === 'split' && (
        // A zero-wide slot on the columns' border: the handle straddles it.
        <div className="relative w-0 shrink-0">
          <PanelResizeHandle
            side="left"
            variant="inLayout"
            size={chatWidth ?? 0}
            minSize={minColumnWidth}
            maxSize={maxChatWidth}
            clampSize={clampChatWidth}
            onSize={chooseWidth}
            panelRef={chatRef}
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
        className={cn(
          'relative flex min-h-0 min-w-0 flex-1',
          shown === 'split' && 'border-l border-ods-border',
          pageHidden && 'hidden',
          pageClassName,
        )}
      >
        {page}
      </div>
    </div>
  );
}
