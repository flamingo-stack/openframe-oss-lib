'use client'

/**
 * <VideoPlayBadge> — a pixel REPLICA of MuxPlayer/media-chrome's center play
 * button (measured from the live player: 90×90 solid-black circle, 24px
 * padding, filled `m6 21 15-9L6 3v18Z` triangle). MuxPlayer's native control
 * is THE play affordance everywhere a player exists; this replica covers the
 * one gap where it can't — surfaces with NO mounted player yet:
 *
 *   - <VideoBiteCard> resting posters/facades (player mounts on activation)
 *   - <YouTubeFacade> poster (iframe loads on click)
 *   - <MediaCarousel> video thumbnails (sm — scaled-down same language)
 *
 * When the real player mounts, its native center button takes over
 * seamlessly — identical pixels. Decorative (`pointer-events-none`): the
 * host surface owns activation.
 */

import React from 'react'
import { cn } from '../../utils/cn'

export type VideoCenterBadgeSize = 'sm' | 'md' | 'lg'

// md/lg = media-chrome's actual center-button geometry; sm = the same
// language scaled for tiny gallery thumbnails.
const SIZES: Record<VideoCenterBadgeSize, { disc: number; icon: number }> = {
  sm: { disc: 40, icon: 18 },
  md: { disc: 90, icon: 42 },
  lg: { disc: 90, icon: 42 },
}

export interface VideoPlayBadgeProps {
  size?: VideoCenterBadgeSize
  className?: string
}

export function VideoPlayBadge({ size = 'md', className }: VideoPlayBadgeProps): React.ReactElement {
  const s = SIZES[size]
  return (
    <div
      className={cn(
        // Solid black circle + white glyph — exactly media-chrome's computed
        // center-button style (not theme tokens: it must match the REAL
        // control that replaces it when the player mounts).
        'pointer-events-none flex items-center justify-center rounded-full bg-black text-white',
        className,
      )}
      style={{ width: s.disc, height: s.disc }}
    >
      {/* media-chrome's own play path (viewBox 24) — identical glyph. */}
      <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" style={{ width: s.icon, height: s.icon }}>
        <path d="m6 21 15-9L6 3v18Z" />
      </svg>
    </div>
  )
}
