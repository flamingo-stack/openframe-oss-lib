"use client"

import type { ReactNode } from "react"

import { cn } from "../../utils/cn"
import { MingoIcon } from "../icons/mingo-icon"

interface ChatMessageListLoaderProps {
  className?: string
  /**
   * Brand mark rendered at the centre of the loader. When omitted, a neutral
   * MingoIcon is used (color derived from `assistantType`). Pass a custom
   * element to match a different brand.
   */
  assistantIcon?: ReactNode
  assistantType?: 'mingo' | 'fae'
  /** Defaults to `"Loading conversation..."`. */
  label?: string
}

/**
 * Centered loading indicator for the chat message list. Replaces the
 * multi-row skeleton with a single, brand-neutral pulsating mark — the same
 * pattern Claude/ChatGPT use when fetching a conversation: don't fake the
 * shape of the content, just signal "we're working on it" and let the real
 * messages fade in once they arrive.
 */
export function ChatMessageListLoader({
  className,
  assistantIcon,
  assistantType = 'fae',
  label = 'Loading conversation...',
}: ChatMessageListLoaderProps) {
  const accentColor =
    assistantType === 'mingo'
      ? 'var(--ods-flamingo-cyan-base)'
      : 'var(--ods-flamingo-pink-base)'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "relative flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-8",
        "animate-in fade-in duration-300",
        className,
      )}
    >
      <div className="relative flex items-center justify-center w-10 h-10">
        <span
          className="absolute inset-0 rounded-full opacity-30 blur-md animate-pulse"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <div className="relative motion-safe:animate-pulse">
          {assistantIcon ?? (
            <MingoIcon className="w-8 h-8" eyesColor={accentColor} cornerColor={accentColor} />
          )}
        </div>
      </div>
      <span className="text-sm font-medium text-ods-text-secondary tracking-tight motion-safe:animate-pulse">
        {label}
      </span>
    </div>
  )
}
