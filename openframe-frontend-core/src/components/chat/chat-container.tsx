import * as React from "react"
import { cn } from "../../utils/cn"
import { SquareAvatar as Avatar } from "../ui/square-avatar"
import { Button } from "../ui/button"
import { PlusCircleIcon } from "../plus-circle-icon"
import { XmarkIcon } from "../icons-v2-generated/signs-and-symbols/xmark-icon"
import { Chevron02LeftIcon } from "../icons-v2-generated"
import { TicketStatusTag } from "../ui/ticket-status-tag"
import type { ConnectionIndicatorProps, ChatContainerProps, ChatHeaderProps } from "./types"

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-500 animate-pulse'
      case 'disconnected':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="flex items-center">
      <output
        className={cn(
          "w-2 h-2 rounded-full block",
          getStatusStyles()
        )}
        aria-label={`Connection status: ${status}`}
        title={status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
      />
    </div>
  )
}

const ChatContainer = React.forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-screen w-full flex-col",
          "bg-ods-bg text-ods-text-primary",
          "px-4 md:px-6 lg:px-8 pt-10 pb-8",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

ChatContainer.displayName = "ChatContainer"

const ChatHeader = React.forwardRef<HTMLDivElement, ChatHeaderProps>(
  ({ className, userName = 'Grace "Fae" Meadows', userTitle = "Your Personal Assistant", userAvatar, userIcon, onSettingsClick, onNewChat, onClose, onBack, showNewChat = false, connectionStatus = 'disconnected', serverUrl = null, headerActions, ticketInfo, ...props }, ref) => {
    const cardClasses = "rounded-md bg-ods-card shadow-[0_18px_48px_rgba(0,0,0,0.45)] border border-ods-border ring-1 ring-black/20"
    return (
      <div
        ref={ref}
        className={cn(
          "relative mx-auto w-full max-w-3xl",
          className
        )}
        {...props}
      >
        {onBack && (
          <Button
            onClick={onBack}
            variant="ghost"
            size="icon"
            aria-label="Back"
            centerIcon={<Chevron02LeftIcon size={24} className="text-ods-text-primary" />}
            className={cn(
              cardClasses,
              "absolute -translate-y-1/2 right-full mr-3 my-6 hover:bg-ods-bg-hover"
            )}
          />
        )}
        <div className={cardClasses}>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              {userIcon ? (
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-ods-accent">
                  {userIcon}
                </div>
              ) : (
                <Avatar
                  src={userAvatar}
                  alt={userName}
                  fallback="F"
                  size="xl"
                  variant="round"
                  className="bg-ods-flamingo-pink"
                />
              )}
              <div className="flex flex-col">
                <span className="text-h3">{userName}</span>
                <div className="flex items-center gap-2">
                  {serverUrl && (
                    <>
                      <span className="text-h4 text-ods-text-secondary">{serverUrl}</span>
                      <ConnectionIndicator status={connectionStatus} />
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {showNewChat && onNewChat && (
                <Button
                  onClick={onNewChat}
                  variant="ghost"
                  size="sm"
                  leftIcon={<PlusCircleIcon className="w-5 h-5" whiteOverlay/>}
                  className="text-ods-text-primary hover:bg-ods-bg-hover"
                >
                  New Chat
                </Button>
              )}
              {onClose && (
                <Button
                  onClick={onClose}
                  variant="ghost"
                  size="sm"
                  aria-label="Close"
                  className="text-ods-text-muted hover:text-ods-text-primary hover:bg-ods-bg-hover !p-1.5"
                >
                  <XmarkIcon size={16} />
                </Button>
              )}
              {headerActions}
            </div>
          </div>
          {ticketInfo && (
            <>
              <div className="h-px bg-ods-border" />
              <div className="flex items-center justify-between gap-4 px-4 py-2">
                <div className="flex flex-col min-w-0">
                  <span className="text-heading-3 truncate">{ticketInfo.title}</span>
                  {ticketInfo.meta && (
                    <div className="text-h6 text-ods-text-secondary truncate">{ticketInfo.meta}</div>
                  )}
                </div>
                {ticketInfo.status && <TicketStatusTag status={ticketInfo.status} />}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }
)
ChatHeader.displayName = "ChatHeader"

const ChatContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex-1 flex flex-col min-h-0",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ChatContent.displayName = "ChatContent"

const ChatFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "w-full px-0 pb-0 pt-2 md:px-0 flex-shrink-0",
          className
        )}
        {...props}
      >
        <div className="mx-auto w-full max-w-3xl">
          {children}
        </div>
      </div>
    )
  }
)
ChatFooter.displayName = "ChatFooter"

export { ChatContainer, ChatHeader, ChatContent, ChatFooter }