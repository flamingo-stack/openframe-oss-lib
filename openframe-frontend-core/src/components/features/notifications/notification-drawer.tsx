'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useEffect, useRef } from 'react'
import { BellOffIcon } from '../../icons-v2-generated/interface/bell-off-icon'
import { ClockHistoryIcon } from '../../icons-v2-generated/date-and-time/clock-history-icon'
import { Button } from '../../ui/button/button'
import { Drawer, DrawerContent } from '../../ui/drawer'
import { Switch } from '../../ui/switch'
import { cn } from '../../../utils/cn'
import { useOptionalNotifications } from './notifications-context'
import { NotificationTile } from './notification-tile'
import type { Notification } from './types'

export interface NotificationDrawerProps {
  className?: string
  liveDurationMs?: number
  loadMoreRootMargin?: string
}

export function NotificationDrawer({ className, liveDurationMs, loadMoreRootMargin = '200px' }: NotificationDrawerProps) {
  const ctx = useOptionalNotifications()
  if (!ctx) return null

  const {
    notifications,
    unreadCount,
    isOpen,
    showPopups,
    open,
    close,
    markRead,
    markAllRead,
    markSettled,
    setShowPopups,
    onHistoryClick,
    hasMore,
    isLoadingMore,
    loadMore,
  } = ctx

  const unreadNotifications = notifications.filter((n) => !n.read)

  return (
    <Drawer open={isOpen} onOpenChange={(v) => (v ? open() : close())}>
      <DrawerContent
        side="right"
        aria-describedby={undefined}
        className={cn(
          'w-[calc(100vw-2rem)] sm:w-[26rem] sm:max-w-[calc(100vw-2rem)] gap-[var(--spacing-system-m)] p-[var(--spacing-system-zero)]',
          className,
        )}
      >
        <div className="flex items-baseline justify-between gap-[var(--spacing-system-m)] px-[var(--spacing-system-m)] pt-[var(--spacing-system-m)]">
          <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-h3 text-ods-text-primary">
            New Notifications
          </DialogPrimitive.Title>
          <button
            type="button"
            disabled={unreadCount === 0}
            onClick={markAllRead}
            className="text-h6 text-ods-text-secondary underline transition-colors hover:text-ods-text-primary disabled:opacity-40"
          >
            Complete All
          </button>
        </div>

        <DrawerScrollList
          unreadNotifications={unreadNotifications}
          liveDurationMs={liveDurationMs}
          onComplete={markRead}
          onSettle={markSettled}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          loadMore={loadMore}
          loadMoreRootMargin={loadMoreRootMargin}
        />

        <div className="flex flex-col gap-[var(--spacing-system-xs)] px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)]">
          <ShowNotificationsToggleRow checked={showPopups} onChange={setShowPopups} />
          <NotificationsHistoryButton
            onClick={onHistoryClick ? () => { onHistoryClick(); close() } : undefined}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

interface DrawerScrollListProps {
  unreadNotifications: Notification[]
  liveDurationMs?: number
  onComplete: (id: string) => void
  onSettle: (id: string) => void
  hasMore: boolean
  isLoadingMore: boolean
  loadMore?: () => void
  loadMoreRootMargin: string
}

function DrawerScrollList({
  unreadNotifications,
  liveDurationMs,
  onComplete,
  onSettle,
  hasMore,
  isLoadingMore,
  loadMore,
  loadMoreRootMargin,
}: DrawerScrollListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadMoreRef = useRef(loadMore)
  loadMoreRef.current = loadMore

  useEffect(() => {
    if (!loadMore || !hasMore || isLoadingMore) return
    const sentinel = sentinelRef.current
    const root = scrollRef.current
    if (!sentinel || !root) return
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) loadMoreRef.current?.()
      },
      { root, rootMargin: loadMoreRootMargin },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore, loadMoreRootMargin])

  const isEmpty = unreadNotifications.length === 0
  return (
    <div
      ref={scrollRef}
      className="flex flex-1 flex-col gap-[var(--spacing-system-xs)] overflow-y-auto px-[var(--spacing-system-m)]"
    >
      {isEmpty && !isLoadingMore ? (
        <EmptyState />
      ) : (
        <>
          {unreadNotifications.map((n) => (
            <NotificationTile
              key={n.id}
              notification={n}
              liveDurationMs={liveDurationMs}
              onComplete={onComplete}
              onSettle={onSettle}
            />
          ))}
          {isLoadingMore && <DrawerLoadingTiles />}
          {loadMore && hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
        </>
      )}
    </div>
  )
}

function DrawerLoadingTiles() {
  return (
    <>
      <div
        aria-hidden="true"
        className="h-16 w-full shrink-0 animate-pulse rounded-md border border-ods-border bg-ods-card"
      />
      <div
        aria-hidden="true"
        className="h-16 w-full shrink-0 animate-pulse rounded-md border border-ods-border bg-ods-card"
      />
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[var(--spacing-system-xs)] py-[var(--spacing-system-l)]">
      <BellOffIcon size={24} className="text-ods-text-secondary" />
      <p className="text-h6 text-ods-text-secondary">No new notifications</p>
    </div>
  )
}

interface ToggleRowProps {
  checked: boolean
  onChange: (value: boolean) => void
}

function ShowNotificationsToggleRow({ checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)]">
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        aria-label="Show pop-up notifications"
      />
      <div className="min-w-0 flex-1">
        <p className="text-h4 text-ods-text-primary">Show Notifications</p>
        <p className="text-h6 text-ods-text-secondary">Show pop-up messages for new alerts</p>
      </div>
    </div>
  )
}

interface HistoryButtonProps {
  onClick?: () => void
}

function NotificationsHistoryButton({ onClick }: HistoryButtonProps) {
  return (
    <Button
      variant="outline"
      fullWidth
      disabled={!onClick}
      onClick={onClick}
      leftIcon={<ClockHistoryIcon className="!size-6 text-ods-text-secondary" />}
    >
      Notifications History
    </Button>
  )
}
