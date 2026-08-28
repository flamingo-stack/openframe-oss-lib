'use client';

import * as Popover from '@radix-ui/react-popover';
import { ArrowUpDown, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { DayPicker, type DateRange, type DayPickerProps, type Matcher } from 'react-day-picker';
import { useMdUp } from '../../hooks';
import { cn } from '../../utils/cn';
import { Button } from './button';
import { FieldWrapper } from './field-wrapper';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import type { SortDirection } from './sort-column-item';

// ============================================================================
// Types
// ============================================================================

export type DatePickerMode = 'single' | 'range';

export interface DatePickerBaseProps {
  /** Placeholder text when no date is selected */
  placeholder?: string;
  /** Format function for displaying the date */
  formatDate?: (date: Date) => string;
  /** Whether the picker is disabled */
  disabled?: boolean;
  /** Additional class name for the trigger button */
  className?: string;
  /** Number of months to display */
  numberOfMonths?: 1 | 2;
  /** Minimum selectable date */
  fromDate?: Date;
  /** Maximum selectable date */
  toDate?: Date;
  /** Locale for formatting */
  locale?: DayPickerProps['locale'];
  /** Label text displayed above the picker */
  label?: string;
  /** Error message displayed below the picker */
  error?: string;
  /** When true, renders red error border */
  invalid?: boolean;
}

export interface SingleDatePickerProps extends DatePickerBaseProps {
  mode: 'single';
  value?: Date;
  onChange?: (date: Date | undefined) => void;
}

export interface RangeDatePickerProps extends DatePickerBaseProps {
  mode: 'range';
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
}

export type DatePickerProps = SingleDatePickerProps | RangeDatePickerProps;

// ============================================================================
// Helper functions
// ============================================================================

const defaultFormatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
};

const formatDateRange = (range: DateRange | undefined, formatFn: (date: Date) => string): string => {
  if (!range?.from) return '';
  if (!range.to) return formatFn(range.from);
  return `${formatFn(range.from)} - ${formatFn(range.to)}`;
};

// ============================================================================
// Calendar Components
// ============================================================================

interface CalendarNavButtonProps {
  direction: 'left' | 'right';
  onClick?: () => void;
  /** Set at a `fromDate` / `toDate` bound — there is nothing selectable past it. */
  disabled?: boolean;
  'aria-label'?: string;
}

/** The DS icon button, at its standard size in every placement — month
 *  navigation is a primary control, not chrome to be shrunk to fit. What has
 *  to give instead is the calendar's WIDTH: a `bare` host states one wide
 *  enough for the caption to sit between the two buttons (see the meeting
 *  scheduler's `CALENDAR_W`). */
function CalendarNavButton({ direction, onClick, disabled, 'aria-label': ariaLabel }: CalendarNavButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      leftIcon={direction === 'left' ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
    />
  );
}

// ============================================================================
// DatePickerCalendar Component
// ============================================================================

export interface DatePickerCalendarProps {
  mode: DatePickerMode;
  selected: Date | DateRange | undefined;
  onSelect: (value: Date | DateRange | undefined) => void;
  numberOfMonths?: 1 | 2;
  fromDate?: Date;
  toDate?: Date;
  locale?: DayPickerProps['locale'];
  /**
   * When true the calendar fills its container width and day cells flex to
   * fit (instead of the fixed 40px cells). Used by DateFilterMenu so the grid
   * lines up with the surrounding controls per the Figma filter-menu.
   */
  fluid?: boolean;
  /**
   * The calendar ALONE — the Figma `Date Picker` component as drawn, with no
   * card surface and no outer inset: the nav header flush to both edges, 8px,
   * then a full-bleed grid. Seven columns divide the container, so the
   * cells are as wide as the host makes them.
   *
   * FIXED 272px tall at every one of those widths (8 + the 48px icon-button
   * header + a 24px weekday strip + six 32px rows; 268 on a phone, where the
   * DS icon button is 44), which is the design's own contract — the
   * component is drawn 240 tall at 340, 282 and 240 wide. Height that ignored
   * the width is what lets a host place it in a card that states a height, and
   * keeps a phone-width month from becoming a 356px band.
   *
   * The DAY inside each cell stays square, so the selection and today's tint
   * read as rounded squares rather than as pills stretched across a wide
   * cell.
   *
   * For hosts that place the calendar inside a panel they already own — the
   * meeting scheduler — where the standalone card chrome reads as a card
   * inside a card and its 16px inset fights the panel's own 24px one. The
   * popover and filter-menu keep the surface; nothing about the type, colours
   * or day states changes between the two.
   */
  bare?: boolean;
  /**
   * Days to disable ON TOP of the `fromDate`/`toDate` bounds — a matcher, so a
   * host can disable by predicate. "Inside the allowed window" and "actually
   * selectable" are different questions, and only the host can answer the
   * second (the meeting scheduler greys out days with no bookable slot).
   */
  disabledDays?: Matcher | Matcher[];
  /**
   * Controlled visible month; pair with `onMonthChange`. Omit both and the
   * calendar owns its month, which is the right default — a host needs these
   * only when paging is ALSO a data event, e.g. the scheduler refetches
   * availability per month and would otherwise show an unpopulated month.
   */
  month?: Date;
  onMonthChange?: (month: Date) => void;
}

/**
 * The calendar surface behind every date control in the design system —
 * `DatePicker`'s popover and `DateFilterMenu` — exported so a host that needs
 * an always-visible day grid renders THIS one. A second hand-styled day grid
 * is how the two drift apart.
 */
