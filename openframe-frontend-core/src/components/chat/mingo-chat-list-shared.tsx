'use client';

import { type ReactNode, type RefObject, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';
import {
  AlertCircleIcon,
  DotsLoaderIcon,
  MessageIndicatorIcon,
  Refresh01RightIcon,
  ShieldCheckIcon,
} from '../icons-v2-generated';
import { Button } from '../ui/button';
import type { DialogItem } from './types/component.types';

/** Ownership scope of a Mingo chat list: the current user's chats only, or
 *  every admin's chats in the tenant. */
export type MingoHistoryScope = 'my' | 'all';

/**
 * What a chat is doing, shown at the end of its row:
 * - `working`: Mingo is answering in it
 * - `unread`: a reply the user has not seen
 * - `approval`: Mingo waits for an approval there
 */
export type MingoDialogStatus = 'working' | 'unread' | 'approval';

/** One glyph per status, for every Mingo chat list (the v2 rail, the sidebar section). */
export const MINGO_DIALOG_STATUS_GLYPHS: Record<MingoDialogStatus, { icon: ReactNode; label: string }> = {
  working: { icon: <DotsLoaderIcon className="text-ods-text-secondary" />, label: 'Mingo is working' },
  unread: { icon: <MessageIndicatorIcon className="text-ods-accent" />, label: 'New reply' },
  approval: { icon: <ShieldCheckIcon className="text-ods-accent" />, label: 'Waiting for approval' },
};

/**
 * The list both Mingo chat lists render — the v2 panel's rail and the main
 * sidebar's chat-history section (`MingoChatRail` `variant`). The host owns the
 * data, the scope, the search term and the paging; the list only shows them.
 */
export interface MingoChatListProps {
  /** Dialogs to list, newest first. */
  dialogs: ReadonlyArray<DialogItem>;
  activeDialogId?: string;
  onSelectDialog?: (id: string) => void;
  /** A chat being started and not saved yet: a selected row at the top
   *  (e.g. "New Chat"), so the list says what the chat beside it is. */
  draftTitle?: string;
  /** Open the archive. The rail lists it as an action; the section puts
   *  "Chat archive" in its ⋯ menu. */
  onOpenArchive?: () => void;
  /** A row's status glyph. Unread replies are shown without it. */
  statusOf?: (dialog: DialogItem) => MingoDialogStatus | undefined;
  /** Row ⋯ menu actions — each item appears only when its handler is set. */
  onRequestRename?: (dialog: DialogItem) => void;
  onRequestArchive?: (dialog: DialogItem) => void;
  onRequestCopyLink?: (dialog: DialogItem) => void;
  onRequestCompact?: (dialog: DialogItem) => void;
  /** My Chats / All Chats; both or neither. The rail offers it in its ⋯
   *  menu, the section as a `TabSelector`. */
  scope?: MingoHistoryScope;
  onScopeChange?: (scope: MingoHistoryScope) => void;
  /** Server-side search: `searchQuery` is the host's term, `onSearchChange`
   *  receives the debounced input. Without a handler there is no search. */
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  /** Whether the search field is open. Controlled with `onSearchOpenChange`
   *  (e.g. a host that opens it on ⌘K); without it the list keeps its own
   *  state, open from the start while `searchQuery` holds a term. Escape, or
   *  leaving the field empty, clears the term and asks to close. The section's
   *  Search tooltip names ⌘K / Ctrl K: binding that key is the host's (it may
   *  have to open a collapsed sidebar first), the list listens for none. */
  searchOpen?: boolean;
  onSearchOpenChange?: (open: boolean) => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  /** The first page is still loading. */
  isLoadingHistory?: boolean;
  /** The list failed to load with nothing cached. */
  loadError?: boolean;
  onRetry?: () => void;
  /** Section only: the chat belongs to someone other than the viewer, so its
   *  row shows the owner's (`dialog.owner`) initials. The row cannot tell on
   *  its own: hosts set `owner` on the viewer's chats too. */
  ownedByOther?: (dialog: DialogItem) => boolean;
  className?: string;
}

/** The host's status for the row, else an unread reply when the row counts one. */
export function mingoDialogStatusOf(
  dialog: DialogItem,
  statusOf: ((dialog: DialogItem) => MingoDialogStatus | undefined) | undefined,
): MingoDialogStatus | undefined {
  return statusOf?.(dialog) ?? ((dialog.unreadMessagesCount ?? 0) > 0 ? 'unread' : undefined);
}

/**
 * "Couldn't load your chats" + Try again: what a Mingo chat list shows when its
 * first page failed with nothing cached. One block for every list, so the
 * wording cannot drift between them.
 */
export function ChatListLoadError({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-[var(--spacing-system-m)] text-center', className)}>
      <AlertCircleIcon className="size-8 shrink-0 text-ods-text-secondary" />
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <p className="text-ods-text-primary text-h4">Couldn’t load your chats</p>
        <p className="text-ods-text-secondary text-h6">Something went wrong reaching the server. Try again.</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="small" leftIcon={<Refresh01RightIcon />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export interface LoadMoreSentinelOptions {
  /** Whether more rows remain (cursor pagination). */
  hasMore: boolean;
  /** True while the next page is loading: no second request meanwhile. */
  isLoadingMore: boolean;
  /** Fetch the next page. */
  onLoadMore?: () => void;
  /** Rows rendered so far: a landed page re-arms the observer. */
  itemCount: number;
  /** The scrolling element the sentinel is clipped by. Omitted: the viewport. */
  rootRef?: RefObject<HTMLElement | null>;
}

/**
 * Infinite scroll for a chat list: put the returned ref on a 1px sentinel after
 * the last row (rendered only while `hasMore`), and `onLoadMore` fires when it
 * comes into view.
 */
export function useLoadMoreSentinel({
  hasMore,
  isLoadingMore,
  onLoadMore,
  itemCount,
  rootRef,
}: LoadMoreSentinelOptions) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Refreshed in an unconditional effect, declared before the observer effect
  // so it wins the same flush. Not in the render body: the only reader is the
  // IntersectionObserver callback, which cannot fire before a commit, and a
  // discarded render attempt must not install a loading flag that never was.
  const onLoadMoreRef = useRef(onLoadMore);
  const isLoadingMoreRef = useRef(isLoadingMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
    isLoadingMoreRef.current = isLoadingMore;
  });
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = rootRef ? rootRef.current : null;
    if (!sentinel || (rootRef && !root) || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isLoadingMoreRef.current) onLoadMoreRef.current?.();
      },
      { root, rootMargin: '120px', threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // `itemCount`/`isLoadingMore` re-arm the observer after every page lands:
    // `observe()` re-reports the CURRENT intersection, so a sentinel that stays
    // in view (a short page, e.g. the "My Chats" scope) keeps chaining loads
    // until the list fills its box or `hasMore` flips. A sentinel that never
    // leaves the view never re-crosses the threshold, so an observer armed once
    // would load a single page per mount.
  }, [hasMore, isLoadingMore, itemCount, rootRef]);
  return sentinelRef;
}
