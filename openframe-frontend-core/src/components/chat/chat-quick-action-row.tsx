'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { Tag } from '../ui/tag'
import { Skeleton } from '../ui/skeleton'
import { ActionsMenuDropdown } from '../ui/actions-menu'
import { Ellipsis01Icon } from '../icons-v2-generated'
import { useAutoLimitTags } from '../../hooks/ui/use-auto-limit-tags'
import {
  QuickActionChipButton,
  QuickActionChipSkeleton,
  renderQuickActionIcon,
  type QuickActionChipLozenge,
  type QuickActionIconSpec,
  type QuickActionAccent,
  type QuickActionTheme,
} from './quick-action-chip'

// =============================================================================
// Types
// =============================================================================

/** A single collapsible quick-action chip. */
export interface QuickActionChip {
  /** Stable React key + menu-item id. */
  id: string
  label: string
  /** Pre-rendered node OR a declarative {@link QuickActionIconSpec} (resolved
   *  via the unified `<EntityIcon>` path). */
  icon?: React.ReactNode | QuickActionIconSpec
  /** Chip theme (fae/mingo/it/sec) — accent fallback + `lozenge: true`
   *  source. Per-chip so mixed walls (interleaved IT/SEC streams) work. */
  theme?: QuickActionTheme
  /** Classification affix at the label's leading edge; `true` = the theme's. */
  lozenge?: QuickActionChipLozenge | boolean
  /** `'primary'` = accent (yellow) chip, `'outline'` = bordered chip (default). */
  variant?: 'primary' | 'outline'
  /** Active single-select state — renders the accented `selected` skin
   *  (overrides `variant`). */
  selected?: boolean
  /** Accent for the `selected` skin (`'cyan'` = cyan twin, else pink). */
  selectedAccent?: QuickActionAccent
  onSelect?: () => void
  /** Pointer/keyboard focus enters the chip — e.g. preview the full prompt in
   *  the composer. */
  onHoverStart?: () => void
  /** Pointer/keyboard focus leaves the chip — e.g. restore the composer. */
  onHoverEnd?: () => void
}

export interface ChatQuickActionRowProps {
  /** Always-visible leading chip(s) (e.g. Mingo's "Start Guide Chat"). Never
   *  collapses into the overflow menu — rendered before the measured zone. */
  leading?: React.ReactNode
  /** Collapsible chips — as many as fit on one line render inline; the rest
   *  collapse under a trailing "⋯" overflow menu (small icon button). */
  chips: ReadonlyArray<QuickActionChip>
  /** Render ALL chips in a wrapping multi-line row instead of the single-line +
   *  "⋯" overflow collapse. Every chip stays directly visible (and hoverable),
   *  for roomy contexts (e.g. the Guide empty state) where overflow-hiding chips
   *  would defeat per-chip hover/preview. */
  wrap?: boolean
  /** Render `skeletonCount` loading chips (the real {@link QuickActionChipSkeleton},
   *  so geometry is 1:1 with the loaded chips) instead of `chips`. Wrap-aware. */
  loading?: boolean
  /** How many skeleton chips to draw when `loading`. Default 8. */
  skeletonCount?: number
  className?: string
}

// Deterministic label widths (in `ch`) so a loading wall reads like a populated
// one — a varied spread, not a uniform block.
const SKELETON_LABEL_CHS = [16, 9, 13, 7, 18, 8, 20, 11, 15, 10, 19, 12, 17, 8, 21, 14]

// =============================================================================
// Chip button
// =============================================================================

/**
 * THE {@link QuickActionChip}-data → {@link QuickActionChipButton} mapper —
 * one prop-plumbing spelling shared by the chat rows, `QuickActionWall`, and
 * `QuickActionMarquee` (adding a chip field means editing exactly here).
 * `defaultTheme`/`defaultLozenge` fill gaps for wall-level theming;
 * `interactive={false}` renders the decorative Tag form (loop-clone copies).
 */
export function QuickActionChipFromData({
  chip,
  defaultTheme,
  defaultLozenge,
  interactive = true,
  className,
}: {
  chip: QuickActionChip
  defaultTheme?: QuickActionTheme
  defaultLozenge?: boolean
  interactive?: boolean
  className?: string
}) {
  return (
    <QuickActionChipButton
      label={chip.label}
      icon={chip.icon}
      theme={chip.theme ?? defaultTheme}
      lozenge={chip.lozenge ?? (defaultLozenge || undefined)}
      variant={chip.variant ?? 'outline'}
      selected={chip.selected}
      selectedAccent={chip.selectedAccent}
      onSelect={chip.onSelect}
      onHoverStart={chip.onHoverStart}
      onHoverEnd={chip.onHoverEnd}
      interactive={interactive}
      className={className}
    />
  )
}

// The chip visual + button wiring lives in the shared `QuickActionChipButton`;
// the data mapping lives in `QuickActionChipFromData` (one spelling).
function ChipButton({ chip }: { chip: QuickActionChip }) {
  return <QuickActionChipFromData chip={chip} />
}

