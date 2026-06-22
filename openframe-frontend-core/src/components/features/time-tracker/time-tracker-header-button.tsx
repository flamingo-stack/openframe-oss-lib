'use client'

import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cn } from '../../../utils/cn'
import { ClockHistoryIcon } from '../../icons-v2-generated/date-and-time/clock-history-icon'
import { HeaderButton } from '../../navigation/header-button'
import { TimeTrackerPanel } from './time-tracker-panel'
import { useOptionalTimeTracker } from './time-tracker-context'
import { useTrackerClock } from './use-tracker-clock'

export interface TimeTrackerHeaderButtonProps {
  /** Dimming/disabled passthrough from the header. */
  className?: string
  disabled?: boolean
}

/**
 * Header affordance for the time tracker. Renders nothing unless wrapped in a
 * `<TimeTrackerProvider>`. The trigger is the standard `HeaderButton`; when a
 * session is active it also shows the live elapsed time. The popup is a Radix
 * Popover anchored under the button (not a modal/drawer).
 */
export function TimeTrackerHeaderButton({ className, disabled }: TimeTrackerHeaderButtonProps) {
  const ctx = useOptionalTimeTracker()
  const elapsedLabel = useTrackerClock({
    status: ctx?.status ?? 'ready',
    runningSince: ctx?.runningSince,
    accumulatedMs: ctx?.accumulatedMs,
  })

  if (!ctx) return null

  const { isOpen, open, close, status } = ctx
  const isPaused = status === 'paused'
  const isActive = status === 'tracking' || isPaused

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={(next) => (next ? open() : close())}>
      <PopoverPrimitive.Trigger asChild>
        <HeaderButton
          aria-label="Time tracker"
          isActive={isOpen}
          disabled={disabled}
          className={cn(
            isActive && 'w-auto gap-[var(--spacing-system-xsf)] px-[var(--spacing-system-sf)] md:w-auto',
            className,
          )}
          icon={
            <>
              <ClockHistoryIcon
                className={cn(
                  'h-4 w-4 md:h-6 md:w-6',
                  isPaused ? 'text-ods-text-secondary' : isActive && 'text-ods-accent',
                )}
              />
              {isActive && (
                <span
                  className={cn(
                    'text-h5 tabular-nums md:text-h4',
                    isPaused ? 'text-ods-text-secondary' : 'text-ods-text-primary',
                  )}
                >
                  {elapsedLabel}
                </span>
              )}
            </>
          }
        />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'z-[1300] w-[460px] max-w-[calc(100vw-1rem)] outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <TimeTrackerPanel {...ctx} onClose={close} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
