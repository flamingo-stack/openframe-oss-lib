'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { ChatTicketItem, type ChatTicketItemData } from './entity-cards/chat-ticket-item'

export interface ChatTicketListProps extends React.HTMLAttributes<HTMLDivElement> {
  tickets: ChatTicketItemData[]
  onTicketClick?: (ticketId: string) => void
  /** Show skeleton placeholder rows instead of tickets while loading. */
  isLoading?: boolean
  /** Number of skeleton rows rendered while `isLoading`. Defaults to 5. */
  skeletonCount?: number
}

function getMask(top: boolean, bottom: boolean) {
  if (top && bottom) return 'linear-gradient(to bottom, transparent, black 64px, black calc(100% - 64px), transparent)'
  if (top) return 'linear-gradient(to bottom, transparent, black 64px)'
  if (bottom) return 'linear-gradient(to bottom, black calc(100% - 64px), transparent)'
  return 'none'
}

const ChatTicketList = React.forwardRef<HTMLDivElement, ChatTicketListProps>(
  ({ className, tickets, onTicketClick, isLoading = false, skeletonCount = 5, ...props }, ref) => {
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const [fadeTop, setFadeTop] = React.useState(false)
    const [fadeBottom, setFadeBottom] = React.useState(false)

    const updateFade = React.useCallback(() => {
      const el = scrollRef.current
      if (!el) return
      setFadeTop(el.scrollTop > 0)
      setFadeBottom(el.scrollHeight - el.scrollTop - el.clientHeight > 1)
    }, [])

    const ticketCount = tickets.length
    React.useLayoutEffect(() => {
      updateFade()
    }, [ticketCount, updateFade])

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

    const mask = getMask(fadeTop, fadeBottom)

    return (
      <div ref={ref} className={cn("flex flex-col gap-2 min-h-0", className)} {...props}>
        <p className="text-h5 text-ods-text-secondary shrink-0">Your Chats:</p>
        <div
          className={cn(
            "border-x border-ods-border flex-1 min-h-0 overflow-hidden",
            !fadeTop && "border-t rounded-t-md",
            !fadeBottom && "border-b rounded-b-md",
          )}
        >
          <div
            ref={scrollRef}
            className="overflow-y-auto h-full"
            onScroll={updateFade}
            style={mask !== 'none' ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
          >
            {tickets.map((ticket) => (
              <ChatTicketItem
                key={ticket.id}
                ticket={ticket}
                onClick={onTicketClick}
              />
            ))}
          </div>
        </div>
      </div>
    )
  },
)

ChatTicketList.displayName = 'ChatTicketList'

export { ChatTicketList }
export type { ChatTicketItemData }
