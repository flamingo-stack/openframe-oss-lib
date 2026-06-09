'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { Tag } from '../ui/tag'
import { ActionsMenuDropdown } from '../ui/actions-menu'
import { Ellipsis01Icon } from '../icons-v2-generated'
import { useAutoLimitTags } from '../../hooks/ui/use-auto-limit-tags'

// =============================================================================
// Types
// =============================================================================

/** A single collapsible quick-action chip. */
export interface QuickActionChip {
  /** Stable React key + menu-item id. */
  id: string
  label: string
  icon?: React.ReactNode
  /** `'primary'` = accent (yellow) chip, `'outline'` = bordered chip (default). */
  variant?: 'primary' | 'outline'
  onSelect?: () => void
}

export interface ChatQuickActionRowProps {
  /** Always-visible leading chip(s) (e.g. Mingo's "Start Guide Chat"). Never
   *  collapses into the overflow menu — rendered before the measured zone. */
  leading?: React.ReactNode
  /** Collapsible chips — as many as fit on one line render inline; the rest
   *  collapse under a trailing "⋯" overflow menu (small icon button). */
  chips: ReadonlyArray<QuickActionChip>
  className?: string
}

// =============================================================================
// Chip button
// =============================================================================

function ChipButton({ chip }: { chip: QuickActionChip }) {
  return (
    <button
      type="button"
      onClick={chip.onSelect}
      className="shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
    >
      <Tag variant={chip.variant ?? 'outline'} icon={chip.icon} label={chip.label} />
    </button>
  )
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
  className,
}: ChatQuickActionRowProps) {
  const auto = useAutoLimitTags({
    count: chips.length,
    reserveInputWidth: false,
  })

  const visibleChips = chips.slice(0, auto.visibleCount)
  const hiddenChips = chips.slice(auto.visibleCount)

  if (!leading && chips.length === 0) return null

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
                    icon: chip.icon,
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
            icon={chip.icon}
            label={chip.label}
          />
        ))}
      </div>
    </div>
  )
}
