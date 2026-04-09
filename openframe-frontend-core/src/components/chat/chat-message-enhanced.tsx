"use client"

import { useState, forwardRef, memo } from "react"
import { cn } from "../../utils/cn"
import { SquareAvatar } from "../ui/square-avatar"
import { ChatTypingIndicator } from "./chat-typing-indicator"
import { ToolExecutionDisplay } from "./tool-execution-display"
import { ApprovalRequestMessage } from "./approval-request-message"
import { ErrorMessageDisplay } from "./error-message-display"
import { SimpleMarkdownRenderer } from "../ui/simple-markdown-renderer"
import type { MessageSegment, MessageContent, ChatMessageEnhancedProps } from "./types"

function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : []
  }
  return content
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  ({ className, role, content, name, avatar, isTyping = false, timestamp, showAvatar = true, assistantType, authorType: authorTypeProp, assistantIcon, ...props }, ref) => {
    const isUser = role === 'user'
    const isError = role === 'error'
    const authorType = authorTypeProp ?? (isUser ? 'user' : assistantType === 'mingo' ? 'mingo' : 'fae')

    const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
    
    const getAvatarProps = () => {
      const displayName = name || (isUser ? "User" : assistantType === 'mingo' ? "Mingo" : "Fae")
      const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase()
      const isMingo = assistantType === 'mingo'
      
      return {
        src: avatar || undefined,
        alt: `${displayName} avatar`,
        fallback: initials,
        size: "sm" as const,
        variant: "round" as const,
        className: cn(
          "flex-shrink-0",
          isUser
            ? "invisible"
            : isMingo
            ? "bg-ods-flamingo-cyan"
            : "bg-ods-flamingo-pink"
        )
      }
    }
    
    const avatarProps = getAvatarProps()
    const segments = normalizeContent(content)
    
    const getToolKey = (segment: MessageSegment & { type: 'tool_execution' }, index: number) => {
      return `${segment.data.integratedToolType}-${segment.data.toolFunction}-${index}`
    }
    
    const toggleToolExpanded = (key: string) => {
      setExpandedTools(prev => {
        const newSet = new Set(prev)
        if (newSet.has(key)) {
          newSet.delete(key)
        } else {
          newSet.add(key)
        }
        return newSet
      })
    }

    const isSystem = authorType === 'system'

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-row items-start gap-2 py-3",
          className
        )}
        {...props}
      >
        {/* Avatar - optional, invisible spacer for system messages */}
        {showAvatar && (isSystem ? (
          <div className="w-12 flex-shrink-0" />
        ) : !isUser && assistantIcon && !avatar ? (
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-ods-accent flex-shrink-0">
              {assistantIcon}
            </div>
          ) : (
            <SquareAvatar
              {...avatarProps}
              className={cn(avatarProps.className, "w-12 h-12")}
            />
          )
        )}

        {/* Message Content */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          {/* Name and Timestamp Row */}
          <div className="flex items-center justify-between gap-1">
            <span className={cn(
              "font-mono text-h3 font-medium flex-1",
              authorType === 'system' ? "text-ods-open-yellow" :
              authorType === 'admin' ? "text-ods-open-yellow" :
              authorType === 'mingo' ? "text-ods-flamingo-cyan" :
              authorType === 'fae' ? "text-ods-flamingo-pink" :
              "text-ods-text-secondary"
            )}>
              {name || (isUser ? "User" : assistantType === 'mingo' ? "Mingo" : "Fae")}{!isSystem && ':'}
            </span>
            {timestamp && (
              <span className="font-sans text-heading-5 font-medium text-ods-text-secondary shrink-0 whitespace-nowrap">
                {timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          
          {/* Message segments — hidden for system messages */}
          {!isSystem && <div className="flex flex-col">
            {isTyping && segments.length === 0 ? (
              <ChatTypingIndicator />
            ) : (
              segments.map((segment, index) => {
                if (segment.type === 'text') {
                  return (
                    <div key={index} className={cn(
                      "min-w-0 w-full overflow-hidden text-h4",
                      isError
                        ? "text-ods-error"
                        : "text-ods-text-primary"
                    )}>
                      <SimpleMarkdownRenderer content={segment.text} />
                    </div>
                  )
                } else if (segment.type === 'tool_execution') {
                  const toolKey = getToolKey(segment, index)
                  return (
                    <ToolExecutionDisplay
                      key={toolKey}
                      message={segment.data}
                      isExpanded={expandedTools.has(toolKey)}
                      onToggleExpand={() => toggleToolExpanded(toolKey)}
                    />
                  )
                } else if (segment.type === 'approval_request') {
                  return (
                    <ApprovalRequestMessage
                      key={index}
                      data={segment.data}
                      status={segment.status}
                      onApprove={segment.onApprove}
                      onReject={segment.onReject}
                    />
                  )
                } else if (segment.type === 'error') {
                  return (
                    <ErrorMessageDisplay
                      key={index}
                      title={segment.title}
                      details={segment.details}
                    />
                  )
                }
                return null
              })
            )}
          </div>}
        </div>
      </div>
    )
  }
)

ChatMessageEnhanced.displayName = "ChatMessageEnhanced"

const MemoizedChatMessageEnhanced = memo(ChatMessageEnhanced, (prevProps, nextProps) => {
  return (
    prevProps.role === nextProps.role &&
    prevProps.content === nextProps.content &&
    prevProps.name === nextProps.name &&
    prevProps.avatar === nextProps.avatar &&
    prevProps.isTyping === nextProps.isTyping &&
    prevProps.timestamp?.getTime() === nextProps.timestamp?.getTime() &&
    prevProps.showAvatar === nextProps.showAvatar &&
    prevProps.assistantType === nextProps.assistantType &&
    prevProps.authorType === nextProps.authorType &&
    prevProps.assistantIcon === nextProps.assistantIcon &&
    prevProps.className === nextProps.className
  )
})

MemoizedChatMessageEnhanced.displayName = "MemoizedChatMessageEnhanced"

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced }