"use client"

import * as React from "react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../hover-card"
import { Button } from "../ui/button"
import { cn } from "../../utils/cn"

/**
 * Per-row metadata used by the inline object-card renderer.
 *
 * Mirrors `ChatRef` in `lib/data/doc-chat-utils.ts` on the server. Keep this
 * shape in sync — the wire format is the JSON-serialized form of the server
 * type, no transformation in between. v6.1 §B.2.2.
 */
export interface ChatRef {
  /** documentType from RagTableConfig (e.g. 'webinar', 'customer_interview'). */
  type: string
  /** Primary-key value (config.primaryKey). Treated as opaque string. */
  id: string
  /** Display title — typically buildName(row). */
  title: string
  /** Resolved external URL — null for internal-only entries. */
  url: string | null
  /** ISO date for the row's canonical time. Optional. */
  date?: string
  /** PII-sanitized hover preview text. Optional — type may opt out. */
  preview?: string
  /** Type-specific extras (speakers, status, etc.). */
  metadata?: Record<string, unknown>
}

export interface ObjectCardProps {
  reference: ChatRef
  /**
   * Whether the card type supports a "Discuss" action — i.e. the host has a
   * registered slash command (or equivalent affordance) for drilling into
   * a single row of this type. Computed via `slashCmdForType` on the host
   * side per v6.1 DRY duplications #2 (registry lookup, NOT hardcoded
   * `'discuss-' + type`). When false, the Discuss button is hidden.
   */
  canDiscuss?: boolean
  /**
   * Click handler for the Discuss button. Receives the ref so the host can
   * synthesize the natural-prompt turn ("Tell me more about <title>") with
   * a structured `commandOverride.entityIdFilter` field on the request body.
   * v6.1 §B.2.8 — the host MUST send a NEW chat turn whose user content is
   * the natural prompt, NOT a literal slash command.
   */
  onDiscuss?: (reference: ChatRef) => void
  /** Optional additional className applied to the trigger pill. */
  className?: string
}

/**
 * Inline pill that expands to a hover card with title + date + preview
 * + Open + Discuss. Used inside a chat assistant message body wherever the
 * model emitted `[card://<type>:<id>]` markers.
 *
 * The pill is `<span>`-based (not `<button>`) so it can sit inside flowing
 * prose without breaking line wrapping. Hover-card primitives still expose
 * keyboard focus + ARIA via Radix.
 */
export const ObjectCard = React.forwardRef<HTMLSpanElement, ObjectCardProps>(
  function ObjectCard({ reference, canDiscuss, onDiscuss, className }, ref) {
    const trigger = (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded",
          "bg-ods-card border border-ods-border text-ods-text-primary",
          "text-sm font-medium align-baseline cursor-pointer",
          "hover:bg-ods-card-hover transition-colors",
          className,
        )}
        // a11y: behaves as a tooltip-trigger (Radix manages aria-describedby).
        // role="button" is intentional even though tag is span — the user
        // can interact via keyboard via the hover-card focus events.
        role="button"
        tabIndex={0}
      >
        <span className="truncate max-w-[280px]">{reference.title}</span>
      </span>
    )

    return (
      <HoverCard openDelay={150} closeDelay={120}>
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        <HoverCardContent
          align="start"
          sideOffset={6}
          className="w-80 bg-ods-card text-ods-text-primary border-ods-border p-4"
        >
          <div className="flex flex-col gap-1">
            <div className="text-sm font-semibold leading-snug">{reference.title}</div>
            {reference.date ? (
              <div className="text-xs text-ods-text-secondary">{formatDateForCard(reference.date)}</div>
            ) : null}
          </div>
          {reference.preview ? (
            <p className="text-xs text-ods-text-secondary mt-2 mb-3 line-clamp-4 leading-relaxed">
              {reference.preview}
            </p>
          ) : (
            <div className="h-2" />
          )}
          <div className="flex gap-2 pt-1">
            {reference.url ? (
              <Button
                variant="outline"
                size="small"
                asChild
                className="bg-ods-card border-ods-border text-ods-text-primary hover:bg-ods-card-hover"
              >
                <a href={reference.url} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
              </Button>
            ) : null}
            {canDiscuss && onDiscuss ? (
              <Button
                variant="transparent"
                size="small"
                onClick={() => onDiscuss(reference)}
                className="text-ods-text-primary hover:bg-ods-card-hover"
              >
                Discuss
              </Button>
            ) : null}
          </div>
        </HoverCardContent>
      </HoverCard>
    )
  },
)

ObjectCard.displayName = "ObjectCard"

/** Cheap ISO-or-locale rendering — accepts `2025-08-15`, `2025-08-15T10:00:00Z`,
 *  or anything Date can parse. Falls back to the raw value when parse fails. */
function formatDateForCard(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}
