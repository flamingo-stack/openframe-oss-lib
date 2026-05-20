"use client"

import React, { forwardRef, memo, useMemo } from "react"
import { cn } from "../../utils/cn"
import { SquareAvatar } from "../ui/square-avatar"
import { ToolExecutionDisplay } from "./tool-execution-display"
import { ApprovalRequestMessage } from "./approval-request-message"
import { ApprovalBatchMessage } from "./approval-batch-message"
import { ErrorMessageDisplay } from "./error-message-display"
import { ContextCompactionDisplay } from "./context-compaction-display"
import { ThinkingDisplay } from "./thinking-display"
import { SimpleMarkdownRenderer } from "../ui/simple-markdown-renderer"
import type { ChatRef } from "./chat-ref.types"
import { remarkCardLinks } from "./remark-card-links"
import { BlockCard, type BlockCardProps } from "./block-card"
import type { MessageSegment, MessageContent, ChatMessageEnhancedProps } from "./types"

/**
 * Same regex shape as `remarkCardLinks` — kept in lockstep so the
 * pre-scan and the remark plugin see the SAME set of markers. If the
 * grammar widens (today: snake_case OR kebab-case; closer `]` OR `)`),
 * both files must update.
 */
const CARD_MARKER_REGEX = /\[card:\/\/([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)[\])]/g

function normalizeContent(content: MessageContent): MessageSegment[] {
  if (typeof content === 'string') {
    return content ? [{ type: 'text', text: content }] : []
  }
  return content
}

