'use client'

import { useMemo } from 'react'
import { Calendar } from '../calendar'
import { Button, Skeleton } from '../ui'
import { cn } from '../../utils/cn'
import { MAX_MONTH_OFFSET } from '../../utils/hubspot-meetings-convention'

/**
 * SlotPicker — day layer + time-chip grid for the meeting scheduler.
 *
 * Day layer is the lib's ODS-styled `Calendar` (react-day-picker v9
 * wrapper) — NOT a bespoke day grid. `startMonth`/`endMonth` pin navigation
 * to [current month, current + MAX_MONTH_OFFSET] so the past is unreachable;
 * days without bookable slots are disabled (visually muted via the v9
 * `disabled` classNames). Month navigation drives the host-proxy
 * `monthOffset`. Time chips are plain `Button`s whose variant flips on
 * selection — no bespoke pill.
 *
 * `isLoading` (month change → availability refetch) renders the LAZY state:
 * the calendar dims and ignores input, the times column shows skeleton chips
 * — content never vanishes, the card never changes height.
 *
 * All slot instants are epoch-ms; every label is rendered in `timezone`
 * (resolved by the parent AFTER mount — this component never reads Intl
 * itself, keeping SSR output deterministic).
 */

export interface SlotPickerProps {
  /** Bookable slot start times (epoch ms) for the selected duration. */
  slots: number[]
  /** IANA zone every label renders in (parent resolves post-mount). */
  timezone: string
  monthOffset: number
  onMonthOffsetChange: (offset: number) => void
  selectedSlot: number | null
  onSelectSlot: (startMs: number) => void
  selectedDay: string | null
  onSelectDay: (dayKey: string) => void
  /** Availability refetch in flight (month/duration change) → lazy state. */
  isLoading?: boolean
}

/** Stable per-zone day key for an instant, e.g. "2026-08-14" (exported — the
 *  parent uses it to auto-select the first available day). */
export function dayKeyInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ms),
  )
}

function timeLabelInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms))
}

export function SlotPicker({
  slots,
  timezone,
  monthOffset,
  onMonthOffsetChange,
  selectedSlot,
  onSelectSlot,
  selectedDay,
  onSelectDay,
  isLoading = false,
}: SlotPickerProps) {
  const slotsByDay = useMemo(() => {
    const map = new Map<string, number[]>()
    for (const ms of slots) {
      const key = dayKeyInZone(ms, timezone)
      const list = map.get(key) ?? []
      list.push(ms)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort((a, b) => a - b)
    return map
  }, [slots, timezone])

  const now = new Date()
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endMonth = new Date(now.getFullYear(), now.getMonth() + MAX_MONTH_OFFSET, 1)
  const visibleMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)

  const daySlots = selectedDay ? (slotsByDay.get(selectedDay) ?? []) : []

  return (
    <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)]">
      <div className={cn('shrink-0 transition-opacity', isLoading && 'opacity-50 pointer-events-none')}>
        <Calendar
          month={visibleMonth}
          startMonth={startMonth}
          endMonth={endMonth}
          onMonthChange={(month) => {
            const offset = (month.getFullYear() - now.getFullYear()) * 12 + (month.getMonth() - now.getMonth())
            onMonthOffsetChange(Math.max(0, Math.min(MAX_MONTH_OFFSET, offset)))
          }}
          selected={selectedDay ? new Date(`${selectedDay}T12:00:00`) : undefined}
          onDayClick={(day) => {
            const key = dayKeyInZone(day.getTime(), timezone)
            if (slotsByDay.has(key)) onSelectDay(key)
          }}
          disabled={(day) => !slotsByDay.has(dayKeyInZone(day.getTime(), timezone))}
          mode="single"
          className="p-0"
        />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-s)]">
        {isLoading ? (
          <>
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--spacing-system-xs)] content-start">
              {Array.from({ length: 9 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </>
        ) : selectedDay ? (
          <>
            <p className="text-h6 text-ods-text-primary">
              {new Intl.DateTimeFormat(undefined, {
                timeZone: timezone,
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).format(new Date(`${selectedDay}T12:00:00`))}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--spacing-system-xs)] content-start max-h-80 overflow-y-auto">
              {daySlots.map((ms) => {
                const isSelected = selectedSlot === ms
                return (
                  <Button
                    key={ms}
                    variant={isSelected ? undefined : 'outline'}
                    size="small-legacy"
                    onClick={() => onSelectSlot(ms)}
                  >
                    {timeLabelInZone(ms, timezone)}
                  </Button>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-h6 text-ods-text-secondary">Pick a day to see available times.</p>
        )}
      </div>
    </div>
  )
}
