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
import type { ChatRef } from "./chat-ref.types"
import { remarkCardLinks } from "./remark-card-links"
import type { MessageSegment, MessageContent, ChatMessageEnhancedProps } from "./types"

function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : []
  }
  return content
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  ({ className, role, content, name, avatar, isTyping = false, timestamp, showAvatar = true, assistantType, authorType: authorTypeProp, assistantIcon, chatRefs, renderEntityCard, ...props }, ref) => {
    const isUser = role === 'user'
    const isError = role === 'error'
    const authorType = authorTypeProp ?? (isUser ? 'user' : assistantType === 'mingo' ? 'mingo' : 'fae')

    // Inline-card rendering uses a HOST-PROVIDED `renderEntityCard` function
    // (v6.1 §B.2.7 — DRY duplications #2). The OSS-lib stays data-agnostic:
    // it doesn't know about entity types, slash commands, or app routing.
    // The host (multi-platform-hub) returns whatever JSX it wants for each
    // resolved ChatRef — typically a hover-card pill that composes the
    // canonical entity card from the host's design system.
    //
    // The remark plugin runs whenever the assistant emits a `[card://]`
    // marker (chatRefs present OR not), so we always strip raw markers
    // from rendered text (Logic MED-4). When the host's `renderEntityCard`
    // is unset OR returns null, the override falls back to the ref's
    // title — or, if even the ref is unknown, the bare cardId. Never
    // renders the literal `[card://...]` URL.
    const hasMarkerSupport = !!chatRefs || !!renderEntityCard
    const cardRemarkPlugins = useMemo(
      () => (hasMarkerSupport ? [remarkCardLinks] : []),
      [hasMarkerSupport],
    )
    const cardComponentOverrides = useMemo(() => {
      if (!hasMarkerSupport) return undefined
      const refs = chatRefs ?? {}
      const render = renderEntityCard
      return {
        // Override `<a>` to detect `card://` URLs emitted by `remarkCardLinks`
        // and delegate rendering to the host. Other href schemes pass
        // through unchanged — react-markdown's default `<a>` handler covers
        // them.
        a: ({ href, children, className: linkClassName, ...rest }: any) => {
          if (typeof href === 'string' && href.startsWith('card://')) {
            const stripped = href.slice('card://'.length)
            const sepIdx = stripped.lastIndexOf(':')
            if (sepIdx !== -1) {
              const cardType = stripped.slice(0, sepIdx)
              const cardId = stripped.slice(sepIdx + 1)
              const key = `${cardType}:${cardId}`
              const refMatch: ChatRef | undefined = refs[key]
              if (refMatch && render) {
                const rendered = render(refMatch)
                if (rendered != null) return rendered
              }
              // No renderer, no ref, OR renderer returned null — fall back
              // to plain text title-only. Use any same-type ref's title if
              // available; otherwise the bare cardId. Never render the
              // literal `card://` URL.
              const fallbackTitle = (refMatch?.title)
                ?? Object.values(refs).find((r) => r.type === cardType)?.title
                ?? cardId
              return <span className="text-ods-text-primary">{fallbackTitle}</span>
            }
          }
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
    }, [hasMarkerSupport, chatRefs, renderEntityCard])

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
    prevProps.renderEntityCard === nextProps.renderEntityCard
  )
})

MemoizedChatMessageEnhanced.displayName = "MemoizedChatMessageEnhanced"

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced }