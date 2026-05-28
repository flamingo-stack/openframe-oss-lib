'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { Skeleton } from '../ui/skeleton'

export interface MingoOnboardingCardSkeletonProps {
  /** Title bar width — Tailwind width utility. Defaults to `w-32`. Vary
   *  per row in the list skeleton so the stack doesn't look uniform. */
  titleWidth?: string
  /** Slash-command bar width — Tailwind width utility. Defaults to `w-20`. */
  slashWidth?: string
  /** Description lines (1 or 2). Defaults to 2 — matches the typical
   *  card from Figma node `7363:205938`. */
  descriptionLines?: 1 | 2
  /** Chip widths for the action row. Defaults to mirror the
   *  `Recent / Search / Find` triad from the live cards. Pass an
   *  empty array to hide the chip row entirely (matches `actions: []`). */
  chipWidths?: ReadonlyArray<string>
  /** Optional className appended to the root cell. */
  className?: string
}

/**
 * 1:1 skeleton placeholder for `MingoOnboardingCard` (Figma node
 * `7363:205939`).
 *
 * Mirrors the live card's outer structure pixel-for-pixel:
 *   - `p-[var(--spacing-system-s)]` cell, `bg-ods-card`,
 *     `border-b border-ods-border last:border-b-0` divider
 *   - `size-4` icon slot, `text-h6`-tall title bar + right-aligned
 *     slash-command bar
 *   - 1–2 description lines using `text-h6`-tall bars
 *   - `h-7` outline-chip placeholders matching the card's action row
 *
 * Render multiple inside a `rounded-md border border-ods-border
 * overflow-hidden` container so the bottom-border on each row forms
 * a 1-px divider, identical to how the live list stacks.
 */
export function MingoOnboardingCardSkeleton({
  titleWidth = 'w-32',
  slashWidth = 'w-20',
  descriptionLines = 2,
  chipWidths = ['w-16', 'w-16', 'w-12'],
  className,
}: MingoOnboardingCardSkeletonProps) {
  const hasChips = chipWidths.length > 0
  return (
    <div
      className={cn(
        'flex w-full items-start p-[var(--spacing-system-s)] bg-ods-card border-b border-ods-border last:border-b-0',
        className,
      )}
    >
      <div className="flex flex-col gap-[var(--spacing-system-xxs)] w-full">
        {/* Title row — icon + title bar + right-rail slash bar. */}
        <div className="flex items-center gap-[var(--spacing-system-xxs)] w-full">
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <Skeleton className={cn('h-3.5 rounded-sm', titleWidth)} />
          <span className="flex-1" />
          <Skeleton className={cn('h-3.5 rounded-sm shrink-0', slashWidth)} />
        </div>
        {/* Description — 1 or 2 lines; second line is 70% so the
         *  ragged edge mimics natural text wrapping. */}
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Skeleton className="h-3.5 w-full rounded-sm" />
          {descriptionLines === 2 ? (
            <Skeleton className="h-3.5 w-[70%] rounded-sm" />
          ) : null}
        </div>
        {/* Action chip row — `h-7` matches the live card's outline
         *  chips so the skeleton sits at exactly the same height. */}
        {hasChips ? (
          <div className="flex flex-wrap items-center gap-[var(--spacing-system-xxs)] mt-[var(--spacing-system-xs)]">
            {chipWidths.map((w, i) => (
              <Skeleton key={i} className={cn('h-7 rounded-md', w)} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export interface MingoOnboardingListSkeletonProps {
  /** Row count. Defaults to 6 — fills the typical empty-state
   *  viewport so the loader doesn't pop in shorter than the resolved
   *  list. */
  rows?: number
  /** Optional className appended to the rounded outer container. */
  className?: string
}

/**
 * Stack of `MingoOnboardingCardSkeleton` rows wrapped in the same
 * `rounded-md border overflow-hidden` shell the live empty-state
 * list uses. Drop-in replacement for the resolved card list while
 * `/api/docs/commands` is in-flight.
 *
 * Row widths cycle through a deterministic palette so the stack
 * doesn't look uniform but also doesn't shift between renders.
 */
export function MingoOnboardingListSkeleton({
  rows = 6,
  className,
}: MingoOnboardingListSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading slash commands"
      aria-busy="true"
      className={cn(
        'rounded-md border border-ods-border bg-ods-card overflow-hidden',
        className,
      )}
    >
      {Array.from({ length: rows }).map((_, i) => {
        const variant = ROW_VARIANTS[i % ROW_VARIANTS.length]
        return (
          <MingoOnboardingCardSkeleton
            key={i}
            titleWidth={variant.titleWidth}
            slashWidth={variant.slashWidth}
            descriptionLines={variant.descriptionLines}
          />
        )
      })}
    </div>
  )
}

/**
 * Deterministic per-row width variation so the skeleton stack feels
 * like a real, irregular list. Cycled by index — same input renders
 * the same output, no `Math.random` jitter on re-mount.
 *
 * Widths picked to approximate the live `/api/docs/commands` payload:
 *   - titles range from short ("Webinars") to long
 *     ("OpenFrame Pull Requests")
 *   - slashes range from `/docs` to `/getting-started`
 */
const ROW_VARIANTS: ReadonlyArray<{
  titleWidth: string
  slashWidth: string
  descriptionLines: 1 | 2
}> = [
  { titleWidth: 'w-32', slashWidth: 'w-20', descriptionLines: 2 },
  { titleWidth: 'w-28', slashWidth: 'w-16', descriptionLines: 2 },
  { titleWidth: 'w-40', slashWidth: 'w-24', descriptionLines: 2 },
  { titleWidth: 'w-44', slashWidth: 'w-28', descriptionLines: 2 },
  { titleWidth: 'w-36', slashWidth: 'w-24', descriptionLines: 1 },
  { titleWidth: 'w-24', slashWidth: 'w-16', descriptionLines: 2 },
]
