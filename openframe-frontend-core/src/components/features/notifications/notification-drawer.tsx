'use client'

import { useEffect, useRef } from 'react'
import { OverlayScrollArea } from '../../ui/overlay-scroll-area'
import { BellOffIcon } from '../../icons-v2-generated/interface/bell-off-icon'
import { ClockHistoryIcon, ArrowRightUpIcon } from '../../icons-v2-generated'
import { useAppLayoutDrawerContainer } from '../../navigation/app-layout-context'
import { AppLayoutDrawer, AppLayoutDrawerContent } from '../../navigation/app-layout-drawer'
import { SplitButton } from '../../ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '../../ui/drawer'
import { Switch } from '../../ui/switch'
import { cn } from '../../../utils/cn'
import { useNotificationPermission } from '../../../hooks/ui'
import { useOptionalNotifications } from './notifications-context'
import { NotificationTile } from './notification-tile'
import type { Notification, RenderNotificationTile } from './types'


export interface NotificationDrawerProps {
  className?: string
  liveDurationMs?: number
  loadMoreRootMargin?: string
  renderTile?: RenderNotificationTile
}

export function NotificationDrawer({
  className,
  liveDurationMs,
  loadMoreRootMargin = '200px',
  renderTile: renderTileProp,
}: NotificationDrawerProps) {
  const ctx = useOptionalNotifications()
  // Inside AppLayout the drawer renders in-layout (dims and covers only the
  // main content area — header and sidebar stay interactive). Outside of it
  // (Storybook, non-AppLayout hosts) it falls back to the viewport Drawer.
  const layoutContainer = useAppLayoutDrawerContainer()

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
    showDesktopPopups,
    setShowDesktopPopups,
    desktopPopupsConfigured,
    onHistoryClick,
    historyHref,
    hasMore,
    isLoadingMore,
    loadMore,
    renderTile: ctxRenderTile,
  } = ctx

  const renderTile = renderTileProp ?? ctxRenderTile

  const unreadNotifications = notifications.filter((n) => !n.read)

  const content = (
    <>
      <div className="px-[var(--spacing-system-m)] pt-[var(--spacing-system-m)]">
        <DrawerTitle
          hideClose
          className="truncate"
          actions={
            <button
              type="button"
              disabled={unreadCount === 0}
              onClick={markAllRead}
              className="self-center text-h6 text-ods-text-secondary underline transition-colors hover:text-ods-text-primary disabled:opacity-40"
            >
              Mark All Complete
            </button>
          }
        >
          New Notifications
        </DrawerTitle>
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
        renderTile={renderTile}
      />

      <div className="flex flex-col gap-[var(--spacing-system-xs)] px-[var(--spacing-system-m)] pb-[var(--spacing-system-m)]">
        <div className="overflow-hidden rounded-md border border-ods-border bg-ods-card">
          <ShowNotificationsToggleRow checked={showPopups} onChange={setShowPopups} />
          {desktopPopupsConfigured && (
            <DesktopNotificationsToggleRow checked={showDesktopPopups} onChange={setShowDesktopPopups} />
          )}
        </div>
        <NotificationsHistoryButton
          onClick={onHistoryClick ? () => { onHistoryClick(); close() } : undefined}
          historyHref={historyHref}
        />
      </div>
    </>
  )

  if (layoutContainer) {
    return (
      <AppLayoutDrawer open={isOpen} onOpenChange={(v) => (v ? open() : close())}>
        <AppLayoutDrawerContent
          side="right"
          aria-describedby={undefined}
          // md matches the content's default mobileBreakpoint: below it the
          // panel is forced full-bleed (w-full), so the fixed width must not
          // apply there or the panel would detach from the right edge.
          className={cn('md:w-[26rem] gap-[var(--spacing-system-m)] p-[var(--spacing-system-zero)]', className)}
        >
          {content}
        </AppLayoutDrawerContent>
      </AppLayoutDrawer>
    )
  }

  return (
    <Drawer open={isOpen} onOpenChange={(v) => (v ? open() : close())}>
      <DrawerContent
        side="right"
        aria-describedby={undefined}
        offsetHeader
        className={cn(
          'w-[calc(100vw-2rem)] sm:w-[26rem] sm:max-w-[calc(100vw-2rem)] gap-[var(--spacing-system-m)] p-[var(--spacing-system-zero)]',
          className,
        )}
      >
        {content}
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
  renderTile?: RenderNotificationTile
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
  renderTile,
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
    <OverlayScrollArea
      viewportRef={scrollRef}
      // Horizontal padding lives on the host: OverlayScrollbars zeroes viewport
      // padding, so `px-*` on `contentClassName` would be silently dropped.
      className="flex-1 min-h-0 px-[var(--spacing-system-m)]"
      contentClassName="flex flex-col gap-[var(--spacing-system-xs)]"
    >
      {isEmpty && !isLoadingMore ? (
        <EmptyState />
      ) : (
        <>
          {unreadNotifications.map((n) => {
            const custom = renderTile?.(n, { onComplete, onSettle, liveDurationMs })
            if (custom) return <div key={n.id}>{custom}</div>
            return (
              <NotificationTile
                key={n.id}
                notification={n}
                liveDurationMs={liveDurationMs}
                onComplete={onComplete}
                onSettle={onSettle}
              />
            )
          })}
          {isLoadingMore && <DrawerLoadingTiles />}
          {loadMore && hasMore && <div ref={sentinelRef} className="h-1" aria-hidden="true" />}
        </>
      )}
    </OverlayScrollArea>
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
    <div className="flex items-center gap-[var(--spacing-system-s)] border-b border-ods-border p-[var(--spacing-system-sf)]">
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

/** Switching on prompts for browser permission and commits only when granted; denied renders disabled (can't re-prompt programmatically); unsupported (SSR, iOS Safari) hides the row. */
function DesktopNotificationsToggleRow({ checked, onChange }: ToggleRowProps) {
  const { supported, permission, request } = useNotificationPermission()
  if (!supported) return null

  const blocked = permission === 'denied'

  const handleChange = async (value: boolean) => {
    if (!value || permission === 'granted') {
      onChange(value)
      return
    }
    if ((await request()) === 'granted') onChange(true)
  }

  return (
    <div className="flex items-center gap-[var(--spacing-system-s)] border-b border-ods-border p-[var(--spacing-system-sf)]">
      <Switch
        checked={checked && permission === 'granted'}
        disabled={blocked}
        onCheckedChange={handleChange}
        aria-label="Show desktop notifications"
      />
      <div className="min-w-0 flex-1">
        <p className={cn('text-h4', blocked ? 'text-ods-text-secondary' : 'text-ods-text-primary')}>
          Desktop Notifications
        </p>
        <p className="text-h6 text-ods-text-secondary">
          {blocked
            ? 'Enable notifications in your browser settings'
            : 'Notify when this tab is in the background'}
        </p>
      </div>
    </div>
  )
}

interface HistoryButtonProps {
  onClick?: () => void
  historyHref?: string
}

function NotificationsHistoryButton({ onClick, historyHref }: HistoryButtonProps) {
  return (
    <SplitButton
      variant="outline"
      fullWidth
      onClick={onClick}
      mainDisabled={!onClick}
      leftIcon={<ClockHistoryIcon className="text-ods-text-secondary" />}
      groupAriaLabel="Notifications history"
      iconAction={{
        icon: <ArrowRightUpIcon className="text-ods-text-secondary" />,
        'aria-label': 'Open notifications history in a new tab',
        href: historyHref,
        openInNewTab: true,
        disabled: !historyHref,
      }}
    >
      Notifications History
    </SplitButton>
  )
}
