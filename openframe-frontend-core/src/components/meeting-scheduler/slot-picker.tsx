'use client';

import { ChevronRight } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { cn } from '../../utils/cn';
import { MAX_MONTH_OFFSET } from '../../utils/hubspot-meetings-convention';
import { Button, DatePickerCalendar, Skeleton } from '../ui';

/**
 * SlotPicker — day layer + time-chip grid for the meeting scheduler.
 *
 * Day layer is the design system's own `DatePickerCalendar`, in its `bare`
 * variant — the SAME component behind `DatePicker`'s popover and
 * `DateFilterMenu`, not a second day grid styled to look like it; `bare` only
 * drops the card surface and inset it would otherwise draw inside this panel. `fromDate`/`toDate` pin
 * navigation to [current month, current + MAX_MONTH_OFFSET] so the past is
 * unreachable, and `disabledDays` greys out days with no bookable slot —
 * bounds and availability are different questions, so they arrive separately.
 * Month navigation drives the host-proxy `monthOffset`, which is why the month
 * is CONTROLLED here rather than owned by the calendar. Time chips are plain
 * `Button`s whose variant flips on selection — no bespoke pill.
 *
 * LOADING (no blink, ever): the two columns know different amounts, so they
 * load differently. A CALENDAR is fully derivable from the date — which month,
 * which weekday each cell falls on — and only WHICH DAYS ARE BOOKABLE needs
 * the network. So it never unmounts: while a month loads it renders for real
 * with nothing yet selectable, which is exactly true, and lights up in place.
 * Only the times column, which genuinely has no answer until the response
 * lands, shows a placeholder.
 *
 * Swapping the calendar for a skeleton was the old behaviour and it is what
 * made paging months flash: the whole grid vanished and rebuilt to say
 * something it already knew.
 *
 * Each column carries its OWN heading — "Select Date & Time" over the
 * calendar, the chosen day over the chips. The headings live HERE rather than
 * above the whole picker so each sits with the thing it labels, and so the
 * skeletons reproduce them without the parent rendering a heading it cannot
 * keep in step.
 *
 * All slot instants are epoch-ms; every label is rendered in `timezone`
 * (resolved by the parent AFTER mount — this component never reads Intl
 * itself, keeping SSR output deterministic).
 */

export interface SlotPickerProps {
  /** Bookable slot start times (epoch ms) for the selected duration. */
  slots: number[];
  /** IANA zone every label renders in (parent resolves post-mount). */
  timezone: string;
  monthOffset: number;
  onMonthOffsetChange: (offset: number) => void;
  selectedSlot: number | null;
  onSelectSlot: (startMs: number) => void;
  selectedDay: string | null;
  onSelectDay: (dayKey: string) => void;
  /** Availability refetch in flight (month change) → per-region skeletons. */
  isLoading?: boolean;
  /**
   * A booking POST is in flight (details-first, where the slot click IS the
   * submit). DISTINCT from `isLoading`, which swaps the whole times column for
   * a skeleton — here the grid must stay up with the clicked chip spinning, so
   * the visitor can see WHICH time is being booked.
   */
  isSubmitting?: boolean;
}

/** Stable per-zone day key for an instant, e.g. "2026-08-14" (exported — the
 *  parent uses it to auto-select the first available day). */
export function dayKeyInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(ms),
  );
}

/**
 * Calendar-side day-key anchoring: react-day-picker exchanges PLAIN calendar
 * dates (local Date objects whose y/m/d ARE the cell). Convert via local
 * date parts — never through an Intl zone — or a `displayTimezone` far from
 * the browser zone shifts cells by a day.
 */
const pad2 = (n: number) => String(n).padStart(2, '0');
function calendarDayKey(day: Date): string {
  return `${day.getFullYear()}-${pad2(day.getMonth() + 1)}-${pad2(day.getDate())}`;
}
function dateFromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function timeLabelInZone(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(ms));
}

/**
 * The calendar column's width, once the layout stops handing it one: on a
 * phone the section spans the card, from `md` up it takes a stated width and
 * the times column gets the rest.
 *
 * Width no longer decides height — `DatePickerCalendar bare` is a fixed 272px
 * block at any width — so these two numbers answer one question only: how much
 * room the month CAPTION needs. The two DS icon buttons and their gaps take
 * 104px of the header, and "September 2026" is ~131 at text-h4, so the grid
 * needs ~245px of inner width before the label starts colliding with the
 * next-month button. 304 on tablet (256 inner, this column pads itself) and
 * 256 on the desktop card, where the panel supplies the padding.
 *
 * That is the trade the standard button size buys: the chrome keeps its
 * 48px targets and the COLUMN widens to house it, rather than the buttons
 * shrinking to fit a narrower column.
 */
const CALENDAR_W = 'md:w-[19rem] md:shrink-0 lg:w-[16rem]';

/** Column heading ("Select Date & Time" / the chosen day) — body-weight
 *  primary, 4px above its content, mirrored by both skeletons. */
const COLUMN_HEADING_CLASS = 'shrink-0 text-h4 text-ods-text-primary';
const COLUMN_STACK = 'flex min-h-0 flex-col gap-[var(--spacing-system-xxs)]';

/** Static label over the calendar. Exported so a host rendering its own
 *  chrome around the picker can stay in step with it. */
export const SLOT_PICKER_HEADING = 'Select Date & Time';

/**
 * Chip grid: `auto-fill` over `minmax(5.5rem, 1fr)` — as many chips per row as
 * fit at the minimum, then the leftover width shared out between them.
 *
 * Both halves matter. The 5.5rem MINIMUM is the widest 12-hour label
 * ("12:45 PM") plus the chip's padding: the mocks draw 65px chips five across
 * a phone, but they are lettered in a 24-hour locale ("13:45") and this
 * renders in the visitor's own — a chip that clips its own time is worse than
 * one column fewer. The `1fr` MAXIMUM is what makes the grid reach the card's
 * edge like the design instead of stopping short with a ragged strip of empty
 * space beside the last column, which is what a fixed track width leaves
 * behind at every width that is not an exact multiple of it.
 *
 * `auto-fill` is what keeps `1fr` safe here: the track COUNT still comes from
 * the minimum, so a wide column answers with more chips rather than with
 * fifteen-minute slots stretched into 200px slabs.
 *
 * Every track is the same width, so rows line up and nothing staggers.
 */
const CHIP_GRID_CLASS = cn(
  'grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] content-start gap-[var(--spacing-system-xs)]',
  'overflow-y-auto',
  // PHONE: a stated window (~3 rows, the mock's 156px) that scrolls, rather
  // than a list that runs the length of the day. Nothing else on the phone
  // card has a height — the design lets each step be as tall as it needs —
  // but a busy day is forty slots, and letting them all through turns a
  // 700px card into a 1500px one and buries whatever the page puts below
  // it. This is the one nested scroller worth having: a small, obviously
  // bounded list with a visible edge, exactly as drawn.
  'max-h-[9.75rem] md:max-h-none',
  // No height of its own, and none borrowed from the calendar either: the card
  // states one height, the panel and this row pass it down, and what is left
  // after the column heading IS the scroll box. A long day scrolls inside it.
  //
  // `min-h-0` is the load-bearing half — a flex item's default
  // `min-height:auto` refuses to shrink below its content, so without it the
  // chips grow the column, then the row, then the card, and `overflow-y-auto`
  // never gets a box smaller than its contents to scroll inside. That is the
  // exact failure that kept this card at 404px when it was told to be 318.
  'min-h-0 flex-1',
);
/** The track sets the width; the chip fills it, so labels can't stagger it.
 *  The tighter inline padding is what lets the track hold a 12-hour label —
 *  the Button's own is sized for prose, not for a time. */
const CHIP_CLASS = 'w-full px-[var(--spacing-system-xxs)]';

/**
 * The two columns, at three widths.
 *
 *   < md  phone   — stacked sections, a full-bleed rule between them
 *   md    tablet  — side by side, the calendar at its stated width and the
 *                   times taking the rest, a vertical rule between them
 *   lg    desktop — side by side inside the panel's own padding, separated by
 *                   a gap (the card already has a rule there: the context
 *                   panel's edge)
 *
 * From `md` up the row takes what the card has left (`flex-1 min-h-0`) and
 * hands each column that same definite height. The calendar is a fixed 272px
 * block and does not scroll; the times column holds whatever the day offers
 * and scrolls ON ITS OWN. Two boxes, one height, one scrollbar — the calendar
 * stays put while the visitor runs down the times.
 *
 * Below `md` the card pins no height, so the row simply grows and the PAGE
 * scrolls — a nested scroller inside a hand-width card traps the gesture and
 * is worse than the thing it saves.
 */
const SLOT_ROW_CLASS = cn(
  'flex min-w-0 flex-col md:flex-row',
  // Default `stretch` at every width, deliberately. Stacked, that is what
  // makes each section span the card — an `items-start` here (it was here, to
  // stop a column growing taller than its month) collapses both sections to
  // their intrinsic WIDTH instead, which on a phone left the calendar and the
  // chips huddled against the left edge with half the card empty. The
  // calendar no longer needs protecting: its height is fixed, not derived.
  'md:min-h-0 md:flex-1 lg:gap-[var(--spacing-system-lf)]',
);

