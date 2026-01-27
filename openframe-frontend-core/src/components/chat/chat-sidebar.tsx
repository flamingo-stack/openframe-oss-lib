import { forwardRef, useRef, useEffect } from "react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { ChatPlusIcon, ChatsIcon } from "../icons-v2-generated"
import { Chevron02RightIcon } from "../icons-v2-generated"
import { ChatSidebarSkeleton, DialogListItemSkeleton } from "./chat-sidebar-skeleton"
import type { ChatSidebarProps, DialogListItemProps } from "./types"

const DialogListItem = forwardRef<HTMLDivElement, DialogListItemProps>(
  ({ className, dialog, isActive, onDialogSelect, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      onDialogSelect?.(dialog.id)
      onClick?.(e)
    }

    const formatTimestamp = (timestamp?: Date | string) => {
      if (!timestamp) return ''
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center gap-4 overflow-clip",
          "px-4 py-3",
          "cursor-pointer border-b border-ods-border",
          "bg-ods-card",
          "hover:bg-ods-bg-hover transition-colors",
          isActive && "bg-ods-bg-hover border-l-2 border-l-ods-accent",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {/* Content area */}
        <div className="flex flex-1 flex-col items-start justify-center gap-1 min-w-0">
          <div className="flex items-center w-full min-w-0">
            <h3 className={cn(
              "text-base font-medium leading-5 min-w-0 flex-1",
              isActive ? "text-ods-accent" : "text-ods-text-primary",
              "truncate"
            )} title={dialog.title || 'Untitled Chat'}>
              {dialog.title || 'Untitled Chat'}
            </h3>
          </div>
          {dialog.timestamp && (
            <p className="text-sm text-ods-text-secondary truncate w-full min-w-0">
              {formatTimestamp(dialog.timestamp)}
            </p>
          )}
        </div>
        
        {/* Right side indicator - always visible */}
        <div className="flex-shrink-0 ml-2">
          {dialog.unreadMessagesCount && dialog.unreadMessagesCount > 0 ? (
            <div className="bg-ods-accent flex items-center justify-center p-2 rounded-md size-6">
              <span className="text-xs font-medium text-ods-text-on-accent">
                {dialog.unreadMessagesCount > 99 ? '99+' : dialog.unreadMessagesCount}
              </span>
            </div>
          ) : (
            <Chevron02RightIcon className="size-6 text-ods-text-secondary" />
          )}
        </div>
      </div>
    )
  }
)

DialogListItem.displayName = "DialogListItem"

const ChatSidebar = forwardRef<HTMLDivElement, ChatSidebarProps>(
  ({ className, onNewChat, onDialogSelect, dialogs = [], activeDialogId, isLoading, children, hasNextPage, isFetchingNextPage, onLoadMore, ...props }, ref) => {
    const showEmptyState = dialogs.length === 0 && !children
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const loadMoreRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const scrollContainer = scrollContainerRef.current
      const loadMoreElement = loadMoreRef.current

      if (!scrollContainer || !loadMoreElement || !hasNextPage || isFetchingNextPage) {
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const [entry] = entries
          if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
            onLoadMore?.()
          }
        },
        {
          root: scrollContainer,
          rootMargin: '100px',
          threshold: 0.1
        }
      )

      observer.observe(loadMoreElement)

      return () => {
        observer.unobserve(loadMoreElement)
      }
    }, [hasNextPage, isFetchingNextPage, onLoadMore])

    if (isLoading && dialogs.length === 0 && !children) {
      return (
        <ChatSidebarSkeleton
          className={className}
          dialogCount={8}
          showNewChatButton={true}
        />
      )
    }

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
        <div className="bg-ods-card border-b border-ods-border flex items-center justify-center px-4 py-1 shrink-0">
          <Button
            onClick={onNewChat}
            variant="ghost"
            disabled={isLoading}
            leftIcon={<ChatPlusIcon className="size-6 text-ods-text-secondary" />}
            className="flex-1 justify-center text-lg font-bold text-ods-text-primary hover:bg-ods-bg-hover"
          >
            Start New Chat
          </Button>
        </div>

        {/* Dialogs List or Content Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {showEmptyState ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
              <ChatsIcon className="w-6 h-6 text-ods-text-secondary" />
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium text-ods-text-secondary">
                  No Current Chats
                </h3>
                <p className="text-sm font-medium text-ods-text-secondary">
                  Previous Mingo sessions will show here
                </p>
              </div>
            </div>
          ) : children ? (
            /* Custom children content */
            <div className="flex-1 overflow-y-auto">
              {children}
            </div>
          ) : (
            /* Dialogs List */
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0">
              <div className="flex flex-col">
                {dialogs.map((dialog) => (
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
    )
  }
)

ChatSidebar.displayName = "ChatSidebar"

export { ChatSidebar, DialogListItem }