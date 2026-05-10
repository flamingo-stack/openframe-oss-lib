"use client"

import { forwardRef, memo, useMemo } from "react"
import { cn } from "../../utils/cn"
import { SquareAvatar } from "../ui/square-avatar"
import { ChatTypingIndicator } from "./chat-typing-indicator"
import { ToolExecutionDisplay } from "./tool-execution-display"
import { ApprovalRequestMessage } from "./approval-request-message"
import { ErrorMessageDisplay } from "./error-message-display"
import { ContextCompactionDisplay } from "./context-compaction-display"
import { ThinkingDisplay } from "./thinking-display"
import { SimpleMarkdownRenderer } from "../ui/simple-markdown-renderer"
import { ObjectCard, type ChatRef } from "./object-card"
import { remarkCardLinks } from "./remark-card-links"
import type { MessageSegment, MessageContent, ChatMessageEnhancedProps } from "./types"

function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : []
  }
  return content
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  ({ className, role, content, name, avatar, isTyping = false, timestamp, showAvatar = true, assistantType, authorType: authorTypeProp, assistantIcon, chatRefs, canDiscussType, onCardDiscuss, ...props }, ref) => {
    const isUser = role === 'user'
    const isError = role === 'error'
    const authorType = authorTypeProp ?? (isUser ? 'user' : assistantType === 'mingo' ? 'mingo' : 'fae')

    // Compose the additional remark plugin set + the `<a>` component override
    // that swaps `card://type:id` URLs for <ObjectCard /> instances. Empty
    // chatRefs short-circuits the override so the renderer behaves
    // identically to the legacy markdown path.
    const hasRefs = !!chatRefs && Object.keys(chatRefs).length > 0
    const cardRemarkPlugins = useMemo(
      () => (hasRefs ? [remarkCardLinks] : []),
      [hasRefs],
    )
    const cardComponentOverrides = useMemo(() => {
      if (!hasRefs) return undefined
      const refs = chatRefs!
      return {
        // Override `<a>` to detect `card://` URLs and render an ObjectCard.
        // The `node` arg's url is what `remarkCardLinks` produced.
        a: ({ href, children, className: linkClassName, ...rest }: any) => {
          if (typeof href === 'string' && href.startsWith('card://')) {
            // Parse `card://<type>:<id>`. Tolerate snake_case or kebab-case
            // (the regex shape matches `[a-zA-Z0-9_-]+` per remark plugin).
            const stripped = href.slice('card://'.length)
            const sepIdx = stripped.lastIndexOf(':')
            if (sepIdx !== -1) {
              const cardType = stripped.slice(0, sepIdx)
              const cardId = stripped.slice(sepIdx + 1)
              const key = `${cardType}:${cardId}`
              const ref: ChatRef | undefined = refs[key]
              if (ref) {
                return (
                  <ObjectCard
                    reference={ref}
                    canDiscuss={canDiscussType ? canDiscussType(ref.type) : undefined}
                    onDiscuss={onCardDiscuss}
                  />
                )
              }
              // Unknown ref — fall back to the chip-metadata title if any
              // entry of this type exists. Otherwise render the literal
              // marker text. Per v6.1 defensive note: never render the raw
              // `[card://...]` URL itself; show plain prose.
              const fallbackRef = Object.values(refs).find((r) => r.type === cardType)
              const fallbackTitle = fallbackRef?.title ?? cardId
              return <span className="text-ods-text-primary">{fallbackTitle}</span>
            }
          }
          // Default link rendering — passes through to the regular `<a>` path.
          // The OSS-lib renderer's default `<a>` handler covers internal-link
          // resolution + broken-link decoration; we don't replicate it here.
          // Returning a basic anchor is sufficient because card-marker links
          // are NEVER in-app routes and the chat UX doesn't need broken-link
          // detection on assistant-emitted text.
          return (
            <a
              href={href}
              className={linkClassName}
              target={typeof href === 'string' && href.startsWith('http') ? '_blank' : undefined}
              rel={typeof href === 'string' && href.startsWith('http') ? 'noopener noreferrer' : undefined}
              {...rest}
            >
              {children}
            </a>
          )
        },
      }
    }, [hasRefs, chatRefs, canDiscussType, onCardDiscuss])

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
              "text-h3 !font-mono !font-medium flex-1",
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
          
          {/* Message segments — hidden for system messages without content */}
          {(!isSystem || segments.length > 0) && <div className="flex flex-col gap-2">
            {isTyping && segments.length === 0 ? (
              <ChatTypingIndicator />
            ) : (
              segments.map((segment, index) => {
                if (segment.type === 'text') {
                  return (
                    <div key={index} className={cn(
                      "min-w-0 w-full break-words text-h4",
                      isError
                        ? "text-ods-error"
                        : "text-ods-text-primary"
                    )}>
                      <SimpleMarkdownRenderer
                        content={segment.text}
                        textSize="compact"
                        additionalRemarkPlugins={cardRemarkPlugins}
                        componentOverrides={cardComponentOverrides}
                      />
                    </div>
                  )
                } else if (segment.type === 'tool_execution') {
                  return (
                    <ToolExecutionDisplay
                      key={index}
                      message={segment.data}
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
                } else if (segment.type === 'context_compaction') {
                  return (
                    <ContextCompactionDisplay
                      key={index}
                      status={segment.status}
                    />
                  )
                } else if (segment.type === 'thinking') {
                  const isStreaming = index === segments.length - 1 && isTyping
                  return (
                    <ThinkingDisplay
                      key={index}
                      text={segment.text}
                      isStreaming={isStreaming}
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
    prevProps.className === nextProps.className &&
    // Reference equality on chatRefs is sufficient — the host's hooks should
    // re-use the same Record instance per turn; mutations create a new map.
    // Without this check, a parent re-render with a new (but equivalent)
    // refs object would force a full markdown re-render every keystroke.
    prevProps.chatRefs === nextProps.chatRefs &&
    prevProps.canDiscussType === nextProps.canDiscussType &&
    prevProps.onCardDiscuss === nextProps.onCardDiscuss
  )
})

MemoizedChatMessageEnhanced.displayName = "MemoizedChatMessageEnhanced"

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced }