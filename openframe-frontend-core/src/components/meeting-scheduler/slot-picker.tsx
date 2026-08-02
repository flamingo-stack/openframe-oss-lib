'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
 * LAZY STATES (no jumps, ever): each region owns a same-footprint skeleton —
 * `CalendarSkeleton` (caption + weekday row + 6×7 day grid) and
 * `TimeChipsSkeleton` (day heading + chip grid). During an availability
 * refetch (month change) BOTH regions swap to their skeletons; the region
 * containers carry fixed min-heights so loading ⇄ loaded never shifts layout.
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
  /** Availability refetch in flight (month change) → per-region skeletons. */
  isLoading?: boolean
}

/** Stable per-zone day key for an instant, e.g. "2026-08-14" (exported — the
 *  parent uses it to auto-select the first available day). */
export function dayKeyInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ms),
  )
}

/**
 * Calendar-side day-key anchoring: react-day-picker exchanges PLAIN calendar
 * dates (local Date objects whose y/m/d ARE the cell). Convert via local
 * date parts — never through an Intl zone — or a `displayTimezone` far from
 * the browser zone shifts cells by a day.
 */
const pad2 = (n: number) => String(n).padStart(2, '0')
function calendarDayKey(day: Date): string {
  return `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`
}
function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

function timeLabelInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms))
}

/** Calendar region min-height: caption (32) + gap (≤12) + table with 6 week
 *  rows (8 outer border-spacing + 7×36 rows + 6×4 row gaps = 284) = 328px.
 *  Sized to the TALLEST month so 5-row months, 6-row months, skeletons and
 *  loaded states all occupy identical space — measured live, not estimated. */
const CALENDAR_MIN_H = 'min-h-[20.5rem]'

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Deterministic month caption for a given offset (fixed en-US locale so
 *  the SSR and client first-paint markup agree byte-for-byte). */
export function monthLabelFor(offset: number): string {
  const now = new Date()
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month)
}

/**
 * Same-footprint skeleton for the day-selection calendar. STATIC chrome —
 * month caption, BOXED nav chevrons, weekday labels — renders REAL (it needs
 * no data); only the day buttons are skeleton cells.
 *
 * GEOMETRY IS EXACT, not approximate — it mirrors the v9 Calendar's real
 * classes: caption row h-8 with h-8/w-8 bordered nav boxes; the grid has NO
 * horizontal gaps (the real table is `border-separate border-spacing-y-1` —
 * vertical spacing only, so cells touch horizontally) and `py-1` reproduces
 * the table's outer border-spacing edges. Any deviation here shifts the
 * times column on skeleton ⇄ loaded swap.
 */
export function CalendarSkeleton({ monthOffset = 0 }: { monthOffset?: number }) {
  return (
    <div className={cn('flex flex-col gap-[var(--spacing-system-s)]', CALENDAR_MIN_H)}>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-0 flex h-8 items-center justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ods-border opacity-60">
            <ChevronLeft className="h-4 w-4 text-ods-text-muted" />
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-ods-border opacity-60">
            <ChevronRight className="h-4 w-4 text-ods-text-muted" />
          </span>
        </div>
        <div className="flex h-8 items-center justify-center">
          <p className="text-h6 text-ods-text-primary">{monthLabelFor(monthOffset)}</p>
        </div>
      </div>
      {/* Cells are NOT fixed-width: the real table stretches to its
          container (columns share the extra width, buttons centered) — the
          skeleton's grid tracks do exactly the same. */}
      <div className="flex flex-col gap-y-1 py-1">
        <div className="grid grid-cols-7">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="flex h-9 items-center justify-center text-h6 font-normal text-ods-text-secondary">
              {d}
            </div>
          ))}
        </div>
        {Array.from({ length: 6 }, (_, row) => (
          <div key={`w-${row}`} className="grid grid-cols-7">
            {Array.from({ length: 7 }, (_, col) => (
              <div key={col} className="flex h-9 items-center justify-center">
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The full slot-area skeleton — calendar + time-chip regions side by side in
 * the SAME flex wrappers as the loaded `SlotPicker`. This is the ONLY
 * loading visual for the slot area, used by every path that has nothing to
 * show yet (initial availability fetch, the pre-mount timezone-resolution
 * window, month-change refetch) — never a bare rectangle.
 */
export function SlotPickerSkeleton({ monthOffset = 0 }: { monthOffset?: number }) {
  return (
    <div className="flex flex-col md:flex-row gap-[var(--spacing-system-lf)]">
      <div className={cn('shrink-0', CALENDAR_MIN_H)}>
        <CalendarSkeleton monthOffset={monthOffset} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-s)]">
        <TimeChipsSkeleton />
      </div>
    </div>
  )
}

/** Same-footprint skeleton for the time-chip column. */
export function TimeChipsSkeleton() {
  return (
    <>
      {/* Day-heading line: text-h6 is 16px tall on mobile, 20px from md up. */}
      <Skeleton className="h-4 md:h-5 w-40" />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-[var(--spacing-system-xs)] content-start">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </>
  )
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
      <div className={cn('shrink-0', CALENDAR_MIN_H)}>
        {isLoading ? (
          <CalendarSkeleton monthOffset={monthOffset} />
        ) : (
          <Calendar
            month={visibleMonth}
            startMonth={startMonth}
            endMonth={endMonth}
            onMonthChange={(month) => {
              const offset = (month.getFullYear() - now.getFullYear()) * 12 + (month.getMonth() - now.getMonth())
              onMonthOffsetChange(Math.max(0, Math.min(MAX_MONTH_OFFSET, offset)))
            }}
            mode="single"
            required
            // CONTROLLED selection: v9 needs BOTH `selected` AND `onSelect` —
            // with `selected` alone it goes uncontrolled (internal state
            // seeded at mount), silently ignoring the parent's auto-selected
            // first day. `required` disables click-to-deselect.
            selected={selectedDay ? dateFromDayKey(selectedDay) : undefined}
            onSelect={(day) => {
              if (!day) return
              const key = calendarDayKey(day)
              if (slotsByDay.has(key)) onSelectDay(key)
            }}
            disabled={(day) => !slotsByDay.has(calendarDayKey(day))}
            className="p-0"
          />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col gap-[var(--spacing-system-s)]">
        {isLoading ? (
          <TimeChipsSkeleton />
        ) : selectedDay ? (
          <>
            <p className="text-h6 text-ods-text-primary">
              {/* Format the DAY-KEY itself (plain calendar date) — re-zoning a
                  local instant could label an adjacent day. */}
              {new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).format(dateFromDayKey(selectedDay))}
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
          <p className="text-h6 text-ods-text-secondary">
            {[...slotsByDay.keys()].some((k) =>
              k.startsWith(
                `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`,
              ),
            )
              ? 'Pick a day to see available times.'
              : 'No available times this month — try the next one.'}
          </p>
        )}
      </div>
    </div>
  )
}
