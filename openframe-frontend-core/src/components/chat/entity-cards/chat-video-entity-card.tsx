"use client"

import React from 'react'
import { EntityVideoSection } from '../../features/entity-video-section'
import type { ChatRef } from '../chat-ref.types'

/**
 * <ChatVideoEntityCard> — chat-side inline render for video-bearing
 * entity refs. Reuses `<EntityVideoSection>` (the SAME component the
 * detail pages use for customer interviews, investor updates, product
 * releases, and case studies) so the chat surface matches the public
 * pages 1:1: Full Video / Highlights tabs, YouTube facade vs Mux HLS
 * routing, native fullscreen, captions, posters.
 *
 * Stripped-chrome rendering: just the player + tabs, no title, no
 * date, no Ask button. The inline pill at the marker position (in the
 * paragraph above) already shows the title, date, and Ask affordance
 * via the host's existing compact entity card. Duplicating those
 * here doubles the UX and steals vertical space inside the chat
 * panel. v6.1 §B.2.7.
 *
 * Activation contract: the host's dispatch routes here only when
 * `chatRef.metadata.videoUrl`, `youtubeUrl`, or `highlightVideoUrl`
 * is a non-empty string. URL safety is handled inside `<Video>` (the
 * single source of truth for player URL routing) — no duplicate
 * sanitization at the card level.
 */
export interface ChatVideoEntityCardProps {
  /** Required. `metadata.videoUrl` / `youtubeUrl` / `highlightVideoUrl`
   *  control routing inside `<EntityVideoSection>`. */
  chatRef: ChatRef
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function ChatVideoEntityCard({
  chatRef,
}: ChatVideoEntityCardProps): React.ReactElement {
  const m = chatRef.metadata ?? {}
  const videoUrl = readString(m.videoUrl)
  const youtubeUrl = readString(m.youtubeUrl)
  const poster = readString(m.videoPoster)
  const highlightUrl = readString(m.highlightVideoUrl)
  const highlightPoster = readString(m.highlightVideoPoster)

  // No wrapping Card / header — the player is the whole card. The
  // 16:9 aspect / rounded-corners / border come from <Video>'s own
  // `layout="centered"` styling inside <EntityVideoSection>.
  return (
    <EntityVideoSection
      mainVideoUrl={videoUrl}
      youtubeUrl={youtubeUrl}
      highlightVideoUrl={highlightUrl}
      highlightVideoThumbnail={highlightPoster}
      mainVideoPoster={poster}
      title={chatRef.title}
      // Intentionally omitted for chat density:
      //   videoSummary    — assistant text above already covers it.
      //   MarkdownRenderer — unused when videoSummary is omitted.
      //   videoBites      — separate ask; chat doesn't surface bites
      //                     today (planned follow-up).
    />
  )
}
