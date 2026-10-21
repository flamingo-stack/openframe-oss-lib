import { forwardRef, useRef, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { cn } from '../../utils/cn';
import { formatDateWithTimezone, VIEWER_TIMEZONE } from '../../utils/format';
import { ChatPlusIcon, ChatsIcon, Chevron02RightIcon } from '../icons-v2-generated';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { useLoadingScope } from '../ui/loading-scope';
import { CHAT_HISTORY_PAGE_SIZE } from './mingo-chat-history';
import type { ChatSidebarProps, DialogListItemProps } from './types';

/** A dialog row's box, shared by the loaded row and its skeleton so both take the same space. */
const DIALOG_LIST_ITEM_CLASS = 'flex items-center gap-4 overflow-clip px-4 py-3 border-b border-ods-border bg-ods-card';

const DialogListItem = forwardRef<HTMLDivElement, DialogListItemProps>(
  ({ className, dialog, isActive, onDialogSelect, onClick, ...props }, ref) => {
    if (useLoadingScope()) return <DialogListItemSkeleton className={className} />;

    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
      onDialogSelect?.(dialog.id);
      onClick?.(e);
    };

    const formatTimestamp = (timestamp?: Date | string) => {
      // "Your" last-active time in the app shell — the viewer's zone, stated
      // explicitly, with the date and time rendered together by one renderer.
      return formatDateWithTimezone(timestamp, VIEWER_TIMEZONE, 'numericDateTime24h');
    };

    return (
      <div
        ref={ref}
        className={cn(
          DIALOG_LIST_ITEM_CLASS,
          'cursor-pointer transition-colors hover:bg-ods-bg-hover',
          isActive && 'border-l-2 border-l-ods-accent bg-ods-bg-hover',
          className,
        )}
        onClick={handleClick}
        {...props}
      >
        {/* Content area */}
        <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-1">
          <div className="flex w-full min-w-0 items-center">
            <h3
              className={cn(
                'min-w-0 flex-1 text-h6',
                isActive ? 'text-ods-accent' : 'text-ods-text-primary',
                'truncate',
              )}
              title={dialog.title || 'Untitled Chat'}
            >
              {dialog.title || 'Untitled Chat'}
            </h3>
          </div>
          {dialog.timestamp && (
            <p className="w-full min-w-0 truncate text-ods-text-secondary text-h6">
              {formatTimestamp(dialog.timestamp)}
            </p>
          )}
        </div>

        {/* Right side indicator - always visible */}
        <div className="ml-2 flex-shrink-0">
          {dialog.unreadMessagesCount && dialog.unreadMessagesCount > 0 ? (
            <div className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md bg-ods-accent px-[var(--spacing-system-xsf)]">
              <span className="text-ods-text-on-accent text-h6">
                {dialog.unreadMessagesCount > 99 ? '99+' : dialog.unreadMessagesCount}
              </span>
            </div>
          ) : (
            <Chevron02RightIcon className="size-6 text-ods-text-secondary" />
          )}
        </div>
      </div>
    );
  },
);

DialogListItem.displayName = 'DialogListItem';

/** {@link DialogListItem}'s loading state: the same box, the title and time lines, and the chevron. */
function DialogListItemSkeleton({ className, ...props }: { className?: string; 'data-loading-item'?: boolean }) {
  return (
    <div aria-hidden className={cn(DIALOG_LIST_ITEM_CLASS, className)} {...props}>
      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-1">
        <TextLineSkeleton type="h6" className="w-full max-w-[200px]" />
        <TextLineSkeleton type="h6" className="w-32" />
      </div>
      <div className="ml-2 flex-shrink-0">
        <Chevron02RightIcon className="size-6 text-ods-text-secondary" />
      </div>
    </div>
  );
}

