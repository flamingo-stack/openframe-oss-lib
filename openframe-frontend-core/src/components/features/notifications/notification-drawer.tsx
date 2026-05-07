'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { BellOffIcon } from '../../icons-v2-generated/interface/bell-off-icon'
import { ClockHistoryIcon } from '../../icons-v2-generated/date-and-time/clock-history-icon'
import { Button } from '../../ui/button/button'
import { Drawer, DrawerContent } from '../../ui/drawer'
import { Switch } from '../../ui/switch'
import { cn } from '../../../utils/cn'
import { useOptionalNotifications } from './notifications-context'
import { NotificationTile } from './notification-tile'

export interface NotificationDrawerProps {
  className?: string
  liveDurationMs?: number
}

export function NotificationDrawer({ className, liveDurationMs }: NotificationDrawerProps) {
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

        <div className="flex flex-1 flex-col gap-[var(--spacing-system-xs)] overflow-y-auto px-[var(--spacing-system-m)]">
          {unreadNotifications.length === 0 ? (
            <EmptyState />
          ) : (
            unreadNotifications.map((n) => (
              <NotificationTile
                key={n.id}
                notification={n}
                liveDurationMs={liveDurationMs}
                onComplete={markRead}
                onSettle={markSettled}
              />
            ))
          )}
        </div>

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
