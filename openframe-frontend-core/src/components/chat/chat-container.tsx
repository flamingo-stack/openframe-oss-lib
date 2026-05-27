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
      // ODS attention tokens — same scheme used by the rest of the chat
      // shell (StatusBadge, error toast, etc.). Hex Tailwind palette
      // (`bg-green-500` / `bg-red-500`) would diverge from the theme and
      // is forbidden by the host's design-token policy.
      case 'connected':
        return 'bg-ods-attention-green-success'
      case 'connecting':
        return 'bg-ods-attention-yellow-warning animate-pulse'
      case 'disconnected':
        return 'bg-ods-attention-red-error'
      default:
        return 'bg-ods-text-tertiary'
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
  ({ className, userName = 'Grace "Fae" Meadows', userTitle = "Your Personal Assistant", userAvatar, userIcon, onSettingsClick, onNewChat, onClose, onBack, showNewChat = false, connectionStatus = 'disconnected', serverUrl = null, headerActions, ticketInfo, fullWidth = false, bare = false, ...props }, ref) => {
    const cardClasses = bare
      ? ""
      : "rounded-md bg-ods-card shadow-[0_18px_48px_rgba(0,0,0,0.45)] border border-ods-border ring-1 ring-black/20"
    return (
      <div
        ref={ref}
        className={cn(
          // `fullWidth` drops the centered-narrow content column for
          // chats hosted in side panels where 600px would float in
          // the middle of a wider container.
          fullWidth ? "relative w-full" : "relative mx-auto w-full max-w-ods-content-narrow",
          className
        )}
        {...props}
      >
        {onBack && (
          <Button
            onClick={onBack}
            variant="transparent"
            size="icon"
            aria-label="Back"
            leftIcon={<Chevron02LeftIcon size={24} className="text-ods-text-primary" />}
            className={cn(
              cardClasses,
              "absolute top-0 right-full mr-[var(--spacing-system-s)] hover:bg-ods-bg-hover"
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
                  variant="transparent"
                  size="small-legacy"
                  leftIcon={<PlusCircleIcon className="w-5 h-5" whiteOverlay/>}
                  className="text-ods-text-primary hover:bg-ods-bg-hover"
                >
                  New Chat
                </Button>
              )}
              {onClose && (
                <Button
                  onClick={onClose}
                  variant="transparent"
                  size="small-legacy"
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
                  <span className="text-heading-3 truncate" title={typeof ticketInfo.title === 'string' ? ticketInfo.title : undefined}>{ticketInfo.title}</span>
                  {ticketInfo.meta && (
                    <div className="text-h6 text-ods-text-secondary truncate" title={typeof ticketInfo.meta === 'string' ? ticketInfo.meta : undefined}>{ticketInfo.meta}</div>
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

/**
 * `ChatFooter` props.
 *
 * Layout API:
 *   - `fullWidth` (preferred) — drop the inner-wrapper
 *     `max-w-ods-content-narrow` so the footer fills the parent.
 *   - `contentClassName` (legacy escape hatch) — explicit class names
 *     applied to the inner wrapper. Use only when `fullWidth` is too
 *     coarse (e.g. custom max-w value).
 */
export interface ChatFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Same `fullWidth` semantics as `ChatHeaderProps.fullWidth` — drops
   *  the inner wrapper's `max-w-ods-content-narrow` so the footer
   *  spans the full parent width. */
  fullWidth?: boolean
  /** @deprecated Prefer `fullWidth` for the full-panel-width use case.
   *  This prop remains supported for callers that need a NON-binary
   *  override (custom max-w value, custom padding, etc.). */
  contentClassName?: string
}

const ChatFooter = React.forwardRef<HTMLDivElement, ChatFooterProps>(
  ({ className, contentClassName, fullWidth = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "w-full px-0 pb-0 pt-2 md:px-0 flex-shrink-0",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            // `fullWidth=true` opts out of the centered-narrow column;
            // `fullWidth=false` (default) preserves the legacy 600px
            // max-width. `contentClassName` is appended last so a
            // legacy caller passing it can still tweak after the
            // fullWidth decision.
            fullWidth ? "w-full" : "mx-auto w-full max-w-ods-content-narrow",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    )
  }
)
ChatFooter.displayName = "ChatFooter"

export { ChatContainer, ChatHeader, ChatContent, ChatFooter }