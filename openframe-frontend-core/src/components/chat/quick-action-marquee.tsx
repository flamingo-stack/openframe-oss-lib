'use client'

import * as React from 'react'
import type { MarqueeSyncController } from '../ui/marquee-wall'
import type { QuickActionIconSpec } from './quick-action-chip'
import type { QuickActionChip } from './chat-quick-action-row'
import { QuickActionWall } from './quick-action-wall'

// =============================================================================
// Types
// =============================================================================

export interface QuickActionMarqueeItem {
  /** Stable key (suffixed per track copy internally). */
  id: string
  label: string
  icon?: React.ReactNode | QuickActionIconSpec
}

export interface QuickActionMarqueeProps {
  items: ReadonlyArray<QuickActionMarqueeItem>
  /** `'animated'` (default): endless scroll. `'plain'`: a static chip row —
   *  the consumer's opt-out of the marquee (no motion, no track padding
   *  effects beyond the plain layout). */
  mode?: 'animated' | 'plain'
  /** Scroll direction. `'right'` reverses the travel. Default `'left'`. */
  direction?: 'left' | 'right'
  /** Scroll speed in px/s — the shared marquee unit (CardsStrip cruises at
   *  60). Default 40: on-screen speed stays constant no matter how many quick
   *  actions an agent has (the engine is position-based, not loop-based). */
  speed?: number
  /** Pause the scroll while hovered. Default true. */
  pauseOnHover?: boolean
  /** When provided chips are interactive buttons; omitted → decorative tags. */
  onSelect?: (item: QuickActionMarqueeItem) => void
  /** Repeat-pad the track to at least this many chips so one copy overflows
   *  the widest container this strip can get (the loop only engages on
   *  overflow). Default 12 ≈ 2600px+, enough for a full-bleed max-w-[1920px]
   *  section. */
  minChips?: number
  /** Pair with a sibling marquee under ONE position driver (the resolve
   *  strips' pending/resolved copies stay pixel-locked). */
  sync?: MarqueeSyncController
  className?: string
}

// =============================================================================
// Component
// =============================================================================

/**
 * Endless horizontally-scrolling strip of quick-action chips (Figma fae/mingo
 * marquee rows) — the single-row preset of {@link QuickActionWall} (same
 * chips, same engine, `flex-nowrap` layout). Clone-copy chips stay
 * interactive when `onSelect` is set (clone wrapper a11y applies). Pauses on
 * hover (optional) and always under `prefers-reduced-motion`.
 */
export function QuickActionMarquee({
  items,
  mode = 'animated',
  direction = 'left',
  speed = 40,
  pauseOnHover = true,
  onSelect,
  minChips = 12,
  sync,
  className,
}: QuickActionMarqueeProps) {
  const chips = React.useMemo<QuickActionChip[]>(
    () =>
      items.map(item => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        onSelect: onSelect ? () => onSelect(item) : undefined,
      })),
    [items, onSelect],
  )

  if (items.length === 0) return null

  return (
    <QuickActionWall
      chips={chips}
      mode={mode}
      axis="x"
      reverse={direction === 'right'}
      speed={speed}
      pauseOnHover={pauseOnHover}
      // Plain mode shows the items once, untruncated; padding only serves
      // the endless loop.
      minChips={mode === 'plain' ? undefined : minChips}
      copyGap={8}
      className={className}
      contentClassName="flex-nowrap items-center"
      sync={sync}
    />
  )
}
