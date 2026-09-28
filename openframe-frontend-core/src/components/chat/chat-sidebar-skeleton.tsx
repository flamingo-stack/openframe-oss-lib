import { forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { ChatPlusIcon } from '../icons-v2-generated';
import { Button } from '../ui/button';

interface DialogListItemSkeletonProps {
  className?: string;
}

const DialogListItemSkeleton = forwardRef<HTMLDivElement, DialogListItemSkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-4 overflow-clip',
          'px-4 py-3',
          'border-b border-ods-border',
          'bg-ods-card',
          className,
        )}
        {...props}
      >
        {/* Content area skeleton */}
        <div className="flex flex-1 flex-col items-start justify-center gap-1">
          <div className="flex w-full items-center">
            {/* Title skeleton */}
            <div className="h-6 w-full max-w-[200px] animate-pulse rounded bg-ods-border" />
          </div>
          {/* Timestamp skeleton */}
          <div className="h-4 w-32 animate-pulse rounded bg-ods-border" />
        </div>

        {/* Right side chevron skeleton */}
        <div className="size-6 shrink-0 animate-pulse rounded bg-ods-border" />
      </div>
    );
  },
);

DialogListItemSkeleton.displayName = 'DialogListItemSkeleton';

interface ChatSidebarSkeletonProps {
  className?: string;
  dialogCount?: number;
  showNewChatButton?: boolean;
}

const ChatSidebarSkeleton = forwardRef<HTMLDivElement, ChatSidebarSkeletonProps>(
  ({ className, dialogCount = 8, showNewChatButton = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex h-full w-80 flex-col', 'bg-ods-bg', 'border-r border-ods-border', className)}
        {...props}
      >
        {/* Start New Chat Button */}
        {showNewChatButton && (
          <div className="flex shrink-0 items-center justify-center border-b border-ods-border bg-ods-card px-4 py-1">
            <Button
              variant="transparent"
              disabled={true}
              leftIcon={<ChatPlusIcon className="size-6 text-ods-text-secondary" />}
              className="flex-1 cursor-not-allowed justify-center text-ods-text-secondary text-h3 hover:bg-transparent"
            >
              Start New Chat
            </Button>
          </div>
        )}

        {/* Dialogs List Skeleton */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="flex flex-col">
              {Array.from({ length: dialogCount }).map((_, index) => (
                <DialogListItemSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  },
);

ChatSidebarSkeleton.displayName = 'ChatSidebarSkeleton';

export { ChatSidebarSkeleton, DialogListItemSkeleton };