/** Shared by both columns: self-padded until the panel takes over at `lg`.
 *  Widths are per-column — the calendar states one (`CALENDAR_W`) and the
 *  times take what is left, rather than a 50/50 split that would size the
 *  month by the card's width. */
const COLUMN_BOX = 'p-[var(--spacing-system-l)] lg:p-0';

/** The rule between the two, wherever the layout puts it. */
const COLUMN_DIVIDER = 'border-b border-ods-border md:border-b-0 md:border-r lg:border-0';

/** Deterministic month caption for a given offset (fixed en-US locale so
 *  the SSR and client first-paint markup agree byte-for-byte). */
export function monthLabelFor(offset: number): string {
  const now = new Date();
  const month = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month);
}

/** Nothing is bookable yet — used while a month is still loading. */
const DISABLE_EVERY_DAY = () => true;
const NOOP = () => undefined;

interface DayCalendarProps {
  monthOffset: number;
  onMonthOffsetChange: (offset: number) => void;
  selectedDay: string | null;
  onSelectDay: (dayKey: string) => void;
  /** Days that ARE bookable; `null` while the month is still loading. */
  slotsByDay: Map<string, number[]> | null;
}

/**
 * The day layer — one component for every state, which is the whole point:
 * loading a month changes WHICH DAYS ARE ENABLED, nothing else, so the grid
 * stays mounted and the visitor never watches it disappear and come back.
 *
 * `aria-busy` carries what the missing days mean to assistive tech, since
 * visually it is just an inert month.
 */
function DayCalendar({ monthOffset, onMonthOffsetChange, selectedDay, onSelectDay, slotsByDay }: DayCalendarProps) {
  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  // Day-0 of the FOLLOWING month = the last day of the last bookable one.
  // `DatePickerCalendar` takes day bounds, not month bounds, so an end date
  // pointing at the 1st would disable the rest of that month.
  const endMonth = new Date(now.getFullYear(), now.getMonth() + MAX_MONTH_OFFSET + 1, 0);
  const visibleMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);

  // Stable identity: the calendar memoizes its matcher list on this value, so
  // a fresh closure per render would rebuild it every render.
  const dayHasNoSlots = useCallback((day: Date) => !slotsByDay?.has(calendarDayKey(day)), [slotsByDay]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-busy={slotsByDay === null}>
      <DatePickerCalendar
        mode="single"
        bare
        // CONTROLLED month: paging it is a DATA event here (the parent
        // refetches availability for the new offset), not just a view change
        // the calendar could own.
        month={visibleMonth}
        onMonthChange={month => {
          const offset = (month.getFullYear() - now.getFullYear()) * 12 + (month.getMonth() - now.getMonth());
          onMonthOffsetChange(Math.max(0, Math.min(MAX_MONTH_OFFSET, offset)));
        }}
        fromDate={startMonth}
        toDate={endMonth}
        selected={selectedDay ? dateFromDayKey(selectedDay) : undefined}
        onSelect={value => {
          const day = value as Date | undefined;
          if (!day) return;
          const key = calendarDayKey(day);
          if (slotsByDay?.has(key)) onSelectDay(key);
        }}
        disabledDays={slotsByDay === null ? DISABLE_EVERY_DAY : dayHasNoSlots}
      />
    </div>
  );
}

/**
 * The slot area before the first response — the pre-mount window while the
 * display timezone resolves, and the first availability request.
 *
 * The calendar half is REAL, not a placeholder: see the module docblock. Only
 * the times column is a skeleton, and it is the same one the loaded picker
 * shows while a month loads, so there is no swap between the two.
 */
export function SlotPickerSkeleton({ monthOffset = 0 }: { monthOffset?: number }) {
  return (
    <div className={SLOT_ROW_CLASS}>
      <div className={cn(COLUMN_STACK, COLUMN_BOX, COLUMN_DIVIDER, CALENDAR_W, 'md:overflow-y-auto')}>
        {/* Needs no data — the heading renders REAL in every loading state. */}
        <p className={COLUMN_HEADING_CLASS}>{SLOT_PICKER_HEADING}</p>
        <DayCalendar
          monthOffset={monthOffset}
          onMonthOffsetChange={NOOP}
          selectedDay={null}
          onSelectDay={NOOP}
          slotsByDay={null}
        />
      </div>
      <div className={cn(COLUMN_STACK, COLUMN_BOX, 'min-w-0 md:flex-1')}>
        <TimeChipsSkeleton />
      </div>
    </div>
  );
}

