'use client';

import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../utils/cn';
import { ScrollFadeOverlay, useScrollFade } from '../ui/scroll-fade';
import { ChatTicketItem, type ChatTicketItemData } from './entity-cards/chat-ticket-item';

export interface ChatTicketListProps extends HTMLAttributes<HTMLDivElement> {
  tickets: ChatTicketItemData[];
  onTicketClick?: (ticketId: string) => void;
  /** Show skeleton placeholder rows instead of tickets while loading. */
  isLoading?: boolean;
  /** Number of skeleton rows rendered while `isLoading`. Defaults to 5. */
  skeletonCount?: number;
}

const ChatTicketList = forwardRef<HTMLDivElement, ChatTicketListProps>(
  ({ className, tickets, onTicketClick, isLoading = false, skeletonCount = 5, ...props }, ref) => {
    // Shared scroll-shadow tracking (ui/scroll-fade) — re-measures on resize
    // and content changes, so no manual ticket-count effect is needed.
    const { scrollRef, fadeTop, fadeBottom, update: updateFade } = useScrollFade<HTMLDivElement>();

    if (isLoading) {
      return (
        <div ref={ref} className={cn('flex min-h-0 flex-col gap-2', className)} {...props}>
          <p className="shrink-0 text-ods-text-secondary text-h5">Your Chats:</p>
          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-ods-border">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <ChatTicketItem key={i} isLoading />
            ))}
          </div>
        </div>
      );
    }

    if (tickets.length === 0) return null;

    return (
      <div ref={ref} className={cn('flex min-h-0 flex-col gap-2', className)} {...props}>
        <p className="shrink-0 text-ods-text-secondary text-h5">Your Chats:</p>
        <div
          className={cn(
            'relative min-h-0 flex-1 overflow-hidden border-x border-ods-border',
            !fadeTop && 'rounded-t-md border-t',
            !fadeBottom && 'rounded-b-md border-b',
          )}
        >
          <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain" onScroll={updateFade}>
            {tickets.map(ticket => (
              <ChatTicketItem key={ticket.id} ticket={ticket} onClick={onTicketClick} />
            ))}
          </div>

          {/* Scroll-fade overlays — tinted with the page background so edge
              tickets fade into the surface behind the list in BOTH themes
              (`--color-bg` flips with `data-theme`). Shared ui/scroll-fade. */}
          <ScrollFadeOverlay edge="top" visible={fadeTop} />
          <ScrollFadeOverlay edge="bottom" visible={fadeBottom} />
        </div>
      </div>
    );
  },
);

ChatTicketList.displayName = 'ChatTicketList';

export { ChatTicketList };
export type { ChatTicketItemData };
