"use client"

import React from 'react'

export interface BlockCardProps {
  /** The inline pill rendered AT the marker position inside the
   *  paragraph. Typically the existing compact entity card (e.g. the
   *  56×56 thumbnail card for webinars / customer interviews). When
   *  omitted, the marker is replaced by the ref title in a plain
   *  inline `<span>`. */
  inline?: React.ReactNode
  /** The block-level content rendered as a SIBLING below the markdown
   *  paragraph. Use for elements that cannot legally nest inside
   *  `<p>` — `<div>`, `<header>`, `<EntityVideoSection>`, `<Video>`,
   *  etc. The pre-scan in `chat-message-enhanced` extracts this and
   *  appends it after the `<SimpleMarkdownRenderer>` output for the
   *  containing segment, where block content is HTML-valid. */
  children: React.ReactNode
}

/**
 * Sentinel wrapper for `renderEntityCard` returns whose payload is
 * block-level (divs / header / `<EntityVideoSection>` / `<Video>`) and
 * therefore cannot legally render inside the assistant message's
 * markdown paragraph.
 *
 * The chat renderer (`chat-message-enhanced.tsx`) does a pre-scan of
 * each `text` segment's `[card://type:id]` markers, calls
 * `renderEntityCard(ref)` for each, and detects `<BlockCard>` by React
 * element type identity. When detected:
 *   1. `inline` is placed AT the marker position inside the `<p>` —
 *      keeps the existing compact-card UX intact.
 *   2. `children` is appended as a sibling BELOW the paragraph — where
 *      block content is HTML-valid and the browser doesn't eject it
 *      with a hydration mismatch.
 *
 * The component itself never renders — it's a tag, not a wrapper. The
 * `return null` is unreachable in practice (the pre-scan replaces every
 * `<BlockCard>` before render), but kept as a defensive no-op so a
 * mis-routed `<BlockCard>` outside the chat path doesn't crash.
 */
export function BlockCard(_props: BlockCardProps): React.ReactElement | null {
  return null
}
