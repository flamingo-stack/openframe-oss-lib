"use client"

import { cn } from "../../utils/cn"

interface ChatMessageSkeletonProps {
  className?: string
  showAvatar?: boolean
  isUser?: boolean
  assistantType?: 'mingo' | 'fae'
}

export function ChatMessageSkeleton({ 
  className, 
  showAvatar = true, 
  isUser = false, 
  assistantType = 'fae' 
}: ChatMessageSkeletonProps) {
  const isMingo = assistantType === 'mingo'

  return (
    <div
      className={cn(
        "flex flex-row items-start gap-4",
        !isUser && "bg-ods-card/50 rounded-lg px-4 -mx-4",
        className
      )}
    >
      {/* Avatar Skeleton - optional */}
      {showAvatar && (
        <div className={cn(
          "flex-shrink-0 mt-1 w-8 h-8 rounded animate-pulse",
          isUser 
            ? "invisible"
            : isMingo
            ? "bg-gradient-to-br from-cyan-400/30 to-cyan-600/30"
            : "bg-gradient-to-br from-pink-400/30 to-pink-600/30"
        )} />
      )}
      
      {/* Message Content Skeleton */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Name and Timestamp Row Skeleton */}
        <div className="flex items-center justify-between pr-2">
          <div className="h-5 w-16 bg-ods-border rounded animate-pulse" />
          <div className="h-4 w-12 bg-ods-border rounded animate-pulse" />
        </div>
        
        {/* Message Content Skeleton */}
        <div className="flex flex-col gap-2">
          <div className="space-y-2">
            {/* First line - full width */}
            <div className="h-4 w-full bg-ods-border rounded animate-pulse" />
            {/* Second line - 80% width */}
            <div className="h-4 w-4/5 bg-ods-border rounded animate-pulse" />
            {/* Third line - 60% width (optional for variation) */}
            <div className="h-4 w-3/5 bg-ods-border rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface ChatMessageListSkeletonProps {
  className?: string
  messageCount?: number
  showAvatars?: boolean
  assistantType?: 'mingo' | 'fae'
  contentClassName?: string
}

export function ChatMessageListSkeleton({
  className,
  messageCount = 6,
  showAvatars = true,
  assistantType = 'fae',
  contentClassName
}: ChatMessageListSkeletonProps) {
  const messages = Array.from({ length: messageCount }, (_, index) => ({
    id: index,
    isUser: index % 3 === 0,
    assistantType: assistantType
  }))

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden flex-1",
          "[scroll-behavior:smooth]",
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
          className
        )}
      >
        <div className={cn("mx-auto flex w-full max-w-3xl flex-col pb-2 min-w-0", contentClassName || "px-4")} style={{ minHeight: '100%' }}>
          <div className="flex-1" />
          <div className="space-y-6">
            {messages.map((message) => (
              <ChatMessageSkeleton
                key={message.id}
                showAvatar={showAvatars}
                isUser={message.isUser}
                assistantType={message.assistantType}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}