'use client'

import React from 'react'
import { InteractiveCard } from '../../ui/interactive-card'
import { ChevronRight, Package } from 'lucide-react'
import { cn } from '../../../utils/cn'

/**
 * Card density:
 * - `default`: full /releases page row (vertical title + description on the
 *   left, version + date column on the right).
 * - `sm`: compact horizontal layout (~80px tall) sized for inline rendering
 *   inside chat messages and other tight surfaces. Drops `<h3>` (block-only,
 *   illegal inside markdown `<p>`) for `<span>` text, swaps the outer
 *   `InteractiveCard` for a `<span>`-anchored link, and collapses to:
 *   56px icon + 1-line title + 1-line meta (version · date).
 */
export type ProductReleaseCardSize = 'default' | 'sm'

export interface ProductReleaseCardProps {
  /** Release title */
  title: string
  /** Release summary/description */
  summary?: string | null
  /** Version string (e.g., "1.2.0") */
  version: string
  /** Formatted date string for display */
  formattedDate: string
  /** Click handler for navigation */
  onClick?: () => void
  /** Additional CSS classes */
  className?: string
  /** Card density. Defaults to `'default'`. */
  size?: ProductReleaseCardSize
}

export function ProductReleaseCard({
  title,
  summary,
  version,
  formattedDate,
  onClick,
  className,
  size = 'default',
}: ProductReleaseCardProps) {
  // ----- COMPACT branch (chat / tight surfaces) ------------------------------
  // Outer must be `<span>` (no `<div>`/`<h3>` allowed inside markdown `<p>`),
  // so we cannot reuse `InteractiveCard` (a `<div>`). Click handler is wired
  // directly; keyboard accessibility comes from `role="button"` + `tabIndex`.
  // Inner layout mirrors BlogCard/CaseStudyCard compact: 56px square slot +
  // primary text + 1-line meta + optional summary clamp.
  if (size === 'sm') {
    const handleKey = (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (!onClick) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onClick()
      }
    }
    return (
      <span
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? handleKey : undefined}
        className={cn(
          // The base frame (`my-1.5 flex … no-underline`) mirrors the
          // hub's `COMPACT_CARD_OUTER` in `components/shared/compact-
          // card/compact-card-classes.ts` byte-for-byte. The OSS lib
          // can't import from the consumer, so the two strings are
          // kept identical by hand — if you edit one, edit the other.
          //
          // The interactive branch ADDS `cursor-pointer` + a focus-
          // visible ring because this outer is a `<span role="button">`
          // (not an `<a>`), so it needs explicit keyboard-focus
          // styling that the hub's anchor variants get for free.
          'my-1.5 flex items-start gap-3 w-full p-2',
          'rounded-lg border border-ods-border bg-ods-card no-underline',
          onClick
            ? 'transition-colors hover:border-ods-text-secondary/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-1 focus-visible:ring-offset-ods-card'
            : 'cursor-default',
          className,
        )}
      >
        <span className="flex h-14 w-14 aspect-square shrink-0 self-start items-center justify-center rounded-md bg-ods-bg text-ods-accent">
          <Package className="h-5 w-5" />
        </span>
        {/* Text column structure must mirror the hub's
            `COMPACT_CARD_TEXT_COL` + `COMPACT_CARD_TITLE_ROW` +
            `COMPACT_CARD_META_ROW_BOX` byte-for-byte. The OSS lib can't
            import from the consumer, so the strings are duplicated by
            hand — if you edit them in the hub's compact-card-classes.ts,
            edit them here too. Per-row heights are fixed (h-5 / h-4 / h-4)
            so a skeleton placeholder occupies the SAME pixel position
            as the loaded text — zero load-to-resolve baseline shift. */}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 min-h-14">
          <span className="flex items-center gap-2 min-w-0 h-5">
            <span className="truncate text-sm font-semibold leading-5 text-ods-text-primary min-w-0">
              {title}
            </span>
            {version ? (
              <span className="shrink-0 rounded bg-ods-accent/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-ods-accent">
                {version}
              </span>
            ) : null}
          </span>
          <span className="flex items-center min-w-0 h-4">
            <span className="truncate text-[11px] leading-4 text-ods-text-secondary">
              {formattedDate || 'Product release'}
            </span>
          </span>
          <span className="flex items-center min-w-0 h-4">
            <span className="truncate text-[11px] leading-4 text-ods-text-secondary/80">
              {/* The literal between the curly-quote string is U+00A0
                  (NBSP). The hub's `COMPACT_CARD_ROW_FILLER` is also
                  NBSP; ASCII space here would let React collapse the
                  child to zero content, breaking baseline parity with
                  the skeleton. Keep these in lockstep. */}
              {summary || ' '}
            </span>
          </span>
        </span>
      </span>
    )
  }

  // ----- DEFAULT branch (existing /releases card, unchanged) -----------------
  return (
    <InteractiveCard
      clickable={true}
      onClick={onClick}
      className={cn(
        'bg-ods-card border border-ods-border rounded-[6px]',
        'flex flex-col md:flex-row',
        'items-start md:items-center',
        'gap-3 md:gap-4',
        'p-4',
        className
      )}
    >
      {/* Left column - content */}
      <div className="flex-1 w-full md:w-auto min-w-0 flex flex-col justify-center gap-2">
        <div className="min-h-[48px] flex items-center">
          <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] line-clamp-2">
            {title}
          </h3>
        </div>
        <p className="text-h4 text-ods-text-secondary line-clamp-3">
          {summary || ' '}
        </p>
      </div>

      {/* Right column - version + date */}
      <div
        className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[200px] flex flex-col justify-center gap-2">
          <p className="text-h3 text-ods-text-primary tracking-[-0.36px] truncate">
            {version}
          </p>
          <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate">
            {formattedDate}
          </p>
        </div>
        {/* Icon column */}
        <div className="flex items-center justify-center p-3 shrink-0">
          <ChevronRight className="h-6 w-6 text-ods-text-primary" />
        </div>
      </div>
    </InteractiveCard>
  )
}
