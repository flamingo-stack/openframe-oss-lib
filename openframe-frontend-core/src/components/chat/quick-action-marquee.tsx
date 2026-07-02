'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { QuickActionChipButton, type QuickActionIconSpec } from './quick-action-chip'

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
  /** Scroll direction. `'right'` reverses the animation. Default `'left'`. */
  direction?: 'left' | 'right'
  /** Seconds per full loop. Default 40. */
  duration?: number
  /** Pause the scroll while hovered. Default true. */
  pauseOnHover?: boolean
  /** When provided chips are interactive buttons; omitted → decorative tags. */
  onSelect?: (item: QuickActionMarqueeItem) => void
  className?: string
}

// Heuristic: ~6 chips ≈ one 1280px viewport width, so the halved track always
// fills the screen; bump if chips shrink.
const MIN_TRACK_ITEMS = 6

// =============================================================================
// Component
// =============================================================================

/**
 * Endless horizontally-scrolling strip of quick-action chips (Figma fae/mingo
 * marquee rows). The item list is padded to at least {@link MIN_TRACK_ITEMS}
 * and rendered twice so the `qa-marquee` keyframe's `translateX(-50%)` loops
 * seamlessly; the second half is `aria-hidden`. Pauses on hover (optional)
 * and always under `prefers-reduced-motion`.
 */
export function QuickActionMarquee({
  items,
  direction = 'left',
  duration = 40,
  pauseOnHover = true,
  onSelect,
  className,
}: QuickActionMarqueeProps) {
  if (items.length === 0) return null

  const repeats = Math.max(1, Math.ceil(MIN_TRACK_ITEMS / Math.max(1, items.length)))
  const padded = Array.from({ length: repeats }, () => items).flat()
  const track = [...padded, ...padded]
  const half = padded.length

  return (
    <div className={cn('group overflow-hidden', className)}>
      <div
        className={cn(
          'flex w-max items-center gap-2 animate-qa-marquee motion-reduce:[animation-play-state:paused]',
          direction === 'right' && '[animation-direction:reverse]',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{ '--qa-marquee-duration': `${duration}s` } as React.CSSProperties}
      >
        {track.map((item, index) => (
          <span key={`${item.id}__${index}`} aria-hidden={index >= half || undefined}>
            <QuickActionChipButton
              label={item.label}
              icon={item.icon}
              interactive={!!onSelect}
              onSelect={onSelect ? () => onSelect(item) : undefined}
            />
          </span>
        ))}
      </div>
    </div>
  )
}
