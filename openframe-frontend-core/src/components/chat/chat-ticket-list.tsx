'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade'
import { OverlayScrollArea } from '../ui/overlay-scroll-area'
import { ChatTicketItem, type ChatTicketItemData } from './entity-cards/chat-ticket-item'

export interface ChatTicketListProps extends React.HTMLAttributes<HTMLDivElement> {
  tickets: ChatTicketItemData[]
  onTicketClick?: (ticketId: string) => void
  /** Show skeleton placeholder rows instead of tickets while loading. */
  isLoading?: boolean
  /** Number of skeleton rows rendered while `isLoading`. Defaults to 5. */
  skeletonCount?: number
}

const ChatTicketList = React.forwardRef<HTMLDivElement, ChatTicketListProps>(
  ({ className, tickets, onTicketClick, isLoading = false, skeletonCount = 5, ...props }, ref) => {
    // Shared scroll-shadow tracking (ui/scroll-fade) — re-measures on resize
    // and content changes, so no manual ticket-count effect is needed.
    const { scrollRef, fadeTop, fadeBottom, update: updateFade } = useScrollFade<HTMLDivElement>()

    if (isLoading) {
      return (
        <div ref={ref} className={cn("flex flex-col gap-2 min-h-0", className)} {...props}>
          <p className="text-h5 text-ods-text-secondary shrink-0">Your Chats:</p>
          <div className="border border-ods-border rounded-md flex-1 min-h-0 overflow-hidden">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <ChatTicketItem key={i} isLoading />
            ))}
          </div>
        </div>
      )
    }

    if (tickets.length === 0) return null

    return (
      <div ref={ref} className={cn("flex flex-col gap-2 min-h-0", className)} {...props}>
        <p className="text-h5 text-ods-text-secondary shrink-0">Your Chats:</p>
        <div
          className={cn(
            "relative border-x border-ods-border flex-1 min-h-0 overflow-hidden",
            !fadeTop && "border-t rounded-t-md",
            !fadeBottom && "border-b rounded-b-md",
          )}
        >
          <OverlayScrollArea viewportRef={scrollRef} className="h-full" onScroll={updateFade}>
            {tickets.map((ticket) => (
              <ChatTicketItem
                key={ticket.id}
                ticket={ticket}
                onClick={onTicketClick}
              />
            ))}
          </OverlayScrollArea>

          {/* Scroll-fade overlays — tinted with the page background so edge
              tickets fade into the surface behind the list in BOTH themes
              (`--color-bg` flips with `data-theme`). Shared ui/scroll-fade. */}
          <ScrollFadeOverlay edge="top" visible={fadeTop} />
          <ScrollFadeOverlay edge="bottom" visible={fadeBottom} />
        </div>
      </div>
    )
  },
)

ChatTicketList.displayName = 'ChatTicketList'

export { ChatTicketList }
export type { ChatTicketItemData }
