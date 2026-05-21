'use client'

import { useMemo, useEffect} from 'react'
import { CheckCircleIcon } from '../../icons-v2-generated/signs-and-symbols/check-circle-icon'
import { XmarkIcon } from '../../icons-v2-generated/signs-and-symbols/xmark-icon'
import { Button } from '../../ui/button/button'
import { dotColorByVariant, progressColorByVariant } from '../../ui/toaster'
import { cn } from '../../../utils/cn'
import type { Notification } from './types'

export interface NotificationTileProps {
  notification: Notification
  liveDurationMs?: number
  onComplete: (id: string) => void
  onSettle?: (id: string) => void
  className?: string
}

export function NotificationTile({
  notification,
  liveDurationMs = 4000,
  onComplete,
  onSettle,
  className,
}: NotificationTileProps) {
  const { id, variant = 'default', title, description, createdAt, read, settled } = notification

  const initialElapsed = useMemo(() => Date.now() - createdAt, [createdAt])
  const isLive = !read && !settled && initialElapsed < liveDurationMs

  useEffect(() => {
    if (!isLive) return
    const remaining = Math.max(0, liveDurationMs - initialElapsed)
    const timer = window.setTimeout(() => {
      onSettle?.(id)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [id, isLive, initialElapsed, liveDurationMs, onSettle])

  return (
    <output
      className={cn(
        'relative block w-full shrink-0 overflow-hidden rounded-md border border-ods-border bg-ods-card',
        className,
      )}
    >
      <div className="flex items-center gap-[var(--spacing-system-xs)] p-[var(--spacing-system-s)]">
        <div className="flex size-6 shrink-0 items-center justify-center">
          <span className={cn('size-1.5 rounded-full', dotColorByVariant[variant])} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          {title ? <p className="truncate text-h4 text-ods-text-primary" title={typeof title === 'string' ? title : undefined}>{title}</p> : null}
          {description ? (
            <p className="text-h6 line-clamp-2 text-ods-text-secondary" title={typeof description === 'string' ? description : undefined}>{description}</p>
          ) : null}
        </div>

        {/* Settled action. */}
        <Button
          variant="outline"
          size="small"
          onClick={() => onComplete(id)}
          aria-label="Mark notification complete"
          tabIndex={isLive ? -1 : 0}
          className={cn(
            'shrink-0 text-ods-text-secondary hover:text-ods-text-primary',
            isLive && 'invisible',
          )}
        >
          <CheckCircleIcon />
        </Button>
      </div>

      {/* Live-only bare X overlay */}
      <button
        type="button"
        onClick={() => onSettle?.(id)}
        aria-label="Dismiss notification"
        tabIndex={isLive ? 0 : -1}
        className={cn(
          'absolute right-[var(--spacing-system-xsf)] top-[var(--spacing-system-xsf)] flex size-4 items-center justify-center text-ods-text-secondary transition-opacity duration-200 hover:text-ods-text-primary',
          !isLive && 'pointer-events-none opacity-0',
        )}
      >
        <XmarkIcon size={16} />
      </button>

      {isLive ? (
        <div
          aria-hidden
          className={cn(
            'absolute inset-x-0 -bottom-px h-1 origin-left',
            progressColorByVariant[variant],
          )}
          style={{
            animation: `toast-progress ${liveDurationMs}ms linear forwards`,
            animationDelay: `-${initialElapsed}ms`,
          }}
        />
      ) : null}
    </output>
  )
}
