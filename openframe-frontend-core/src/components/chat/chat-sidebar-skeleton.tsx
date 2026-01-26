import * as React from "react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { ChatPlusIcon } from "../icons-v2-generated"

interface DialogListItemSkeletonProps {
  className?: string
}

const DialogListItemSkeleton = React.forwardRef<HTMLDivElement, DialogListItemSkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-4 overflow-clip",
          "px-4 py-3",
          "border-b border-ods-border",
          "bg-ods-card",
          className
        )}
        {...props}
      >
        {/* Content area skeleton */}
        <div className="flex flex-1 flex-col items-start justify-center gap-1">
          <div className="flex items-center w-full">
            {/* Title skeleton */}
            <div className="h-6 w-full max-w-[200px] bg-ods-border rounded animate-pulse" />
          </div>
          {/* Timestamp skeleton */}
          <div className="h-4 w-32 bg-ods-border rounded animate-pulse" />
        </div>
        
        {/* Right side chevron skeleton */}
        <div className="size-6 bg-ods-border rounded animate-pulse shrink-0" />
      </div>
    )
  }
)

DialogListItemSkeleton.displayName = "DialogListItemSkeleton"

interface ChatSidebarSkeletonProps {
  className?: string
  dialogCount?: number
  showNewChatButton?: boolean
}

const ChatSidebarSkeleton = React.forwardRef<HTMLDivElement, ChatSidebarSkeletonProps>(
  ({ className, dialogCount = 8, showNewChatButton = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "w-80 h-full flex flex-col",
          "bg-ods-bg",
          "border-r border-ods-border",
          className
        )}
        {...props}
      >
        {/* Start New Chat Button */}
        {showNewChatButton && (
          <div className="bg-ods-card border-b border-ods-border flex items-center justify-center px-4 py-1 shrink-0">
            <Button
              variant="ghost"
              disabled={true}
              leftIcon={<ChatPlusIcon className="size-6 text-ods-text-secondary" />}
              className="flex-1 justify-center text-lg font-bold text-ods-text-secondary cursor-not-allowed hover:bg-transparent"
            >
              Start New Chat
            </Button>
          </div>
        )}

        {/* Dialogs List Skeleton */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="flex flex-col">
              {Array.from({ length: dialogCount }).map((_, index) => (
                <DialogListItemSkeleton key={index} />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }
)

ChatSidebarSkeleton.displayName = "ChatSidebarSkeleton"

export { ChatSidebarSkeleton, DialogListItemSkeleton }