// =============================================================================
// Component
// =============================================================================

/**
 * A single-line quick-action chip row that collapses overflow into a "⋯" menu.
 *
 * Same dynamic, width-measured overflow used by the multi-select Autocomplete
 * (`useAutoLimitTags`): off-screen copies of every chip are measured, as many
 * as fit render inline, and the remainder move into an `ActionsMenuDropdown`
 * behind a small "⋯" icon button. An optional `leading` slot stays pinned and
 * never collapses, so the row's primary action is always reachable.
 */
export function ChatQuickActionRow({
  leading,
  chips,
  wrap = false,
  loading = false,
  skeletonCount = 8,
  className,
}: ChatQuickActionRowProps) {
  const auto = useAutoLimitTags({
    count: chips.length,
    reserveInputWidth: false,
  })

  const visibleChips = chips.slice(0, auto.visibleCount)
  const hiddenChips = chips.slice(auto.visibleCount)

  // Loading: draw skeleton chips (real `QuickActionChipSkeleton`, 1:1 geometry)
  // in the same wrap/inline layout — one shared skeleton for every consumer, no
  // hand-rolled bars.
  if (loading) {
    return (
      <div className={cn('flex shrink-0 items-center gap-1', wrap && 'flex-wrap', className)}>
        {Array.from({ length: skeletonCount }, (_, i) => (
          <QuickActionChipSkeleton key={i} labelCh={SKELETON_LABEL_CHS[i % SKELETON_LABEL_CHS.length]} />
        ))}
      </div>
    )
  }

  if (!leading && chips.length === 0) return null

  // Wrap mode: no width-measurement / "⋯" overflow — every chip renders inline
  // (reusing the same `ChipButton`, so hover/focus wiring is identical) and the
  // row wraps to as many lines as needed.
  if (wrap) {
    return (
      <div className={cn('flex shrink-0 flex-wrap items-center gap-1', className)}>
        {leading}
        {chips.map((chip) => (
          <ChipButton key={chip.id} chip={chip} />
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn('relative flex shrink-0 items-center gap-1', className)}
    >
      {leading}

      {chips.length > 0 && (
        // Measured zone: `flex-1 min-w-0 overflow-hidden` so it claims the width
        // left by the pinned `leading` slot and clips anything past the fit.
        <div
          ref={auto.middleRef}
          className="flex flex-1 min-w-0 items-center gap-1 overflow-hidden"
        >
          {visibleChips.map((chip) => (
            <ChipButton key={chip.id} chip={chip} />
          ))}

          {hiddenChips.length > 0 && (
            <ActionsMenuDropdown
              triggerAriaLabel="More quick actions"
              // Don't return focus (and its ring) to the "⋯" trigger on close.
              onCloseAutoFocus={(e) => e.preventDefault()}
              groups={[
                {
                  items: hiddenChips.map((chip) => ({
                    id: chip.id,
                    label: chip.label,
                    icon: renderQuickActionIcon(chip.icon),
                    onClick: chip.onSelect,
                  })),
                },
              ]}
              customTrigger={
                <button
                  ref={auto.badgeRef}
                  type="button"
                  aria-label="More quick actions"
                  className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
                >
                  <Tag variant="outline" label={<Ellipsis01Icon size={16} />} />
                </button>
              }
            />
          )}
        </div>
      )}

      {/* Off-screen measurement copies of every chip — the hook reads their
          widths to decide how many fit. Mirror the visible chip markup (same
          variant/icon/label and the same `gap-1`) so the measured widths match
          what actually renders. */}
      <div
        ref={auto.measureRef}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 -z-10 flex gap-1"
      >
        {chips.map((chip) => (
          <Tag
            key={`measure-${chip.id}`}
            variant={chip.variant ?? 'outline'}
            icon={renderQuickActionIcon(chip.icon)}
            label={chip.label}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Skeleton
// =============================================================================

export interface ChatQuickActionRowSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder chips to render. Defaults to 3. */
  count?: number
}

// Varied widths so the placeholder reads like real, differently-sized chips
// instead of a row of identical bars.
const SKELETON_CHIP_WIDTHS = ['w-28', 'w-32', 'w-24', 'w-36', 'w-20']

/**
 * Loading placeholder for {@link ChatQuickActionRow}. Each chip mirrors a
 * `ChipButton`'s `Tag` footprint (`h-8 rounded-md`) so the row keeps its height
 * and shape while the real quick actions load.
 */
export function ChatQuickActionRowSkeleton({ className, count = 3, ...props }: ChatQuickActionRowSkeletonProps) {
  return (
    <div aria-hidden className={cn('flex shrink-0 items-center gap-1', className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={cn('h-8 shrink-0 rounded-md', SKELETON_CHIP_WIDTHS[i % SKELETON_CHIP_WIDTHS.length])}
        />
      ))}
    </div>
  )
}