const ChatSidebar = forwardRef<HTMLDivElement, ChatSidebarProps>(
  (
    {
      className,
      onNewChat,
      onDialogSelect,
      dialogs = [],
      activeDialogId,
      isLoading,
      isCreatingDialog,
      children,
      hasNextPage,
      isFetchingNextPage,
      onLoadMore,
      pageSize = CHAT_HISTORY_PAGE_SIZE,
      ...props
    },
    ref,
  ) => {
    // ONE switch: the first page with nothing to show yet (or the page's loading state) draws the sidebar with one
    // page of skeleton rows; the shell and its static copy stay real.
    const loading = useLoadingScope() || (!!isLoading && dialogs.length === 0 && !children);
    const showEmptyState = !loading && dialogs.length === 0 && !children;
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    // Refreshed in an effect, not during render: the only reader is the IntersectionObserver callback.
    const onLoadMoreRef = useRef(onLoadMore);
    const isFetchingRef = useRef(isFetchingNextPage);
    useEffect(() => {
      onLoadMoreRef.current = onLoadMore;
      isFetchingRef.current = isFetchingNextPage;
    });

    useEffect(() => {
      const scrollContainer = scrollContainerRef.current;
      const loadMoreElement = loadMoreRef.current;
      if (!scrollContainer || !loadMoreElement || !hasNextPage) return undefined;

      const observer = new IntersectionObserver(
        entries => {
          const [entry] = entries;
          if (entry.isIntersecting && !isFetchingRef.current) {
            onLoadMoreRef.current?.();
          }
        },
        { root: scrollContainer, rootMargin: '100px', threshold: 0.1 },
      );
      observer.observe(loadMoreElement);
      return () => observer.disconnect();
    }, [hasNextPage]);

    return (
      <div
        ref={ref}
        className={cn('flex h-full w-80 flex-col', 'bg-ods-bg', 'border-r border-ods-border', className)}
        {...props}
      >
        {/* Start New Chat Button */}
        <div className="flex shrink-0 items-center justify-center border-b border-ods-border bg-ods-card px-4 py-1">
          <Button
            onClick={onNewChat}
            variant="transparent"
            disabled={isLoading || isCreatingDialog}
            leftIcon={<ChatPlusIcon className="size-6 text-ods-text-secondary" />}
            className="flex-1 justify-center text-ods-text-primary text-h3 hover:bg-ods-bg-hover focus-visible:ring-0"
          >
            Start New Chat
          </Button>
        </div>

        {/* Dialogs List or Content Area */}
        <div className="flex min-h-0 flex-1 flex-col">
          {showEmptyState ? (
            /* Empty State */
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
              <ChatsIcon className="h-6 w-6 text-ods-text-secondary" />
              <div className="space-y-2 text-center">
                <h3 className="text-ods-text-secondary text-h4">No Current Chats</h3>
                <p className="text-ods-text-secondary text-h6">Previous Mingo sessions will show here</p>
              </div>
            </div>
          ) : loading ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="flex flex-col">
                {Array.from({ length: pageSize }, (_, index) => (
                  <DialogListItemSkeleton key={index} data-loading-item />
                ))}
              </div>
            </div>
          ) : children ? (
            /* Custom children content */
            <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
          ) : (
            /* Dialogs List */
            <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="flex flex-col">
                {dialogs.map(dialog => (
                  <DialogListItem
                    key={dialog.id}
                    data-loading-item
                    dialog={dialog}
                    isActive={dialog.id === activeDialogId}
                    onDialogSelect={onDialogSelect}
                  />
                ))}

                {/* Infinite scroll intersection target; the next page draws as one page of skeleton rows. */}
                {hasNextPage && (
                  <div ref={loadMoreRef}>
                    {isFetchingNextPage &&
                      Array.from({ length: pageSize }, (_, index) => (
                        <DialogListItemSkeleton key={index} data-loading-item />
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  },
);

ChatSidebar.displayName = 'ChatSidebar';

export { ChatSidebar, DialogListItem };
