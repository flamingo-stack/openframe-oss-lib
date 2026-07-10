'use client'

/**
 * THE center media-control badge — the single visual identity for every
 * play/unmute affordance rendered over video surfaces across the project:
 *
 *   - <VideoBiteCard> resting/paused center play (md)
 *   - <YouTubeFacade> facade play button (lg)
 *   - <MediaCarousel> video-thumb indicators (sm)
 *   - <FilePlayer>'s unmute chip (md — uses `videoCenterBadgeClass` on its
 *     interactive <button>)
 *
 * One dark scrim disc + white glyph (WCAG 1.4.11 3:1 non-text contrast over
 * arbitrary frames — the YouTube/Netflix thumbnail treatment). Fixed
 * black/white — deliberately NOT theme tokens: the disc sits on video pixels,
 * not on a themed surface (same rationale as the bite overlay's `bg-black/75`
 * per Figma). Full-player chrome (control bars) stays MuxPlayer/media-chrome,
 * themed via `accentColor` — that's player UI, not a thumbnail affordance.
 *
 * Positioning is the CALLER's job (this renders just the disc) — overlay
 * centering differs per surface.
 */

import React from 'react'
import { PlayIcon } from '../icons-v2-generated/media-playback/play-icon'
import { cn } from '../../utils/cn'

export type VideoCenterBadgeSize = 'sm' | 'md' | 'lg'

const SIZES: Record<VideoCenterBadgeSize, { disc: string; icon: number }> = {
  sm: { disc: 'h-7 w-7', icon: 12 },   // carousel/gallery thumbnails
  md: { disc: 'h-14 w-14', icon: 28 }, // strip cards, hover-preview chips
  lg: { disc: 'h-16 w-16', icon: 32 }, // hero facades (YouTube embeds)
}

/** Disc classes only — for interactive elements (e.g. the unmute <button>)
 *  that need the SAME look on their own element. */
export function videoCenterBadgeClass(size: VideoCenterBadgeSize = 'md', className?: string): string {
  return cn(
    'flex items-center justify-center rounded-full bg-black/60 text-white',
    SIZES[size].disc,
    className,
  )
}

export function videoCenterBadgeIconSize(size: VideoCenterBadgeSize = 'md'): number {
  return SIZES[size].icon
}

export interface VideoPlayBadgeProps {
  size?: VideoCenterBadgeSize
  className?: string
}

/** The play affordance — decorative (pointer-events-none): the host surface
 *  owns activation (hover/tap/click). */
export function VideoPlayBadge({ size = 'md', className }: VideoPlayBadgeProps): React.ReactElement {
  return (
    <div className={videoCenterBadgeClass(size, cn('pointer-events-none', className))}>
      <PlayIcon size={SIZES[size].icon} color="currentColor" />
    </div>
  )
}
