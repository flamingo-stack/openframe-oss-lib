import { forwardRef, useRef, useEffect } from 'react';
import type { MouseEvent } from 'react';
import { cn } from '../../utils/cn';
import { ChatPlusIcon, ChatsIcon, Chevron02RightIcon } from '../icons-v2-generated';
import { Button } from '../ui/button';
import { ChatSidebarSkeleton, DialogListItemSkeleton } from './chat-sidebar-skeleton';
import type { ChatSidebarProps, DialogListItemProps } from './types';

const DialogListItem = forwardRef<HTMLDivElement, DialogListItemProps>(
  ({ className, dialog, isActive, onDialogSelect, onClick, ...props }, ref) => {
    const handleClick = (e: MouseEvent<HTMLDivElement>) => {
      onDialogSelect?.(dialog.id);
      onClick?.(e);
    };

    const formatTimestamp = (timestamp?: Date | string) => {
      if (!timestamp) return '';
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      return (
        date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }) +
        ', ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-4 overflow-clip',
          'px-4 py-3',
          'cursor-pointer border-b border-ods-border',
          'bg-ods-card',
          'transition-colors hover:bg-ods-bg-hover',
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
            <div className="flex size-6 items-center justify-center rounded-md bg-ods-accent p-2">
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
      ...props
    },
    ref,
  ) => {
    const showEmptyState = dialogs.length === 0 && !children;
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const loadMoreRef = useRef<HTMLDivElement>(null);
    const onLoadMoreRef = useRef(onLoadMore);
    onLoadMoreRef.current = onLoadMore;
    const isFetchingRef = useRef(isFetchingNextPage);
    isFetchingRef.current = isFetchingNextPage;

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

    if (isLoading && dialogs.length === 0 && !children) {
      return <ChatSidebarSkeleton className={className} dialogCount={8} showNewChatButton={true} />;
    }

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
                    dialog={dialog}
                    isActive={dialog.id === activeDialogId}
                    onDialogSelect={onDialogSelect}
                  />
                ))}

                {/* Infinite scroll loading indicator and intersection target */}
                {hasNextPage && (
                  <div ref={loadMoreRef}>
                    {isFetchingNextPage && (
                      <>
                        <DialogListItemSkeleton />
                        <DialogListItemSkeleton />
                        <DialogListItemSkeleton />
                      </>
                    )}
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
