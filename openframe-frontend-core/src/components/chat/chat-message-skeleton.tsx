"use client"

import { cn } from "../../utils/cn"

interface ChatMessageSkeletonProps {
  className?: string
  showAvatar?: boolean
  isUser?: boolean
  /** How many body lines to draw under the name row. Default 3 (paragraph-ish
   *  reply). Pass 1 for surfaces whose real messages are single-line (e.g. the
   *  short scripted hero-demo turns), so the skeleton isn't ~3x too tall. */
  bodyLines?: number
}

// Body-line width palette: full-width lines then a short trailing line, so any
// `bodyLines` count ends on a short line like a real wrapped message.
const BODY_LINE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-5/6"]
const bodyLineWidth = (index: number, total: number) =>
  index === total - 1 ? "w-3/5" : BODY_LINE_WIDTHS[index % BODY_LINE_WIDTHS.length]

/**
 * One message-row skeleton. Mirrors `ChatMessageEnhanced`'s real layout:
 * full panel width, no card background, and an INLINE avatar in the name row
 * (the 2025 chat pattern — Claude.ai / ChatGPT / Gemini), NOT the legacy
 * `absolute -left-16` hanging avatar. Body lines use percentage widths so they
 * reflow cleanly as the panel resizes.
 */
export function ChatMessageSkeleton({
  className,
  showAvatar = true,
  isUser = false,
  bodyLines = 3,
}: ChatMessageSkeletonProps) {
  const lines = Math.max(1, bodyLines)
  return (
    <div className={cn("relative py-[var(--spacing-system-s)]", className)}>
      <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
        {/* Name row — inline avatar (assistant only) + name + timestamp,
            matching ChatMessageEnhanced's inline-avatar header. Neutral
            `bg-ods-border` so the placeholders are actually visible (a tinted
            low-alpha fill reads as blank on the dark surface). */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          {showAvatar && !isUser && (
            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-ods-border animate-pulse" />
          )}
          <div className="h-5 w-32 rounded bg-ods-border animate-pulse" />
          <div className="ml-auto h-4 w-14 rounded bg-ods-border animate-pulse" />
        </div>

        {/* Body lines — percentage widths so they reflow on panel resize. */}
        <div className="flex flex-col gap-2 pt-[var(--spacing-system-xxs)]">
          {Array.from({ length: lines }, (_, i) => (
            <div
              key={i}
              className={cn("h-4 rounded bg-ods-border animate-pulse", bodyLineWidth(i, lines))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface ChatMessageListSkeletonProps {
  className?: string
  messageCount?: number
  showAvatars?: boolean
  /**
   * Match `ChatMessageList`'s `fullWidth`: drop the centered
   * `max-w-ods-content-narrow` column so the skeleton fills the panel and
   * reflows on resize (instead of staying a fixed narrow column with large
   * side gutters). Same semantics as the real list.
   */
  fullWidth?: boolean
  /** Extra classes on the content column (e.g. host-provided padding). The
   *  host wrapper is expected to own the panel padding; this stays empty by
   *  default so the skeleton sits flush. */
  contentClassName?: string
  /** Body lines per message row (forwarded to `ChatMessageSkeleton`). Default 3;
   *  pass 1 for single-line message surfaces. */
  bodyLines?: number
}

export function ChatMessageListSkeleton({
  className,
  messageCount = 6,
  showAvatars = true,
  fullWidth = false,
  contentClassName,
  bodyLines,
}: ChatMessageListSkeletonProps) {
  const messages = Array.from({ length: messageCount }, (_, index) => ({
    id: index,
    isUser: index % 3 === 0,
  }))

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        className={cn(
          "flex h-full w-full flex-col overflow-y-auto overflow-x-hidden flex-1",
          "[scroll-behavior:smooth]",
          "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-ods-border/30 hover:scrollbar-thumb-ods-text-secondary/30",
          className,
        )}
      >
        <div
          className={cn(
            fullWidth
              ? "flex w-full flex-col min-w-0"
              : "mx-auto flex w-full max-w-ods-content-narrow flex-col min-w-0",
            contentClassName,
          )}
          style={{ minHeight: '100%' }}
        >
          {/* Bottom-anchor the rows like the real list. */}
          <div className="flex-1" />
          {messages.map((message) => (
            <ChatMessageSkeleton
              key={message.id}
              showAvatar={showAvatars}
              isUser={message.isUser}
              bodyLines={bodyLines}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
