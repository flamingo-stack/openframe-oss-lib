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

/**
 * Minimal structural `<a>` prop bundle the consumer composes (typically
 * via the hub's `useNavLink` hook — single source of truth for click
 * routing). Kept structural here so the OSS lib has zero hub coupling;
 * the consumer's `NavLinkProps` is type-compatible by shape.
 *
 * When supplied, the outer element renders as `<a {...anchorProps}>` so
 * the SAME routing decision (modifier-click → browser default, cross-
 * origin → new tab, same-origin → `router.push`) runs identically to
 * every other entity card. When absent, the legacy `onClick` branch is
 * used (back-compat for the public `/releases` page).
 */
export interface ProductReleaseCardAnchorProps {
  href: string
  target?: '_blank'
  rel?: 'noopener noreferrer'
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void
}

export interface ProductReleaseCardProps {
  /** Release title */
  title: string
  /** Release summary/description */
  summary?: string | null
  /** Version string (e.g., "1.2.0") */
  version: string
  /** Formatted date string for display */
  formattedDate: string
  /**
   * Legacy click handler — kept for back-compat with public-page callers
   * (e.g. `/releases` tab) that route via `router.push()` directly. When
   * `anchorProps` is also supplied, `anchorProps` wins and this is
   * ignored.
   */
  onClick?: () => void
  /**
   * `<a>` prop bundle from the consumer's `useNavLink` (or equivalent).
   * When provided, the card's outer element renders as a real anchor so
   * routing (cross-origin → new tab, same-origin → soft RSC nav,
   * modifier-click → browser default) is owned by the hook — the card
   * writes NO click logic of its own. This is the path every other
   * entity card uses; `onClick` is only kept for the one legacy caller.
   */
  anchorProps?: ProductReleaseCardAnchorProps
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
  anchorProps,
  className,
  size = 'default',
}: ProductReleaseCardProps) {
  // ----- COMPACT branch (chat / tight surfaces) ------------------------------
  // Outer must be a phrasing-content element (`<a>` or `<span>`) — block
  // elements like `<div>`/`<h3>` are illegal inside markdown `<p>`, so we
  // cannot reuse `InteractiveCard` (a `<div>`).
  //
  // - When `anchorProps` is set, render as a real `<a>` so the consumer's
  //   click hook (`useNavLink`) owns routing identically to every other
  //   entity card — cross-origin → new tab, same-origin → soft RSC nav.
  // - Else fall back to legacy `<span role="button">` behavior driven by
  //   `onClick` (kept for the public `/releases` page caller).
  // - When neither is set, render a static non-interactive span.
  //
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
    const isInteractive = !!anchorProps || !!onClick
    const outerClassName = cn(
      // The base frame (`my-1.5 flex … no-underline`) mirrors the
      // hub's `COMPACT_CARD_OUTER` in `components/shared/compact-
      // card/compact-card-classes.ts` byte-for-byte. The OSS lib
      // can't import from the consumer, so the two strings are
      // kept identical by hand — if you edit one, edit the other.
      //
      // The interactive branch ADDS `cursor-pointer` + a focus-
      // visible ring. The `<a>` form would normally get focus styling
      // from the browser, but `no-underline` strips the default
      // affordance, so explicit ring styles match the `<span role>` form.
      'my-1.5 flex items-start gap-3 w-full p-2',
      'rounded-lg border border-ods-border bg-ods-card no-underline',
      isInteractive
        ? 'transition-colors hover:border-ods-text-secondary/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-1 focus-visible:ring-offset-ods-card'
        : 'cursor-default',
      className,
    )
    const innerChildren = (
      <>
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
            <span className="truncate text-sm font-semibold leading-5 text-ods-text-primary min-w-0" title={title}>
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
            <span className="truncate text-[11px] leading-4 text-ods-text-secondary/80" title={summary || undefined}>
              {/* The literal between the curly-quote string is U+00A0
                  (NBSP). The hub's `COMPACT_CARD_ROW_FILLER` is also
                  NBSP; ASCII space here would let React collapse the
                  child to zero content, breaking baseline parity with
                  the skeleton. Keep these in lockstep. */}
              {summary || ' '}
            </span>
          </span>
        </span>
      </>
    )
    // Anchor variant — consumer's `useNavLink` (or equivalent) owns the
    // click decision; the card just spreads the prop bundle and renders
    // a real `<a>` so cmd/ctrl-click new-tab + middle-click work without
    // any extra JS. This is the SAME pattern BlogCard / CaseStudyCard /
    // ProgramCard / etc. use across the consumer codebase.
    if (anchorProps) {
      return (
        <a {...anchorProps} className={outerClassName}>
          {innerChildren}
        </a>
      )
    }
    // Legacy fallback — `onClick` (no href). Keeps the public `/releases`
    // page's existing `router.push(...)` flow working unchanged. When
    // neither `anchorProps` nor `onClick` is set, renders a static
    // non-interactive span.
    return (
      <span
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? handleKey : undefined}
        className={outerClassName}
      >
        {innerChildren}
      </span>
    )
  }

  // ----- DEFAULT branch (existing /releases card layout) -----------------
  // When `anchorProps` is supplied, the card behaves like every other
  // entity card on the related-content rail — real `<a>` with the
  // consumer's `useNavLink` bundle (cross-origin → new tab, same-origin
  // → soft RSC nav, modifier-click → browser default). The
  // `<InteractiveCard onClick>` form remains the back-compat path for
  // the public `/releases` tab caller which still routes via
  // `router.push()` directly.
  if (anchorProps) {
    return (
      <a
        {...anchorProps}
        className={cn(
          'bg-ods-card border border-ods-border rounded-[6px]',
          'flex flex-col md:flex-row',
          'items-start md:items-center',
          'gap-3 md:gap-4',
          'p-4 no-underline',
          'transition-colors hover:border-ods-text-secondary/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent focus-visible:ring-offset-1 focus-visible:ring-offset-ods-card',
          className,
        )}
      >
        {/* Left column - content */}
        <div className="flex-1 w-full md:w-auto min-w-0 flex flex-col justify-center gap-2">
          <div className="min-h-[48px] flex items-center">
            <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] line-clamp-2" title={title}>
              {title}
            </h3>
          </div>
          <p className="text-h4 text-ods-text-secondary line-clamp-3" title={summary || ' '}>
            {summary || ' '}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto justify-start md:justify-end shrink-0">
          <div className="w-[200px] flex flex-col justify-center gap-2">
            <p className="text-h3 text-ods-text-primary tracking-[-0.36px] truncate">
              {version}
            </p>
            <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary truncate">
              {formattedDate}
            </p>
          </div>
          <div className="flex items-center justify-center p-3 shrink-0">
            <ChevronRight className="h-6 w-6 text-ods-text-primary" />
          </div>
        </div>
      </a>
    )
  }
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
          <h3 className="text-h3 text-ods-text-primary tracking-[-0.36px] line-clamp-2" title={title}>
            {title}
          </h3>
        </div>
        <p className="text-h4 text-ods-text-secondary line-clamp-3" title={summary || ' '}>
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
