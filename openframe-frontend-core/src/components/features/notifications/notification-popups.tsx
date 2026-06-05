'use client'

import type { KeyboardEvent, MouseEvent } from 'react'
import { cn } from '../../../utils/cn'
import type { RenderNotificationTile } from './types'
import { useOptionalNotifications } from './notifications-context'
import { NotificationTile } from './notification-tile'
import type { Notification } from './types'

export type NotificationPopupsPosition =
  | 'top-right'
  | 'top-left'
  | 'bottom-right'
  | 'bottom-left'

export interface NotificationPopupsProps {
  className?: string
  liveDurationMs?: number
  maxVisible?: number
  position?: NotificationPopupsPosition
  hideWhenDrawerOpen?: boolean
  renderTile?: RenderNotificationTile
}

const positionClasses: Record<NotificationPopupsPosition, string> = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4 flex-col-reverse',
  'bottom-left': 'bottom-4 left-4 flex-col-reverse',
}

export function NotificationPopups({
  className,
  liveDurationMs = 4000,
  maxVisible = 4,
  position = 'top-right',
  hideWhenDrawerOpen = true,
  renderTile: renderTileProp,
}: NotificationPopupsProps) {
  const ctx = useOptionalNotifications()
  if (!ctx) return null

  const { notifications, showPopups, isOpen, open, markRead, markSettled, renderTile: ctxRenderTile } = ctx
  const renderTile = renderTileProp ?? ctxRenderTile

  if (!showPopups) return null
  if (hideWhenDrawerOpen && isOpen) return null

  const now = Date.now()
  const live = notifications
    .filter((n) => !n.read && !n.settled && now - n.createdAt < liveDurationMs)
    .slice(0, maxVisible)

  if (live.length === 0) return null

  const activate = (notification: Notification) => {
    if (notification.onClick) {
      notification.onClick()
      markRead(notification.id)
      markSettled(notification.id)
      return
    }
    open()
    markSettled(notification.id)
  }

  const handleBodyClick = (notification: Notification) => (event: MouseEvent<HTMLDivElement>) => {
    // Nested interactive controls (X, check button) handle their own actions.
    if ((event.target as HTMLElement).closest('button')) return
    activate(notification)
  }

  const handleBodyKeyDown = (notification: Notification) => (event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    activate(notification)
  }

  return (
    <div
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed z-[9999] flex w-[26rem] max-w-[calc(100vw-2rem)] flex-col gap-[var(--spacing-system-xs)]',
        positionClasses[position],
        className,
      )}
    >
      {live.map((n) => {
        const custom = renderTile?.(n, { onComplete: markRead, onSettle: markSettled, liveDurationMs })
        if (custom) {
          return (
            <div key={n.id} className="pointer-events-auto">
              {custom}
            </div>
          )
        }
        return (
          // biome-ignore lint/a11y/useSemanticElements: nested interactive elements forbid <button>
          <div
            key={n.id}
            role="button"
            tabIndex={0}
            onClick={handleBodyClick(n)}
            onKeyDown={handleBodyKeyDown(n)}
            className="pointer-events-auto cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
          >
            <NotificationTile
              notification={n}
              liveDurationMs={liveDurationMs}
              onComplete={markRead}
              onSettle={markSettled}
            />
          </div>
        )
      })}
    </div>
  )
}