const ChatMessageEnhanced = forwardRef<HTMLDivElement, ChatMessageEnhancedProps>(
  ({ className, role, content, name, avatar, isTyping = false, timestamp, showAvatar = true, assistantType, authorType: authorTypeProp, assistantIcon, chatRefs, renderEntityCard, NavLinkAnchor, ...props }, ref) => {
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

    const segments = useMemo(() => normalizeContent(content), [content])

    /**
     * Per-message rendering plan for `[card://type:id]` markers.
     *
     * Block-bearing markers SPLIT their containing text segment so the
     * block payload (e.g. video player) renders AT THE MARKER POSITION
     * in the text flow — not at the end of the segment, which causes
     * the block to "appear high and drift down" while text streams in.
     *
     * Per-segment output is an array of parts:
     *   - `{ kind: 'text' }` — substring of the segment text, rendered
     *                         through `<SimpleMarkdownRenderer>`. Ends
     *                         with the block marker so the inline pill
     *                         lands at the right spot via the `<a>`
     *                         override.
     *   - `{ kind: 'block' }` — block payload, rendered as a sibling
     *                         BELOW the preceding text chunk and above
     *                         the next one.
     *
     * Inline-only markers (no `<BlockCard>` wrapper) do NOT split the
     * segment; they're handled by the override at marker position via
     * the shared `inlineByKey` map.
     *
     * Streaming behaviour: as a marker becomes complete in the streamed
     * text, the regex matches, the segment splits at that point, and
     * the block card lands right after the inline pill. Subsequent
     * tokens render in the trailing chunk — block stays in position.
     */
    const renderingPlan = useMemo(() => {
      if (!hasMarkerSupport) return null
      const refs = chatRefs ?? {}
      const render = renderEntityCard
      const inlineByKey = new Map<string, React.ReactNode>()
      type SegmentPart =
        | { kind: 'text'; text: string }
        | { kind: 'block'; key: string; node: React.ReactNode }
      const partsBySegment = new Map<number, SegmentPart[]>()
      if (!render) return { inlineByKey, partsBySegment }
      const seenRendered = new Map<string, React.ReactNode>()
      segments.forEach((segment, segIdx) => {
        if (segment.type !== 'text') return
        const text = segment.text
        const parts: SegmentPart[] = []
        let cursor = 0
        CARD_MARKER_REGEX.lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = CARD_MARKER_REGEX.exec(text)) !== null) {
          const cardType = match[1]
          const cardId = match[2]
          const key = `${cardType}:${cardId}`
          // Dedup renderEntityCard calls per unique key across the
          // whole message — same key emitted twice (rare but possible)
          // returns the cached node so React reuses the same instance.
          let rendered = seenRendered.get(key)
          if (!seenRendered.has(key)) {
            const refMatch = refs[key]
            rendered = refMatch ? render(refMatch) : undefined
            seenRendered.set(key, rendered)
          }
          if (React.isValidElement(rendered) && rendered.type === BlockCard) {
            const props = rendered.props as BlockCardProps
            const markerEnd = match.index + match[0].length
            // Text chunk INCLUDING the marker — the inline pill renders
            // at the marker position via the `<a>` override.
            parts.push({ kind: 'text', text: text.slice(cursor, markerEnd) })
            parts.push({ kind: 'block', key, node: props.children })
            cursor = markerEnd
            const refMatch = refs[key]
            inlineByKey.set(
              key,
              props.inline != null
                ? props.inline
                : <span className="text-ods-text-primary font-medium">{refMatch?.title ?? cardId}</span>,
            )
          } else if (rendered != null) {
            // Inline-only — no split; remembered for the override.
            inlineByKey.set(key, rendered)
          }
        }
        // Trailing text after the last block marker (or the entire
        // segment when no block markers fired).
        if (cursor < text.length) {
          parts.push({ kind: 'text', text: text.slice(cursor) })
        }
        // Only register the split plan when at least one block marker
        // fired — otherwise the segment renders as one SimpleMarkdown-
        // Renderer call (existing behaviour preserved for the
        // overwhelming majority of segments that have no block cards).
        if (parts.some((p) => p.kind === 'block')) {
          partsBySegment.set(segIdx, parts)
        }
      })
      return { inlineByKey, partsBySegment }
    }, [hasMarkerSupport, chatRefs, renderEntityCard, segments])

    const cardComponentOverrides = useMemo(() => {
      if (!hasMarkerSupport) return undefined
      const refs = chatRefs ?? {}
      const inlineByKey = renderingPlan?.inlineByKey
      return {
        // Override `<a>` to detect `card://` URLs emitted by `remarkCardLinks`.
        // The render result was pre-computed in `renderingPlan` so block-level
        // payloads (e.g. video player cards) can be hoisted out of the
        // paragraph as siblings — the inline pill stays at the marker
        // position. Other href schemes pass through unchanged.
        a: ({ href, children, className: linkClassName, ...rest }: any) => {
          if (typeof href === 'string' && href.startsWith('card://')) {
            const stripped = href.slice('card://'.length)
            const sepIdx = stripped.lastIndexOf(':')
            if (sepIdx !== -1) {
              const cardType = stripped.slice(0, sepIdx)
              const cardId = stripped.slice(sepIdx + 1)
              const key = `${cardType}:${cardId}`
              const inline = inlineByKey?.get(key)
              if (inline != null) return inline
              // No renderer, no ref, OR renderer returned null — fall back
              // to plain text title-only. Use any same-type ref's title if
              // available; otherwise the bare cardId. Never render the
              // literal `card://` URL.
              const refMatch: ChatRef | undefined = refs[key]
              const fallbackTitle = (refMatch?.title)
                ?? Object.values(refs).find((r) => r.type === cardType)?.title
                ?? cardId
              return <span className="text-ods-text-primary">{fallbackTitle}</span>
            }
          }
          // Unified click rule — delegated to the host's `NavLinkAnchor`
          // component. The host wraps its own `useNavLink` hook so EVERY
          // clickable surface (source chips, inline cards, search rows,
          // action cards, chat-markdown links) shares the same routing
          // decision: modifier-clicks pass through, cross-origin → new
          // tab, in-page doc-tree path → soft swap, same-origin → soft
          // RSC nav. Single mental model across the app, single source
          // of truth in the hub.
          //
          // Anchor-only links (`#section`) bypass NavLinkAnchor — the
          // host's router would treat them as navigation, but the user
          // wants the browser's native scroll-to-anchor behavior.
          //
          // When the host has NOT supplied `NavLinkAnchor` (e.g. the
          // flamingo hero-demo with mock content), fall back to a plain
          // `<a href>`. No cross-origin sniffing here — the OSS-lib does
          // not own routing decisions; the host does.
          if (
            typeof href === 'string' &&
            NavLinkAnchor &&
            !href.startsWith('#')
          ) {
            return (
              <NavLinkAnchor href={href} className={linkClassName} {...rest}>
                {children}
              </NavLinkAnchor>
            )
          }
          return (
            <a href={href} className={linkClassName} {...rest}>
              {children}
            </a>
          )
        },
      }
    }, [hasMarkerSupport, chatRefs, renderingPlan, NavLinkAnchor])

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
          isMingo ? "bg-ods-flamingo-cyan" : "bg-ods-flamingo-pink"
        )
      }
    }
    
    const avatarProps = getAvatarProps()

    const isSystem = authorType === 'system'

    return (
      <div
        ref={ref}
        className={cn(
          "relative py-[var(--spacing-system-s)]",
          className
        )}
        {...props}
      >
        {/* Hanging-avatar layout — Figma spec parks the avatar in the 64px
            gutter outside the 600px content column. Only rendered for
            assistant messages; user and system messages have no avatar. */}
        {showAvatar && !isSystem && !isUser && (
          <div className="absolute -left-16 top-[var(--spacing-system-s)]">
            {assistantIcon && !avatar ? (
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-ods-accent">
                {assistantIcon}
              </div>
            ) : (
              <SquareAvatar
                {...avatarProps}
                className={cn(avatarProps.className, "w-12 h-12")}
              />
            )}
          </div>
        )}

        {/* Message Content - full width */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)] min-w-0">
          {/* Name and Timestamp Row */}
          <div className="flex items-center justify-between gap-[var(--spacing-system-xxs)]">
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
            {segments.map((segment, index) => {
                if (segment.type === 'text') {
                  const parts = renderingPlan?.partsBySegment.get(index)
                  const wrapperClass = cn(
                    "min-w-0 w-full break-words text-h4",
                    isError ? "text-ods-error" : "text-ods-text-primary",
                  )
                  // No block markers in this segment → single
                  // SimpleMarkdownRenderer call (existing behaviour
                  // preserved for the vast majority of messages).
                  if (!parts || parts.length === 0) {
                    return (
                      <div key={index} className={wrapperClass}>
                        <SimpleMarkdownRenderer
                          content={segment.text}
                          textSize="compact"
                          additionalRemarkPlugins={cardRemarkPlugins}
                          componentOverrides={cardComponentOverrides}
                        />
                      </div>
                    )
                  }
                  // Block markers present → split text at each marker
                  // and interleave block payloads. Each text chunk
                  // includes its trailing marker so the inline pill
                  // renders at the right position via the `<a>`
                  // override. Block payloads land AS SIBLINGS between
                  // text chunks — HTML-valid (block DOM never nests
                  // inside `<p>`) AND positionally correct (block
                  // appears where the marker is in the flow, not at
                  // the segment's end). Stable React keys come from
                  // the card key (block) and chunk position (text);
                  // streaming token-by-token reuses the same React
                  // instances so `<Video>` doesn't remount mid-play.
                  return (
                    <div key={index} className={wrapperClass}>
                      {parts.map((part, pIdx) => {
                        if (part.kind === 'text') {
                          return (
                            <SimpleMarkdownRenderer
                              key={`t-${pIdx}`}
                              content={part.text}
                              textSize="compact"
                              additionalRemarkPlugins={cardRemarkPlugins}
                              componentOverrides={cardComponentOverrides}
                            />
                          )
                        }
                        return (
                          <div key={`b-${part.key}`} className="my-3">
                            {part.node}
                          </div>
                        )
                      })}
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
                } else if (segment.type === 'approval_batch') {
                  return (
                    <ApprovalBatchMessage
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
              })}
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
    prevProps.renderEntityCard === nextProps.renderEntityCard &&
    prevProps.NavLinkAnchor === nextProps.NavLinkAnchor
  )
})

MemoizedChatMessageEnhanced.displayName = "MemoizedChatMessageEnhanced"

export { MemoizedChatMessageEnhanced as ChatMessageEnhanced }