"use client"

import { forwardRef, type HTMLAttributes } from "react"
import { cn } from "../../utils/cn"
import { formatTime } from "../../utils/format-date"
import { InfoCircleIcon } from "../icons-v2-generated"
import type { TicketEscalatedSegment } from "./types/message.types"

const TITLE = "Handed Off to a Technician"

/** Shown when the wire omits `text` (the field is nullable). */
const DEFAULT_BODY = "A technician will reply when available."

export interface TicketEscalatedMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: TicketEscalatedSegment['data']
  /** Timestamp of the message row this block came in on. */
  timestamp?: Date
}

/**
 * Handoff receipt — the conversation now belongs to a human technician.
 * Figma `ai-assistant-info` (type=escalation).
 *
 * The body is whatever the backend authored, so the reason it gives stays
 * server-side; the client never composes an explanation and never branches on
 * `data.reason`, which is why a reason added server-side needs no change here.
 *
 * That body WRAPS, deliberately diverging from the mock's single-line ellipsis:
 * the mock's 72px comes from its placeholder copy fitting one line, while the
 * real wire text is a full sentence, and clipping the only explanation of why
 * the chat was handed off is not recoverable on touch. The title still
 * truncates — it is a constant, and holding one line keeps the timestamp from
 * being pushed out of the row at narrow widths.
 */
const TicketEscalatedMessage = forwardRef<HTMLDivElement, TicketEscalatedMessageProps>(
  ({ className, data, timestamp, ...props }, ref) => {
    const body = data.text?.trim() || DEFAULT_BODY
    return (
      <div
        ref={ref}
        className={cn(
          "mb-[var(--spacing-system-xsf)] flex items-start gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]",
          className,
        )}
        {...props}
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg">
          <InfoCircleIcon className="size-6 text-ods-flamingo-pink" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex w-full items-start">
            <p className="text-h4 min-w-0 flex-1 truncate text-ods-text-primary" title={TITLE}>
              {TITLE}
            </p>
            {timestamp && (
              <span className="text-h6 shrink-0 text-right text-ods-text-secondary">{formatTime(timestamp)}</span>
            )}
          </div>
          <p className="text-h4 w-full break-words text-ods-text-secondary">{body}</p>
        </div>
      </div>
    )
  },
)

TicketEscalatedMessage.displayName = "TicketEscalatedMessage"

export { TicketEscalatedMessage }
