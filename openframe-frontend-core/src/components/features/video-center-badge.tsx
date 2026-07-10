'use client'

/**
 * THE center media glyphs — the single visual identity for every play/unmute
 * affordance over video, across the whole project: a SOLID WHITE GLYPH
 * (`text-ods-text-primary`), NO background disc, with a soft drop-shadow for
 * legibility over arbitrary frames. Accent color appears ONLY while the
 * icon's own control is hovered (hosts pass `group-hover:text-ods-accent`;
 * mux-player controls get the same via `::part(button):hover` in
 * styles/app-globals.css).
 *
 * Glyphs come from THE icon system (icons-v2-generated) — never inline SVG
 * paths here: PlayIcon (media-playback) and VolumeOffIcon (audio-and-visual).
 *
 * Consumers:
 *   - <VideoBiteCard> resting/paused posters (md)
 *   - <YouTubeFacade> poster (lg)
 *   - <MediaCarousel> video thumbnails (sm)
 *   - <FilePlayer>'s unmute chip (VideoUnmuteGlyph, md)
 *   - MuxPlayer's native center pre-play button is stripped to the same bare
 *     glyph language via CSS (see styles/app-globals.css).
 */

import React from 'react'
import { PlayIcon } from '../icons-v2-generated/media-playback/play-icon'
import { VolumeOffIcon } from '../icons-v2-generated/audio-and-visual/volume-off-icon'
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

/** Bare play glyph (the icon system's PlayIcon). Decorative
 *  (`pointer-events-none`) — the host surface owns activation. */
export function VideoPlayBadge({ size = 'md', className }: VideoPlayBadgeProps): React.ReactElement {
  return (
    <div
      className={cn('pointer-events-none flex items-center justify-center text-ods-text-primary transition-colors', className)}
      style={{ filter: GLYPH_SHADOW }}
    >
      <PlayIcon size={SIZES[size]} color="currentColor" />
    </div>
  )
}

export interface VideoUnmuteGlyphProps {
  size?: VideoCenterBadgeSize
  className?: string
}

/** Bare muted-volume glyph (the icon system's VolumeOffIcon). Rendered by
 *  FilePlayer's unmute button; exported here so play + unmute share one
 *  identity. */
export function VideoUnmuteGlyph({ size = 'md', className }: VideoUnmuteGlyphProps): React.ReactElement {
  return (
    <VolumeOffIcon
      size={SIZES[size]}
      color="currentColor"
      className={className}
      style={{ filter: GLYPH_SHADOW }}
    />
  )
}
