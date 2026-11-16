'use client';

import type React from 'react';

export interface BlockCardProps {
  /** A compact form of the same record, for a surface that shows one. The message draws only `children`. */
  inline?: React.ReactNode;
  /** The block-level content: `<div>`, `<header>`, `<EntityVideoSection>`, `<Video>`, etc. `chat-message-enhanced`
   *  draws it where the message's `data-record-cards` part sits, where block content is HTML-valid. */
  children: React.ReactNode;
}

/**
 * Sentinel wrapper for `renderEntityCard` returns whose payload is block-level (divs / header / `<EntityVideoSection>` /
 * `<Video>`). The chat renderer (`chat-message-enhanced.tsx`) detects `<BlockCard>` by React element type identity and
 * draws its `children`.
 *
 * The component itself never renders: it's a tag, not a wrapper. The `return null` is unreachable in practice, but kept
 * as a defensive no-op so a mis-routed `<BlockCard>` outside the chat path doesn't crash.
 */
export function BlockCard(_props: BlockCardProps): React.ReactElement | null {
  return null;
}
