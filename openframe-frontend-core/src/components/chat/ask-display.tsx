"use client"

import { forwardRef, useEffect, useState } from "react"

import { cn } from "../../utils/cn"
import { Chevron02LeftIcon, Chevron02RightIcon } from "../icons-v2-generated"
import type { AskDisplayProps } from "./types"

/** Hover explanation on the locked veil — a disabled control should say WHY it
 *  is disabled, and the answer here is always the same: the turn moved on. */
const LOCKED_HINT = "This question was already answered"

/**
 * `ASK` segment — the assistant asking WHICH reading of an ambiguous question it
 * should answer, as a card of numbered options instead of prose bullets
 * (Figma 1:13775).
 *
 * Picking a row sends its `label` verbatim as the user's next message: the
 * backend's guide classifier resolves that reply against the labels it offered,
 * so the row text IS the protocol.
 *
 * Without `onSelect` the card renders LOCKED — dimmed under a veil, rows
 * `disabled`, not-allowed cursor. That is the normal end state: `ChatMessageList`
 * withholds the handler as soon as any user message follows the card, because
 * the question it asked has been answered and re-clicking it would send a stale
 * label into a conversation that moved on. Same state on observer surfaces,
 * where a click would post into someone else's dialog.
 *
 * A run of consecutive `ask` segments is one card with a pager ("1 of 2"), so a
 * turn that asks twice reads as a single block. With one card the pager is
 * absent entirely — there is nothing to page through.
 */
const AskDisplay = forwardRef<HTMLDivElement, AskDisplayProps>(
  ({ className, cards, onSelect, ...props }, ref) => {
    const [index, setIndex] = useState(0)

    // A shrinking run (segments replaced mid-stream) must not strand the pager
    // past the end — clamp instead of rendering an undefined card.
    useEffect(() => {
      setIndex((current) => (current < cards.length ? current : Math.max(0, cards.length - 1)))
    }, [cards.length])

    const active = cards[Math.min(index, cards.length - 1)]
    if (!active) return null

    const showPager = cards.length > 1
    const isInteractive = !!onSelect

    return (
      <div
        ref={ref}
        role="group"
        aria-label={active.question}
        className={cn(
          "flex flex-col gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-s)]",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-[var(--spacing-system-m)]">
          <p className="min-w-0 flex-1 break-words text-h4 text-ods-text-primary">{active.question}</p>
          {showPager && (
            <div className="flex shrink-0 items-center gap-[var(--spacing-system-xxs)]">
              <button
                type="button"
                aria-label="Previous question"
                disabled={index === 0}
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
                className="text-ods-text-secondary transition-colors hover:text-ods-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ods-text-secondary"
              >
                <Chevron02LeftIcon size={16} />
              </button>
              <span className="whitespace-nowrap text-h6 text-ods-text-secondary">
                {index + 1} of {cards.length}
              </span>
              <button
                type="button"
                aria-label="Next question"
                disabled={index === cards.length - 1}
                onClick={() => setIndex((current) => Math.min(cards.length - 1, current + 1))}
                className="text-ods-text-secondary transition-colors hover:text-ods-text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-ods-text-secondary"
              >
                <Chevron02RightIcon size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Locked state = the rows' own `disabled` (assistive tech hears
            "dimmed button", focus skips them, clicks can't fire) PLUS a veil
            over the whole block. The veil is what makes it READ as locked: it
            greys the answers down to caption weight without touching their
            markup, and — sitting above the rows — it owns the pointer, so the
            not-allowed cursor and the "why" tooltip show anywhere over the
            list, not just on a row. The pager stays live above it: paging is
            reading, not answering. */}
        <div className="relative">
          <div className="flex flex-col overflow-hidden rounded-md border border-ods-border">
            {/* Rows carry the divider on their TOP edge except the first, so the
                list never ends on a hanging border (the design's trailing rule
                belongs to the custom-answer input, which this card does not have). */}
            {active.options.map((option, optionIndex) => (
              <button
                key={`${option.label}-${optionIndex}`}
                type="button"
                disabled={!isInteractive}
                onClick={() => onSelect?.(option.label)}
                className={cn(
                  "flex w-full items-start gap-[var(--spacing-system-s)] bg-ods-card p-[var(--spacing-system-s)] text-left transition-colors",
                  optionIndex > 0 && "border-t border-ods-border",
                  "hover:bg-ods-bg-hover disabled:cursor-not-allowed disabled:hover:bg-ods-card"
                )}
              >
                <span className="shrink-0 text-h4 text-ods-text-secondary">{optionIndex + 1}.</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="break-words text-h4 text-ods-text-primary">{option.label}</span>
                  {option.description && (
                    <span className="break-words text-h6 text-ods-text-secondary">{option.description}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {!isInteractive && (
            <div
              aria-hidden="true"
              title={LOCKED_HINT}
              className="absolute inset-0 cursor-not-allowed rounded-md bg-ods-bg/40"
            />
          )}
        </div>
      </div>
    )
  }
)

AskDisplay.displayName = "AskDisplay"

export { AskDisplay }
