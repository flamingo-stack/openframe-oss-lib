'use client'

/**
 * THE center media glyphs — the single visual identity for every play/unmute
 * affordance over video, across the whole project: a SOLID WHITE GLYPH
 * (`text-ods-text-primary`), NO background disc, with a soft drop-shadow for
 * legibility over arbitrary frames.
 *
 * Consumers:
 *   - <VideoBiteCard> resting/paused posters (md)
 *   - <YouTubeFacade> poster (lg)
 *   - <MediaCarousel> video thumbnails (sm)
 *   - <FilePlayer>'s unmute chip (VideoUnmuteGlyph, md)
 *   - MuxPlayer's native center pre-play button is stripped to the same bare
 *     white glyph via CSS (`mux-player::part(center play button)` in
 *     styles/app-globals.css) so full players match too.
 *
 * Glyph paths are media-chrome's own (filled triangle / filled volume-off) so
 * the replica and the real player chrome stay pixel-consistent.
 */

import React from 'react'
import { cn } from '../../utils/cn'

export type VideoCenterBadgeSize = 'sm' | 'md' | 'lg'

const SIZES: Record<VideoCenterBadgeSize, number> = {
  sm: 20, // gallery thumbnails
  md: 56, // strip cards + unmute chip
  lg: 64, // hero facades
}

/** Soft legibility shadow — NOT a background (per design: bare glyphs). */
const GLYPH_SHADOW = 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))'

export interface VideoPlayBadgeProps {
  size?: VideoCenterBadgeSize
  className?: string
}

/** Bare white play glyph (media-chrome's filled triangle). Decorative
 *  (`pointer-events-none`) — the host surface owns activation. */
export function VideoPlayBadge({ size = 'md', className }: VideoPlayBadgeProps): React.ReactElement {
  return (
    <div
      className={cn('pointer-events-none flex items-center justify-center text-ods-text-primary', className)}
      style={{ filter: GLYPH_SHADOW }}
    >
      <svg aria-hidden viewBox="0 0 24 24" fill="currentColor" style={{ width: SIZES[size], height: SIZES[size] }}>
        <path d="m6 21 15-9L6 3v18Z" />
      </svg>
    </div>
  )
}

export interface VideoUnmuteGlyphProps {
  size?: VideoCenterBadgeSize
  className?: string
}

/** Bare white muted-volume glyph (filled, material volume_off — the same
 *  family as media-chrome's mute icon). Rendered by FilePlayer's unmute
 *  button; exported here so play + unmute share one identity. */
export function VideoUnmuteGlyph({ size = 'md', className }: VideoUnmuteGlyphProps): React.ReactElement {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={{ width: SIZES[size], height: SIZES[size], filter: GLYPH_SHADOW }}
    >
      <path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63Zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z" />
    </svg>
  )
}