export function DatePickerCalendar({
  mode,
  selected,
  onSelect,
  numberOfMonths = 1,
  fromDate,
  toDate,
  locale,
  fluid = false,
  bare = false,
  disabledDays: extraDisabledDays,
  month: monthProp,
  onMonthChange,
}: DatePickerCalendarProps) {
  const today = new Date();

  const isMdUp = useMdUp() ?? true;
  const monthsToShow = isMdUp ? numberOfMonths : 1;

  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    mode === 'range' ? (selected as DateRange | undefined) : undefined,
  );
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);

  // Keep the internal range in sync when the consumer changes `selected`
  // externally (e.g. DateFilterMenu Reset while the popover stays open).
  // Adjusted while rendering — React's documented prop-sync pattern — rather
  // than from an effect: the calendar highlights `draftRange` in THIS render,
  // so a Reset done from an effect painted the old selection one more time
  // before clearing it.
  const [syncedSelection, setSyncedSelection] = useState({ mode, selected });
  if (syncedSelection.mode !== mode || syncedSelection.selected !== selected) {
    setSyncedSelection({ mode, selected });
    if (mode === 'range') {
      setDraftRange(selected as DateRange | undefined);
    }
  }

  const rangeSelected = draftRange;
  const hasCompleteRange =
    mode === 'range' &&
    !!rangeSelected?.from &&
    !!rangeSelected?.to &&
    rangeSelected.from.getTime() !== rangeSelected.to.getTime();

  const isPreviewDate = (date: Date): boolean => {
    if (!draftRange?.from || draftRange.to || !hoveredDate) return false;
    const start = Math.min(draftRange.from.getTime(), hoveredDate.getTime());
    const end = Math.max(draftRange.from.getTime(), hoveredDate.getTime());
    return date.getTime() >= start && date.getTime() <= end;
  };

  const handleRangeSelect = (triggerDate: Date | undefined): void => {
    if (!triggerDate) return;

    if (!draftRange?.from || draftRange.to) {
      // First click starts the range — propagate it so consumers can already
      // act on a single-day selection (e.g. DateFilterMenu Apply/Reset).
      const started: DateRange = { from: triggerDate, to: undefined };
      setDraftRange(started);
      onSelect(started);
      return;
    }
    // Second click closes the range, ordering the two ends.
    const start = draftRange.from;
    const completed: DateRange =
      triggerDate.getTime() < start.getTime() ? { from: triggerDate, to: start } : { from: start, to: triggerDate };
    setDraftRange(completed);
    setHoveredDate(undefined);
    onSelect(completed);
  };

  // Fixed 40px cells by default; in fluid mode cells flex to fill the width.
  // `bare` is a fluid layout by definition — its cell size IS container/7.
  const isFluid = fluid || bare;
  // BARE: fixed row height, elastic width — the Figma component is 240px tall
  // at every width it is drawn at (340 on a phone, 282 on a tablet, 240 on the
  // desktop card), so a month occupies the same band whatever column it lands
  // in. 8 + the 48px header + a 24px weekday strip + six 32px rows = 272.
  //
  // Height that does NOT follow the width is the whole point: seven square
  // cells across a phone's 340px would be a 356px-tall month, half again what
  // the design budgets, and the same rule handed a wide column a month tall
  // enough to push a card that states its height.
  const cellOuter = bare ? 'flex-1 min-w-0 h-[32px]' : isFluid ? 'flex-1 aspect-square min-w-0' : 'size-10';
  // ...but the DAY ITSELF stays square inside that wider cell: `h-full` gives
  // the button the row's height and `aspect-square` turns it into a 32x32
  // rounded square, centred by the cell. `w-auto` is load-bearing — it drops
  // the width the button would otherwise take, leaving `aspect-square` inert.
  //
  // This is why the day STATES below are painted on the button in bare mode
  // rather than on the cell: react-day-picker puts `selected`/`today` on the
  // cell, and a cell 48px wide by 30 tall renders the selection as a stretched
  // pill. Same colours, same radius, smaller box.
  const cellInner = bare ? 'h-full w-auto aspect-square rounded-[6px]' : isFluid ? 'size-full' : 'size-10';
  // The weekday strip is a LABEL row, not a day: `bare` gives it the height of
  // its own text rather than a full row.
  const weekdayOuter = bare ? 'flex-1 min-w-0 h-6' : cellOuter;

  // Day states, per paint target (see `cellInner`). Range mode is never bare —
  // a range MUST fill its cells or the middle would break into islands — so
  // only these three single-day states fork.
  const hoverClass = bare ? '[&>button]:hover:bg-ods-bg-surface' : 'hover:bg-ods-bg-surface hover:rounded-[6px]';
  const todayClass = bare
    ? '[&>button]:bg-ods-bg-surface [&>button]:hover:!bg-ods-bg-surface'
    : 'bg-ods-bg-surface rounded-[6px] hover:!bg-ods-bg-surface';
  /**
   * Today's tint applies only while today is NOT part of the selection.
   *
   * Both states paint the same box, and both have to use `!important` to beat
   * react-day-picker's concatenated base classes — so on hover the two rules
   * had equal specificity and the winner came down to their order in the
   * generated stylesheet. Today's tint won, and a selected today turned GREY
   * under the pointer, as if it had been deselected.
   *
   * Deciding it here rather than in CSS: "today" is a hint about where you
   * are in the month, and once that day is chosen the selection is the
   * stronger statement — there is nothing left for the tint to say.
   */
  const dayNumber = (date: Date): number => date.getFullYear() * 10000 + date.getMonth() * 100 + date.getDate();
  const isSelectedDay = (date: Date): boolean => {
    const n = dayNumber(date);
    if (mode === 'single') {
      const picked = selected as Date | undefined;
      return !!picked && dayNumber(picked) === n;
    }
    const range = rangeSelected;
    if (!range?.from) return false;
    if (!range.to) return dayNumber(range.from) === n;
    return n >= dayNumber(range.from) && n <= dayNumber(range.to);
  };
  const isUnclaimedToday = (date: Date): boolean => dayNumber(date) === dayNumber(today) && !isSelectedDay(date);

  const selectedClass = bare
    ? '[&>button]:!bg-ods-accent [&>button]:!text-ods-card [&>button]:!font-bold [&>button]:hover:!bg-ods-accent'
    : '!bg-ods-accent !text-ods-card !font-bold !rounded-[6px] hover:!bg-ods-accent';

  // Surface + inset, per placement. Bare drops the card and the 16px inset
  // (the host's panel provides both) and replaces the inset with the 8px the
  // design puts between the header and the grid — the ONLY spacing it keeps.
  const surfaceClass = bare
    ? 'flex w-full flex-col'
    : cn('overflow-hidden rounded-[6px] border border-ods-border bg-ods-card', isFluid && 'w-full');
  // Bare: an unpadded header row over the grid, 8px apart — the calendar's
  // whole height is the two of them added up, never the container's.
  const captionRowClass = cn('flex items-center justify-between gap-1', bare ? 'shrink-0' : 'px-4 pt-4');
  // The caption is the only elastic thing in the header: it takes the space
  // the two fixed buttons leave and truncates rather than pushing into them.
  // "September 2026" is ~131px at text-h4, and the two 48px buttons plus their
  // gaps take 104 — so a `bare` host has to state a width of ~256 or more, or
  // the label and the next-month button collide (worse in a locale with longer
  // month names).
  const captionClass = 'min-w-0 flex-1 truncate text-center text-h4 text-ods-text-primary';

  const classNames: DayPickerProps['classNames'] = {
    root: cn(
      'date-picker-calendar',
      bare ? 'flex w-full flex-col pt-[var(--spacing-system-xsf)]' : cn('p-4', isFluid && 'w-full'),
    ),
    months: cn('flex gap-8', bare && 'w-full'),
    month: cn('flex flex-col', bare ? 'w-full' : cn('gap-2', isFluid && 'w-full')),
    month_caption: 'hidden',
    nav: 'hidden',
    month_grid: cn('border-collapse', bare ? 'flex w-full flex-col' : isFluid && 'w-full'),
    weekdays: 'flex',
    ...(bare ? { weeks: 'flex flex-col' } : {}),
    weekday: cn(weekdayOuter, 'flex items-center justify-center', 'text-ods-text-secondary text-h6'),
    week: 'flex',
    day: cn(
      cellOuter,
      'flex items-center justify-center',
      'text-ods-text-primary text-h4',
      'cursor-pointer',
      'transition-colors duration-150',
      hoverClass,
    ),
    day_button: cn(
      cellInner,
      'flex items-center justify-center',
      'cursor-pointer border-none bg-transparent outline-none',
      'font-inherit text-inherit',
    ),
    // Painted through the `todayTint` modifier instead — see `isUnclaimedToday`.
    today: '',
    selected: cn(
      selectedClass,
      // In range mode, selected class should not override range_start/range_end/range_middle
      mode === 'range' && 'range-selected',
    ),
    outside: 'text-ods-border opacity-50 hover:!bg-transparent',
    // Out of bounds: greyed, un-hoverable, and not-allowed under the cursor.
    //
    // Every rule here is `!`, and the inner button is targeted explicitly —
    // neither is decoration. react-day-picker CONCATENATES the modifier's classes
    // onto the base `day` ones (no tailwind-merge), so `text-ods-text-disabled`
    // and `text-ods-text-primary` both land on the cell and the winner comes down
    // to their order in the generated stylesheet, not in the attribute; without
    // `!` the disabled day rendered in full white, indistinguishable from a
    // selectable one. The cursor needs the child selector on top of that: it is
    // the `day_button` INSIDE the cell that carries `cursor-pointer`, and a
    // `disabled` <button> does not inherit the cell's cursor on its own.
    disabled: cn(
      '!cursor-not-allowed !text-ods-text-disabled hover:!bg-transparent',
      '[&>button]:!cursor-not-allowed [&>button]:!text-ods-text-disabled',
      // Also drop the `today` tint, or an unselectable today renders BLANK:
      // `--color-text-disabled` and `--color-bg-surface` are the SAME token
      // (`--ods-system-greys-soft-grey`), so the number disappears into the
      // highlight — grey on identical grey. Reachable by any picker whose
      // `fromDate` is in the future, and permanently by the meeting scheduler,
      // where today usually has no bookable slots left.
      //
      // Dropping the tint rather than repainting the text: a disabled day is
      // not actionable, so a highlight claiming otherwise is the wrong signal.
      // The day still reads as today's position in the month by being the one
      // dimmed cell between yesterday and tomorrow.
      '!bg-transparent [&>button]:!bg-transparent',
    ),
    hidden: 'invisible',
    // Range styles matching Figma design:
    // - range_start: bright yellow #ffc008, bold, left radius (full radius if single selection)
    // - range_end: bright yellow #ffc008, bold, right radius
    // - range_middle: dark yellow var(--ods-open-yellow-light), medium weight text
    // Border radius on row edges is handled via CSS in the style tag below
    range_start: cn(
      'range-start !bg-ods-accent !font-bold !text-ods-card hover:!bg-ods-accent',
      hasCompleteRange ? '!rounded-l-[6px] !rounded-r-none' : '!rounded-[6px]',
    ),
    range_end: cn(
      'range-end !bg-ods-accent !font-bold !text-ods-card hover:!bg-ods-accent',
      hasCompleteRange ? '!rounded-l-none !rounded-r-[6px]' : '!rounded-[6px]',
    ),
    range_middle:
      'range-middle !bg-ods-open-yellow-light !text-ods-card !font-medium !rounded-none hover:!bg-ods-open-yellow-light',
  };

  // Controlled when the host passes `month`, self-owned otherwise. The
  // internal state is kept either way so an uncontrolled calendar still works;
  // controlled it is simply never read, which keeps `changeMonth` one path.
  const [uncontrolledMonth, setUncontrolledMonth] = useState<Date>(
    mode === 'single' ? (selected as Date) || today : (selected as DateRange)?.from || today,
  );
  const month = monthProp ?? uncontrolledMonth;
  const changeMonth = (next: Date): void => {
    setUncontrolledMonth(next);
    onMonthChange?.(next);
  };

  /**
   * `fromDate` / `toDate` → what react-day-picker **v9** actually understands.
   *
   * v8 took the bounds as props of those names and both disabled the days
   * outside them and stopped the navigation there. v9 removed them: they are
   * typed `@deprecated … has been removed` and the runtime never reads them —
   * so forwarding them, as this calendar did after the v8 → v9 upgrade, silently
   * dropped every bound. A "next 30 days" picker happily accepted last year, and
   * the `disabled` class already defined in `classNames` below never applied to
   * anything. Same shape of miss as the v8 `classNames` keys called out in
   * `calendar.tsx` — the other half of that migration.
   *
   * The public API is unchanged: consumers keep passing `fromDate`/`toDate`, and
   * this is the single place either is translated.
   */
  const disabledDays = useMemo<Matcher[]>(() => {
    const matchers: Matcher[] = [];
    if (fromDate) matchers.push({ before: fromDate });
    if (toDate) matchers.push({ after: toDate });
    if (extraDisabledDays) {
      matchers.push(...(Array.isArray(extraDisabledDays) ? extraDisabledDays : [extraDisabledDays]));
    }
    return matchers;
  }, [fromDate, toDate, extraDisabledDays]);

  // Out-of-bounds days are disabled, not hidden — a month keeps its shape, and
  // the greyed-out day is what tells the user the bound exists. Navigation stops
  // at the bound too (v8 did the same): past it there is nothing selectable, so
  // paging further only walks through dead months. The nav is this component's
  // own — `hideNavigation` turns off DayPicker's — so the limit is applied here
  // rather than through `startMonth`/`endMonth`.
  // Compared as a month ORDINAL, not as dates: the bound falls on some day of
  // its month, and that month must stay reachable — a `fromDate` of the 20th
  // still has to let the user page back to that month to pick the 25th.
  const monthIndex = (date: Date): number => date.getFullYear() * 12 + date.getMonth();
  const lastVisibleMonth = monthIndex(month) + (monthsToShow === 2 ? 1 : 0);
  const canGoPrevious = !fromDate || monthIndex(month) > monthIndex(fromDate);
  const canGoNext = !toDate || lastVisibleMonth < monthIndex(toDate);

  const shiftMonth = (by: number) => {
    const next = new Date(month);
    next.setMonth(next.getMonth() + by);
    changeMonth(next);
  };
  const handlePreviousMonth = () => shiftMonth(-1);
  const handleNextMonth = () => shiftMonth(1);

  const formatMonthYear = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  };

  const getSecondMonth = (date: Date): Date => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + 1);
    return next;
  };

  // CSS for range styles:
  // - Ensure range_middle overrides selected styles (darker yellow for middle dates)
  // - Add row-edge border radius on range middle dates
  const rangeStyles = `
    .date-picker-calendar .range-middle {
      background-color: var(--ods-open-yellow-light) !important;
      font-weight: 500 !important;
    }
    .date-picker-calendar .range-middle:hover {
      background-color: var(--ods-open-yellow-light) !important;
    }
    .date-picker-calendar .range-start,
    .date-picker-calendar .range-end {
      background-color: var(--color-accent-primary) !important;
      font-weight: 700 !important;
    }
    .date-picker-calendar .range-start:hover,
    .date-picker-calendar .range-end:hover {
      background-color: var(--color-accent-primary) !important;
    }
    .date-picker-calendar .range-middle:first-child {
      border-top-left-radius: 6px !important;
      border-bottom-left-radius: 6px !important;
    }
    .date-picker-calendar .range-middle:last-child {
      border-top-right-radius: 6px !important;
      border-bottom-right-radius: 6px !important;
    }
  `;

  if (mode === 'single') {
    return (
      <div className={surfaceClass}>
        <div className={captionRowClass}>
          <CalendarNavButton
            direction="left"
            onClick={handlePreviousMonth}
            disabled={!canGoPrevious}
            aria-label="Previous month"
          />
          <span className={captionClass}>{formatMonthYear(month)}</span>
          <CalendarNavButton
            direction="right"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            aria-label="Next month"
          />
        </div>
        <DayPicker
          mode="single"
          selected={selected as Date | undefined}
          onSelect={date => onSelect(date)}
          month={month}
          onMonthChange={changeMonth}
          classNames={classNames}
          modifiers={{ todayTint: isUnclaimedToday }}
          modifiersClassNames={{ todayTint: todayClass }}
          showOutsideDays
          fixedWeeks
          disabled={disabledDays}
          locale={locale}
          hideNavigation
        />
      </div>
    );
  }

  // Range mode
  return (
    <div
      className={cn('overflow-hidden rounded-md border border-ods-border bg-ods-card', isFluid && 'w-full')}
      onMouseLeave={() => setHoveredDate(undefined)}
    >
      <style>{rangeStyles}</style>
      <div className="flex">
        {/* First month */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 pt-4">
            <CalendarNavButton
              direction="left"
              onClick={handlePreviousMonth}
              disabled={!canGoPrevious}
              aria-label="Previous month"
            />
            <span className={captionClass}>{formatMonthYear(month)}</span>
            {monthsToShow === 1 && (
              <CalendarNavButton
                direction="right"
                onClick={handleNextMonth}
                disabled={!canGoNext}
                aria-label="Next month"
              />
            )}
            {monthsToShow === 2 && <div className="size-10 md:size-12" />}
          </div>
          <DayPicker
            mode="range"
            selected={draftRange}
            onSelect={(_range, triggerDate) => handleRangeSelect(triggerDate)}
            onDayMouseEnter={day => setHoveredDate(day)}
            modifiers={{ preview: isPreviewDate, todayTint: isUnclaimedToday }}
            modifiersClassNames={{ preview: 'bg-ods-bg-surface', todayTint: todayClass }}
            month={month}
            onMonthChange={changeMonth}
            classNames={classNames}
            showOutsideDays
            fixedWeeks
            disabled={disabledDays}
            locale={locale}
            hideNavigation
          />
        </div>

        {/* Second month (if monthsToShow === 2) */}
        {monthsToShow === 2 && (
          <div className="flex-1 border-l border-ods-border">
            <div className="flex items-center justify-between px-4 pt-4">
              <div className="size-10 md:size-12" />
              <span className={captionClass}>{formatMonthYear(getSecondMonth(month))}</span>
              <CalendarNavButton
                direction="right"
                onClick={handleNextMonth}
                disabled={!canGoNext}
                aria-label="Next month"
              />
            </div>
            <DayPicker
              mode="range"
              selected={draftRange}
              onSelect={(_range, triggerDate) => handleRangeSelect(triggerDate)}
              onDayMouseEnter={day => setHoveredDate(day)}
              modifiers={{ preview: isPreviewDate, todayTint: isUnclaimedToday }}
              modifiersClassNames={{ preview: 'bg-ods-bg-surface', todayTint: todayClass }}
              month={getSecondMonth(month)}
              classNames={classNames}
              showOutsideDays
              fixedWeeks
              disabled={disabledDays}
              locale={locale}
              hideNavigation
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Trigger button styles (shared)
// ============================================================================

const triggerButtonStyles = cn(
  // Layout
  'flex w-full items-center gap-2',
  'h-11 rounded-[6px] border px-3 md:h-12',
  // Colors
  'border-ods-border bg-ods-card',
  // Typography
  'text-h4',
  // Hover & active (not disabled)
  'enabled:hover:border-ods-border-hover enabled:hover:bg-ods-bg-hover enabled:active:border-ods-border-active enabled:active:bg-ods-bg-active',
  'focus:outline-none',
  // Disabled - match Input exactly. The value/placeholder span inside sets its
  // own colour, so the child rule (higher specificity) greys it too. Scoped to
  // DIRECT children like every other field, so nested content that owns its
  // colour keeps it.
  'disabled:!cursor-not-allowed disabled:bg-ods-bg',
  'disabled:text-ods-text-disabled disabled:[&>span]:text-ods-text-disabled disabled:[&_svg]:text-ods-text-disabled',
  // Animation
  'transition-colors duration-200',
);

const timeSelectTriggerStyles = cn(
  'flex items-center justify-between gap-1',
  'h-11 min-h-0 rounded-[6px] border px-3 md:h-12',
  'border-ods-border bg-ods-card',
  'text-h4',
  'enabled:hover:border-ods-border-hover enabled:hover:bg-ods-bg-hover enabled:active:border-ods-border-active enabled:active:bg-ods-bg-active',
  'focus:outline-none',
  'disabled:!cursor-not-allowed disabled:bg-ods-bg',
  'disabled:text-ods-text-disabled disabled:[&>span]:text-ods-text-disabled disabled:[&_svg]:text-ods-text-disabled',
  'cursor-pointer transition-colors duration-200',
  'text-ods-text-primary',
);

// ============================================================================
// DatePicker Component
// ============================================================================

export function DatePicker(props: DatePickerProps) {
  const {
    placeholder = 'Select date',
    formatDate = defaultFormatDate,
    disabled = false,
    className,
    numberOfMonths = 1,
    fromDate,
    toDate,
    locale,
    label,
    error,
    invalid = false,
  } = props;

  const [open, setOpen] = useState(false);
  const isInvalid = invalid || !!error;

  const displayValue = useMemo(() => {
    if (props.mode === 'single') {
      return props.value ? formatDate(props.value) : '';
    }
    return formatDateRange(props.value, formatDate);
  }, [props.mode, props.value, formatDate]);

  const handleSelect = (value: Date | DateRange | undefined) => {
    if (props.mode === 'single') {
      props.onChange?.(value as Date | undefined);
      if (value) {
        setOpen(false);
      }
    } else {
      const range = value as DateRange | undefined;
      props.onChange?.(range);
      if (range?.from && range?.to) {
        setOpen(false);
      }
    }
  };

  const picker = (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          // Same marker Input/Textarea/Select expose — it is how a form finds
          // (and scrolls to) the first field that failed validation.
          data-invalid={isInvalid || undefined}
          className={cn(
            triggerButtonStyles,
            'group',
            open && !isInvalid && 'border-ods-accent enabled:hover:border-ods-accent enabled:hover:bg-ods-card',
            isInvalid && 'border-ods-error enabled:hover:border-ods-error enabled:hover:bg-ods-card',
            className,
          )}
        >
          <Calendar className="size-6 shrink-0 text-ods-text-secondary" />
          <span
            className={cn(
              'flex-1 truncate text-left',
              displayValue ? 'text-ods-text-primary' : 'text-ods-text-secondary',
            )}
          >
            {displayValue || placeholder}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-[9999]',
            'animate-in fade-in-0 zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=top]:slide-in-from-bottom-2',
          )}
          sideOffset={8}
          align="start"
        >
          <DatePickerCalendar
            mode={props.mode}
            selected={props.value}
            onSelect={handleSelect}
            numberOfMonths={numberOfMonths}
            fromDate={fromDate}
            toDate={toDate}
            locale={locale}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  return (
    <FieldWrapper label={label} error={error}>
      {picker}
    </FieldWrapper>
  );
}

// ============================================================================
// DatePickerInput Component (with time selector styling from Figma)
// ============================================================================

export interface DatePickerInputProps extends DatePickerBaseProps {
  mode?: 'single';
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  /** Show time selector next to date */
  showTime?: boolean;
  /** Use 24-hour format instead of 12-hour */
  use24HourFormat?: boolean;
}

// Generate hour options
const generateHourOptions = (use24Hour: boolean): string[] => {
  if (use24Hour) {
    return Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  }
  return Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
};

// Generate minute options (00, 01, 02, ... 59)
const generateMinuteOptions = (): string[] => {
  return Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
};

export function DatePickerInput({
  placeholder = 'Select date',
  formatDate = defaultFormatDate,
  disabled = false,
  className,
  numberOfMonths = 1,
  fromDate,
  toDate,
  locale,
  value,
  onChange,
  showTime = false,
  use24HourFormat = false,
  label,
  error,
  invalid = false,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false);
  const isInvalid = invalid || !!error;

  const displayValue = value ? formatDate(value) : '';

  // Extract time from value
  const hour = useMemo(() => {
    if (!value) return '';
    const hours = value.getHours();
    if (use24HourFormat) {
      return hours.toString().padStart(2, '0');
    }
    const hour12 = hours % 12 || 12;
    return hour12.toString().padStart(2, '0');
  }, [value, use24HourFormat]);

  const minute = useMemo(() => {
    if (!value) return '';
    return value.getMinutes().toString().padStart(2, '0');
  }, [value]);

  const period = useMemo((): 'AM' | 'PM' => {
    if (!value) return 'AM';
    return value.getHours() >= 12 ? 'PM' : 'AM';
  }, [value]);

  const handleSelect = (date: Date | DateRange | undefined) => {
    const newDate = date as Date | undefined;
    if (newDate && value) {
      // Preserve time when selecting a new date
      newDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
    }
    onChange?.(newDate);
    if (newDate) {
      setOpen(false);
    }
  };

  const handleHourChange = (newHour: string) => {
    const date = value ? new Date(value) : new Date();
    let hours = parseInt(newHour, 10);
    if (!use24HourFormat) {
      const isPM = period === 'PM';
      if (hours === 12) {
        hours = isPM ? 12 : 0;
      } else {
        hours = isPM ? hours + 12 : hours;
      }
    }
    date.setHours(hours);
    onChange?.(date);
  };

  const handleMinuteChange = (newMinute: string) => {
    const date = value ? new Date(value) : new Date();
    date.setMinutes(parseInt(newMinute, 10));
    onChange?.(date);
  };

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    const date = value ? new Date(value) : new Date();
    let hours = date.getHours();
    if (newPeriod === 'AM' && hours >= 12) {
      hours -= 12;
    } else if (newPeriod === 'PM' && hours < 12) {
      hours += 12;
    }
    date.setHours(hours);
    onChange?.(date);
  };

  const hourOptions = useMemo(() => generateHourOptions(use24HourFormat), [use24HourFormat]);
  const minuteOptions = useMemo(() => generateMinuteOptions(), []);

  const content = (
    <div className={cn('flex items-center gap-2', !label && !error && className)}>
      {/* Date Picker */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            // Same marker Input/Textarea/Select expose — it is how a form finds
            // (and scrolls to) the first field that failed validation.
            data-invalid={isInvalid || undefined}
            className={cn(
              triggerButtonStyles,
              'group',
              open && !isInvalid && 'border-ods-accent enabled:hover:border-ods-accent enabled:hover:bg-ods-card',
              isInvalid && 'border-ods-error enabled:hover:border-ods-error enabled:hover:bg-ods-card',
              'flex-1',
            )}
          >
            <Calendar className="size-6 shrink-0 text-ods-text-secondary" />
            <span
              className={cn(
                'flex-1 truncate text-left',
                displayValue ? 'text-ods-text-primary' : 'text-ods-text-secondary',
              )}
            >
              {displayValue || placeholder}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              'z-[9999]',
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-2',
              'data-[side=top]:slide-in-from-bottom-2',
            )}
            sideOffset={8}
            align="start"
          >
            <DatePickerCalendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              numberOfMonths={numberOfMonths}
              fromDate={fromDate}
              toDate={toDate}
              locale={locale}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Time Selects (optional) */}
      {showTime && (
        <div className="flex items-center gap-1">
          {/* Hour Select */}
          <Select value={hour} onValueChange={handleHourChange} disabled={disabled}>
            <SelectTrigger className={cn(timeSelectTriggerStyles, 'w-[80px]')}>
              <SelectValue placeholder="HH" />
            </SelectTrigger>
            <SelectContent>
              {hourOptions.map(h => (
                <SelectItem key={h} value={h}>
                  {h}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-ods-text-secondary text-h4">:</span>

          {/* Minute Select */}
          <Select value={minute} onValueChange={handleMinuteChange} disabled={disabled}>
            <SelectTrigger className={cn(timeSelectTriggerStyles, 'w-[80px]')}>
              <SelectValue placeholder="MM" />
            </SelectTrigger>
            <SelectContent>
              {minuteOptions.map(m => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* AM/PM Select (only for 12-hour format) */}
          {!use24HourFormat && (
            <Select value={period} onValueChange={val => handlePeriodChange(val as 'AM' | 'PM')} disabled={disabled}>
              <SelectTrigger className={cn(timeSelectTriggerStyles, 'w-[80px]')}>
                <SelectValue placeholder="AM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );

  return (
    <FieldWrapper label={label} error={error} className={className}>
      {content}
    </FieldWrapper>
  );
}

// ============================================================================
// DatePickerInputSimple Component (with single time selector)
// ============================================================================

export interface DatePickerInputSimpleProps extends DatePickerBaseProps {
  mode?: 'single';
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  /** Show time selector next to date */
  showTime?: boolean;
  /** Time interval in minutes (default: 30) */
  timeInterval?: number;
  /** Use 24-hour format instead of 12-hour */
  use24HourFormat?: boolean;
}

// Generate time options with specified interval
const generateTimeOptions = (intervalMinutes: number, use24Hour: boolean): { value: string; label: string }[] => {
  const options: { value: string; label: string }[] = [];
  const totalMinutesInDay = 24 * 60;

  for (let minutes = 0; minutes < totalMinutesInDay; minutes += intervalMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    const value = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;

    let label: string;
    if (use24Hour) {
      label = value;
    } else {
      const hour12 = hours % 12 || 12;
      const period = hours >= 12 ? 'PM' : 'AM';
      label = `${hour12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${period}`;
    }

    options.push({ value, label });
  }

  return options;
};

export function DatePickerInputSimple({
  placeholder = 'Select date',
  formatDate = defaultFormatDate,
  disabled = false,
  className,
  numberOfMonths = 1,
  fromDate,
  toDate,
  locale,
  value,
  onChange,
  showTime = false,
  timeInterval = 30,
  use24HourFormat = false,
  label,
  error,
  invalid = false,
}: DatePickerInputSimpleProps) {
  const [open, setOpen] = useState(false);
  const isInvalid = invalid || !!error;

  const displayValue = value ? formatDate(value) : '';

  // Get current time value as HH:MM string
  const timeValue = useMemo(() => {
    if (!value) return '';
    const hours = value.getHours();
    const minutes = value.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }, [value]);

  // Get display label for current time
  const timeDisplayLabel = useMemo(() => {
    if (!value) return '';
    const hours = value.getHours();
    const minutes = value.getMinutes();

    if (use24HourFormat) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    const hour12 = hours % 12 || 12;
    const period = hours >= 12 ? 'PM' : 'AM';
    return `${hour12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  }, [value, use24HourFormat]);

  const handleSelect = (date: Date | DateRange | undefined) => {
    const newDate = date as Date | undefined;
    if (newDate && value) {
      // Preserve time when selecting a new date
      newDate.setHours(value.getHours(), value.getMinutes(), 0, 0);
    }
    onChange?.(newDate);
    if (newDate) {
      setOpen(false);
    }
  };

  const handleTimeChange = (newTime: string) => {
    const [hours, minutes] = newTime.split(':').map(Number);
    const date = value ? new Date(value) : new Date();
    date.setHours(hours, minutes, 0, 0);
    onChange?.(date);
  };

  const timeOptions = useMemo(
    () => generateTimeOptions(timeInterval, use24HourFormat),
    [timeInterval, use24HourFormat],
  );

  const content = (
    <div className={cn('flex items-center gap-2', !label && !error && className)}>
      {/* Date Picker */}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            // Same marker Input/Textarea/Select expose — it is how a form finds
            // (and scrolls to) the first field that failed validation.
            data-invalid={isInvalid || undefined}
            className={cn(
              triggerButtonStyles,
              'group',
              open && !isInvalid && 'border-ods-accent enabled:hover:border-ods-accent enabled:hover:bg-ods-card',
              isInvalid && 'border-ods-error enabled:hover:border-ods-error enabled:hover:bg-ods-card',
              'flex-1',
            )}
          >
            <Calendar className="size-6 shrink-0 text-ods-text-secondary" />
            <span
              className={cn(
                'flex-1 truncate text-left',
                displayValue ? 'text-ods-text-primary' : 'text-ods-text-secondary',
              )}
            >
              {displayValue || placeholder}
            </span>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className={cn(
              'z-[9999]',
              'animate-in fade-in-0 zoom-in-95',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              'data-[side=bottom]:slide-in-from-top-2',
              'data-[side=top]:slide-in-from-bottom-2',
            )}
            sideOffset={8}
            align="start"
          >
            <DatePickerCalendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              numberOfMonths={numberOfMonths}
              fromDate={fromDate}
              toDate={toDate}
              locale={locale}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Single Time Select (optional) */}
      {showTime && (
        <Select value={timeValue} onValueChange={handleTimeChange} disabled={disabled}>
          <SelectTrigger className={cn(timeSelectTriggerStyles, 'flex-1')}>
            <SelectValue placeholder="Select time">{timeDisplayLabel || 'Select time'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {timeOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );

  return (
    <FieldWrapper label={label} error={error} className={className}>
      {content}
    </FieldWrapper>
  );
}

// ============================================================================
// DateFilterPanel Component (sort select + fluid calendar)
// ============================================================================

export interface DateFilterPanelProps {
  /** Selection mode for the calendar. Defaults to "range". */
  mode?: DatePickerMode;
  /** Current sort direction shown in the select. */
  sort: SortDirection;
  onSortChange: (sort: SortDirection) => void;
  /** Current calendar selection. */
  selected: Date | DateRange | undefined;
  onSelect: (value: Date | DateRange | undefined) => void;
  /** Minimum selectable date. */
  fromDate?: Date;
  /** Maximum selectable date. */
  toDate?: Date;
  /** Locale for the calendar. */
  locale?: DayPickerProps['locale'];
  /** Label for the ascending sort option. */
  ascLabel?: string;
  /** Label for the descending sort option. */
  descLabel?: string;
  className?: string;
}

/**
 * DateFilterPanel — the controlled sort-direction select + fluid calendar
 * block shared by DateFilterMenu (popover) and FilterModal (mobile "Sort and
 * Filter"). Owns no state: the consumer drafts and commits the values.
 */
export function DateFilterPanel({
  mode = 'range',
  sort,
  onSortChange,
  selected,
  onSelect,
  fromDate,
  toDate,
  locale,
  ascLabel = 'Sort by Ascending',
  descLabel = 'Sort by Descending',
  className,
}: DateFilterPanelProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Sort direction selector */}
      <Select value={sort} onValueChange={value => onSortChange(value as SortDirection)}>
        <SelectTrigger className="gap-2" aria-label="Sort direction">
          {/* Wrapper is a <div> (not <span>) so SelectTrigger's
              `[&>span]:line-clamp-1` rule doesn't force it to a vertical
              -webkit-box and stack the icon/label into a column. */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ArrowUpDown className="size-6 shrink-0 text-ods-text-secondary" />
            <span className="truncate">
              <SelectValue />
            </span>
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="asc">{ascLabel}</SelectItem>
          <SelectItem value="desc">{descLabel}</SelectItem>
        </SelectContent>
      </Select>

      {/* Calendar */}
      <DatePickerCalendar
        mode={mode}
        selected={selected}
        onSelect={onSelect}
        numberOfMonths={1}
        fromDate={fromDate}
        toDate={toDate}
        locale={locale}
        fluid
      />
    </div>
  );
}

// ============================================================================
// DateFilterMenu Component (sort + calendar filter popover from Figma)
// ============================================================================

export interface DateFilterResult {
  /** Selected sort direction */
  sort: SortDirection;
  /** Selected single date (mode === "single") */
  date?: Date;
  /** Selected date range (mode === "range") */
  range?: DateRange;
}

export interface DateFilterMenuProps {
  /** Selection mode for the calendar. Defaults to "range". */
  mode?: DatePickerMode;
  /** Current (applied) sort direction. Defaults to "desc". */
  sort?: SortDirection;
  /** Baseline sort direction — Reset restores it, and a draft that differs
   *  from it counts as an active change (shows Reset). Defaults to "desc". */
  defaultSort?: SortDirection;
  /** Current (applied) single date — used when mode === "single". */
  date?: Date;
  /** Current (applied) range — used when mode === "range". */
  range?: DateRange;
  /** Fired when the user presses Apply with the drafted selection. Also fired
   *  by Reset with a cleared selection so the consumer refetches unfiltered data. */
  onApply?: (result: DateFilterResult) => void;
  /** Fired when the menu closes (Close button, outside click, Esc). */
  onClose?: () => void;
  /** Custom trigger element (rendered via Radix `asChild` — must accept a ref,
   *  e.g. a native button). Defaults to the outline calendar icon Button. */
  trigger?: ReactNode;
  /** Disable the trigger. */
  disabled?: boolean;
  /** Minimum selectable date. */
  fromDate?: Date;
  /** Maximum selectable date. */
  toDate?: Date;
  /** Locale for the calendar. */
  locale?: DayPickerProps['locale'];
  /** Popover alignment relative to the trigger. */
  align?: 'start' | 'center' | 'end';
  /** Label for the ascending sort option. */
  ascLabel?: string;
  /** Label for the descending sort option. */
  descLabel?: string;
  /** Additional class name for the trigger button. */
  className?: string;
  /** Accessible label for the trigger. */
  'aria-label'?: string;
}

/**
 * DateFilterMenu — a calendar-icon-triggered popover combining a sort-direction
 * selector and a date / date-range calendar, with Close/Reset and Apply actions.
 * The sort and date selection are drafted internally and committed via
 * `onApply`. While a date is selected, Close is replaced by Reset, which
 * clears and commits the empty selection (fires `onApply`) so the consumer
 * drops the filter.
 */
export function DateFilterMenu({
  mode = 'range',
  sort = 'desc',
  defaultSort = 'desc',
  date,
  range,
  onApply,
  onClose,
  trigger,
  disabled = false,
  fromDate,
  toDate,
  locale,
  align = 'start',
  ascLabel = 'Sort by Ascending',
  descLabel = 'Sort by Descending',
  className,
  'aria-label': ariaLabel = 'Open date filter',
}: DateFilterMenuProps) {
  const [open, setOpen] = useState(false);

  // Drafted selection — initialized from props each time the menu opens.
  const [draftSort, setDraftSort] = useState<SortDirection>(sort);
  const [draftSelected, setDraftSelected] = useState<Date | DateRange | undefined>(mode === 'single' ? date : range);

  const resetDraft = useCallback(() => {
    setDraftSort(sort);
    setDraftSelected(mode === 'single' ? date : range);
  }, [sort, date, range, mode]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      resetDraft();
    } else {
      onClose?.();
    }
    setOpen(next);
  };

  const handleApply = () => {
    const result: DateFilterResult =
      mode === 'single'
        ? { sort: draftSort, date: draftSelected as Date | undefined }
        : { sort: draftSort, range: draftSelected as DateRange | undefined };
    onApply?.(result);
    setOpen(false);
  };

  const handleClose = () => {
    onClose?.();
    setOpen(false);
  };

  // Anything to reset? A calendar selection or a non-default sort — drives Close vs Reset.
  const hasSelection =
    mode === 'single' ? Boolean(draftSelected) : Boolean((draftSelected as DateRange | undefined)?.from);
  const hasChanges = hasSelection || draftSort !== defaultSort;

  // Reset restores the defaults and commits them so the consumer drops the
  // filter and refetches; the menu stays open with the button back to Close.
  const handleReset = () => {
    setDraftSort(defaultSort);
    setDraftSelected(undefined);
    onApply?.(mode === 'single' ? { sort: defaultSort, date: undefined } : { sort: defaultSort, range: undefined });
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label={ariaLabel}
            className={className}
            leftIcon={<Calendar className="size-6" />}
          />
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className={cn(
            'z-[9999] w-80 max-w-[calc(100vw-2rem)]',
            'flex flex-col gap-4 rounded-[6px] border border-ods-border bg-ods-bg p-4',
            'animate-in fade-in-0 zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
            'data-[side=bottom]:slide-in-from-top-2',
            'data-[side=top]:slide-in-from-bottom-2',
          )}
          sideOffset={8}
          align={align}
        >
          {/* Sort + calendar (shared panel) */}
          <DateFilterPanel
            mode={mode}
            sort={draftSort}
            onSortChange={setDraftSort}
            selected={draftSelected}
            onSelect={setDraftSelected}
            fromDate={fromDate}
            toDate={toDate}
            locale={locale}
            ascLabel={ascLabel}
            descLabel={descLabel}
          />

          {/* Actions */}
          <div className="flex w-full items-stretch gap-4">
            <Button type="button" variant="outline" fullWidth onClick={hasChanges ? handleReset : handleClose}>
              {hasChanges ? 'Reset' : 'Close'}
            </Button>
            <Button type="button" variant="accent" fullWidth onClick={handleApply}>
              Apply
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

// ============================================================================
// Exports
// ============================================================================

export { type DateRange };