/** Same-footprint skeleton for the time-chip column. */
export function TimeChipsSkeleton() {
  return (
    <>
      {/* The day label is data — but it is held inside the REAL heading line
          box, so the skeleton's first row sits exactly where the label lands. */}
      <div className={COLUMN_HEADING_CLASS}>
        <Skeleton className="inline-block h-4 w-40 align-middle" />
      </div>
      <div className={CHIP_GRID_CLASS}>
        {/* Enough to fill the visible scroll box at any column count — the
            grid's track count follows the card width, so no fixed number
            lands flush and a partial last row is the honest shape anyway. */}
        {Array.from({ length: 16 }, (_, i) => (
          // h-11 md:h-12 — the loaded chip's own default-size height.
          <Skeleton key={i} className={cn(CHIP_CLASS, 'h-11 md:h-12')} />
        ))}
      </div>
    </>
  );
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
  isSubmitting = false,
}: SlotPickerProps) {
  const slotsByDay = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const ms of slots) {
      const key = dayKeyInZone(ms, timezone);
      const list = map.get(key) ?? [];
      list.push(ms);
      map.set(key, list);
    }
    for (const list of map.values()) list.sort((a, b) => a - b);
    return map;
  }, [slots, timezone]);

  const visibleMonth = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const daySlots = selectedDay ? (slotsByDay.get(selectedDay) ?? []) : [];

  // Whether the VISIBLE month has anything at all. HubSpot's monthOffset
  // payloads can carry near-term slots from outside the requested month, so
  // this asks about the grid on screen, not about the payload's size.
  const monthPrefix = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`;
  const monthHasSlots = [...slotsByDay.keys()].some(key => key.startsWith(monthPrefix));

  return (
    <div className={SLOT_ROW_CLASS}>
      <div className={cn(COLUMN_STACK, COLUMN_BOX, COLUMN_DIVIDER, CALENDAR_W, 'md:overflow-y-auto')}>
        <p className={COLUMN_HEADING_CLASS}>{SLOT_PICKER_HEADING}</p>
        {/* Stays mounted through a month load — `slotsByDay: null` is what
            "nothing selectable yet" looks like, not an unmount. */}
        <DayCalendar
          monthOffset={monthOffset}
          onMonthOffsetChange={onMonthOffsetChange}
          selectedDay={selectedDay}
          onSelectDay={onSelectDay}
          slotsByDay={isLoading ? null : slotsByDay}
        />
      </div>
      <div className={cn(COLUMN_STACK, COLUMN_BOX, 'min-w-0 md:flex-1')}>
        {isLoading ? (
          <TimeChipsSkeleton />
        ) : selectedDay ? (
          <>
            <p className={COLUMN_HEADING_CLASS}>
              {/* Format the DAY-KEY itself (plain calendar date) — re-zoning a
                  local instant could label an adjacent day. */}
              {new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).format(dateFromDayKey(selectedDay))}
            </p>
            <div className={CHIP_GRID_CLASS}>
              {daySlots.map(ms => {
                const isSelected = selectedSlot === ms;
                return (
                  <Button
                    key={ms}
                    variant={isSelected ? undefined : 'outline'}
                    // The click is the submit in details-first, so the grid
                    // itself is the double-book guard — the form button that
                    // used to carry `disabled={isSubmitting}` is not on screen.
                    disabled={isSubmitting}
                    loading={isSubmitting && isSelected}
                    onClick={() => {
                      if (isSubmitting) return;
                      onSelectSlot(ms);
                    }}
                    className={CHIP_CLASS}
                  >
                    {timeLabelInZone(ms, timezone)}
                  </Button>
                );
              })}
            </div>
          </>
        ) : monthHasSlots ? (
          <p className="text-ods-text-secondary text-h6">Pick a day to see available times.</p>
        ) : (
          // A fully-booked month used to just SAY "try the next one" and leave
          // the visitor to find the chevron in the other column. The way out
          // of a dead end belongs in the dead end.
          <div className="flex flex-col items-start gap-[var(--spacing-system-s)]">
            <p className="text-ods-text-secondary text-h6">No available times in {monthLabelFor(monthOffset)}.</p>
            {monthOffset < MAX_MONTH_OFFSET && (
              <Button
                variant="outline"
                onClick={() => onMonthOffsetChange(monthOffset + 1)}
                rightIcon={<ChevronRight className="size-5" />}
              >
                Check {monthLabelFor(monthOffset + 1)}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
