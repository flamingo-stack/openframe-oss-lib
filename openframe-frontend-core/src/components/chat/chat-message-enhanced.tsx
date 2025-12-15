"use client"

import { useState, forwardRef, HTMLAttributes } from "react"
import { cn } from "../../utils/cn"
import { SquareAvatar } from "../ui/square-avatar"
import { ChatTypingIndicator } from "./chat-typing-indicator"
import { ToolExecutionDisplay, type ToolExecutionMessage } from "./tool-execution-display"
import { SimpleMarkdownRenderer } from "../ui/simple-markdown-renderer"

export type MessageSegment =
  | { type: 'text'; text: string }
  | { type: 'tool_execution'; data: ToolExecutionMessage }

export type MessageContent = string | MessageSegment[]

export interface ChatMessageEnhancedProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content'> {
  role: 'user' | 'assistant' | 'error'
  content: MessageContent
  name?: string
  avatar?: string | null
  isTyping?: boolean
  timestamp?: Date
  showAvatar?: boolean
}

function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : []
  }
  return content
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  ({ className, role, content, name, avatar, isTyping = false, timestamp, showAvatar = true, ...props }, ref) => {
    const isUser = role === 'user'
    const isError = role === 'error'

    const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set())
    
    const getAvatarProps = () => {
      const displayName = name || (isUser ? "User" : "Fae")
      const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase()
      
      return {
        src: avatar || undefined,
        alt: `${displayName} avatar`,
        fallback: initials,
        size: "sm" as const,
        variant: "round" as const,
        className: cn(
          "flex-shrink-0 mt-1",
          isUser 
            ? "invisible"
            : "bg-gradient-to-br from-pink-400 to-pink-600"
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

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-row items-start gap-4 py-3",
          !isUser && "bg-ods-card/50 rounded-lg px-4 -mx-4",
          className
        )}
        {...props}
      >
        {/* Avatar - optional */}
        {showAvatar && (
          <SquareAvatar
            {...avatarProps}
            className={cn(avatarProps.className, "mt-0.5 drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]")}
          />
        )}
        
        {/* Message Content */}
        <div className="flex flex-1 flex-col gap-1 min-w-0">
          {/* Name and Timestamp Row */}
          <div className="flex items-center justify-between pr-2">
            <span className={cn(
              "text-sm font-semibold text-[18px]",
              isUser ? "text-ods-text-secondary" : "text-[var(--ods-flamingo-pink-base)]"
            )}>
              {name || (isUser ? "User" : "Fae")}:
            </span>
            {timestamp && (
              <span className="text-xs text-ods-text-muted text-[18px]">
                {timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </span>
            )}
          </div>
          
          {/* Message segments */}
          <div className="flex flex-col gap-3">
            {isTyping && segments.length === 0 ? (
              <ChatTypingIndicator />
            ) : (
              segments.map((segment, index) => {
                if (segment.type === 'text') {
                  return (
                    <div key={index} className={cn(
                      "min-w-0 w-full overflow-hidden",
                      isError
                        ? "text-ods-error"
                        : isUser
                          ? "text-ods-text-primary"
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
                }
                return null
              })
            )}
          </div>
        </div>
      </div>
    )
  }
)

ChatMessageEnhanced.displayName = "ChatMessageEnhanced"

export { ChatMessageEnhanced }