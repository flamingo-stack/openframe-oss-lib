'use client';

import { useEffect, useRef } from 'react';
import { formatRelativeTime } from '../../utils/date-utils';
import { BoxArchiveIcon } from '../icons-v2-generated';
import { SquareAvatar } from '../ui/square-avatar';
import { ChatListEmptyState } from './chat-list-empty-state';
import { ChatListItem } from './chat-nav-sidebar';
import type { DialogItem } from './types/component.types';

export interface MingoArchiveListProps {
  dialogs: ReadonlyArray<DialogItem>;
  onSelectDialog?: (id: string) => void;
  /** The first page is loading. */
  isLoading?: boolean;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

/**
 * The Mingo v2 chat archive (Figma "chat archive"): it opens in the chat
 * column with the chat list kept beside it, one row per archived chat with
 * how long ago it was active and its owner.
 */
export function MingoArchiveList({
  dialogs,
  onSelectDialog,
  isLoading = false,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
}: MingoArchiveListProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const isLoadingMoreRef = useRef(isLoadingMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
    isLoadingMoreRef.current = isLoadingMore;
  });
  const dialogCount = dialogs.length;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isLoadingMoreRef.current) onLoadMoreRef.current?.();
      },
      { rootMargin: '120px', threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, dialogCount, isLoadingMore]);

  return (
    <section
      aria-label="Archived chats"
      className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-xxs)] px-[var(--spacing-system-xs)] pt-[var(--spacing-system-mf)]"
    >
      <p className="shrink-0 px-[var(--spacing-system-xs)] pt-[var(--spacing-system-xs)] text-ods-text-secondary text-h5">
        Archived Chats
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-[var(--spacing-system-xxs)] overflow-y-auto overscroll-contain pb-[var(--spacing-system-mf)]">
        {dialogs.length > 0 ? (
          <>
            {dialogs.map(dialog => (
              <ChatListItem
                key={dialog.id}
                title={dialog.title || 'Untitled Chat'}
                onClick={() => onSelectDialog?.(dialog.id)}
                trailing={
                  <span className="flex items-center gap-[var(--spacing-system-xs)]">
                    {dialog.timestamp && (
                      <span className="whitespace-nowrap text-ods-text-secondary text-h6">
                        {formatRelativeTime(dialog.timestamp)}
                      </span>
                    )}
                    {dialog.owner && (dialog.owner.name || dialog.owner.avatarUrl) ? (
                      <SquareAvatar
                        variant="round"
                        sizePx={24}
                        src={dialog.owner.avatarUrl || undefined}
                        alt={dialog.owner.name || undefined}
                        fallback={dialog.owner.name || undefined}
                        title={dialog.owner.name || undefined}
                      />
                    ) : null}
                  </span>
                }
              />
            ))}
            {hasMore && <div ref={sentinelRef} className="h-px shrink-0" aria-hidden />}
          </>
        ) : isLoading ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-10 shrink-0 animate-pulse rounded-md bg-ods-skeleton" aria-hidden />
          ))
        ) : (
          <ChatListEmptyState
            icon={<BoxArchiveIcon size={24} />}
            title="No Archived Chats"
            description="Archived Mingo sessions will show here"
          />
        )}
      </div>
    </section>
  );
}
