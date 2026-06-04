/**
 * Shared Storybook decorator + helpers for chat entity-card stories.
 *
 * Chat entity-cards are designed to render inside the assistant's message
 * column — a narrow, padded column over the chat background. This decorator
 * reproduces that context so the cards lay out at their real width in
 * isolation, without booting the chat runtime.
 *
 * `makeAnchorProps` builds the `{ href, onClick }` pair the cards expect for
 * their inner `<a>`. In Storybook there is no router, so the click is
 * neutralized with `preventDefault` to keep navigation from escaping the
 * iframe while still exercising the anchor markup (hover, copy-link, etc.).
 */

import type React from 'react'

/**
 * Wraps a story in a chat-message-column-like container: constrained width,
 * chat background, ODS padding. Matches the column the dispatch pipeline
 * renders entity-cards into.
 */
export function ChatColumnDecorator({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-ods-bg p-6">
      <div className="mx-auto w-full max-w-[420px]">{children}</div>
    </div>
  )
}

/**
 * Anchor-prop pair for a card's inner `<a>`. Shape matches the per-card
 * `*AnchorProps` interfaces (`{ href, target?, rel?, onClick? }`). The
 * `onClick` prevents default so Storybook doesn't navigate away from the
 * iframe when the card is clicked.
 */
export function makeAnchorProps(href: string): {
  href: string
  onClick: (e: React.MouseEvent<HTMLAnchorElement>) => void
} {
  return {
    href,
    onClick: (e) => e.preventDefault(),
  }
}
