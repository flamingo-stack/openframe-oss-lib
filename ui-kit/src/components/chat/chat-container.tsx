import * as React from "react"
import { cn } from "../../utils/cn"
import { SquareAvatar as Avatar } from "../ui/square-avatar"
import { Button } from "../ui/button"
import { PlusCircleIcon } from "../plus-circle-icon"

interface ConnectionIndicatorProps {
  status: 'connected' | 'disconnected' | 'connecting'
}

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
      <div 
        className={cn(
          "w-2 h-2 rounded-full",
          getStatusStyles()
        )}
        aria-label={`Connection status: ${status}`}
        title={status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : 'Disconnected'}
      />
    </div>
  )
}

export interface ChatContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode
}

const ChatContainer = React.forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex h-screen w-full flex-col",
          "bg-ods-bg text-ods-text-primary",
          "px-4 sm:px-6 lg:px-8 pt-10 pb-8",
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

interface ChatHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  userName?: string
  userTitle?: string
  userAvatar?: string
  onSettingsClick?: () => void
  onNewChat?: () => void
  showNewChat?: boolean
  connectionStatus?: 'connected' | 'disconnected' | 'connecting'
  serverUrl?: string | null
}

const ChatHeader = React.forwardRef<HTMLDivElement, ChatHeaderProps>(
  ({ className, userName = 'Grace "Fae" Meadows', userTitle = "Your Personal Assistant", userAvatar, onSettingsClick, onNewChat, showNewChat = false, connectionStatus = 'disconnected', serverUrl = null, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative mx-auto w-full max-w-3xl",
          "flex items-center justify-between gap-4 px-6 py-5",
          "rounded-2xl bg-ods-card shadow-[0_18px_48px_rgba(0,0,0,0.45)]",
          "ring-1 ring-black/20",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-3">
          <Avatar
            src={userAvatar}
            alt={userName}
            fallback="F"
            size="md"
            variant="round"
            className="bg-gradient-to-br from-pink-400 to-pink-600"
          />
          <div className="flex flex-col">
            <span className="text-base font-semibold text-ods-text-primary">{userName}</span>
            <div className="flex items-center gap-2">
              {serverUrl && (
                <>
                  <span className="text-sm text-ods-text-secondary">{serverUrl}</span>
                  <ConnectionIndicator status={connectionStatus} />
                </>
              )}
            </div>
          </div>
        </div>
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
          "w-full px-0 pb-0 pt-6 sm:px-0 flex-shrink-0",
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