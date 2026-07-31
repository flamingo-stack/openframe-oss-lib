'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'

export interface ChatListEmptyStateProps {
  /** Centred 24px glyph — rendered muted (`ods-text-secondary`). Pass the icon
   *  already sized (e.g. `<ChatsIcon size={24} />`). */
  icon: React.ReactNode
  /** Title line (`h4`). */
  title: React.ReactNode
  /** Caption line under the title (`h6`). Omitted → title alone. */
  description?: React.ReactNode
  /** Appended to the root element. */
  className?: string
}

/**
 * Shared empty state for the chat-list surfaces — the "Current Chats" rail and
 * the Chat Archive page (Figma node 113:60939). A centred 24px muted glyph over
 * a title (`h4`) + caption (`h6`), both in `ods-text-secondary`. Kept in one
 * place so the two lists can't drift apart.
 */
export function ChatListEmptyState({
  icon,
  title,
  description,
  className,
}: ChatListEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 min-h-0 flex-col items-center justify-center gap-[var(--spacing-system-l)] p-[var(--spacing-system-l)] text-center text-ods-text-secondary',
        className,
      )}
    >
      <span className="flex size-6 shrink-0 items-center justify-center">{icon}</span>
      <div className="flex flex-col">
        <p className="text-h4">{title}</p>
        {description && <p className="text-h6">{description}</p>}
      </div>
    </div>
  )
}
