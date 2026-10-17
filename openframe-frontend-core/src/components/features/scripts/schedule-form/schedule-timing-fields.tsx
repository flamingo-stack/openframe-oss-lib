'use client';
'use no memo';

import { useCallback, useMemo } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { cn } from '../../../../utils/cn';
import { XmarkCircleIcon } from '../../../icons-v2-generated/signs-and-symbols/xmark-circle-icon';
import { CheckboxBlock } from '../../../ui/checkbox-block';
import { DatePickerInputSimple } from '../../../ui/date-picker';
import { Label } from '../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { SCHEDULE_TIME_REFERENCE, type ScheduleTimeReference } from './schedule-enums';
import {
  SCHEDULE_TIME_REFERENCE_OPTIONS,
  type ScheduleFormData,
  type ScheduleFormGate,
  type ScheduleTimeSlot,
} from './schedule-form-types';
import { ScheduleIntervalInput } from './schedule-interval-input';
import {
  DURATION_UNIT_OPTIONS,
  DURATION_UNIT_VALUES,
  earliestScheduleDay,
  getTimeSlotOptions,
  isEventTrigger,
  isScheduleStartInPast,
  isSlotOnGrid,
  isStartInPastAndChanged,
  MIN_REPEAT_MINUTES,
  NO_SLOTS_TODAY_MESSAGE,
  PAST_START_MESSAGE,
  slotToLabel,
  snapRepeatInterval,
} from './schedule-timing';

export interface ScheduleTimingFieldsProps {
  showErrors: boolean;
  disabled?: boolean;
  /**
   * Whether the Timezone picker is offered. It is a layout switch (it turns one
   * row into two), so a host that reads it from a flag passes the flag's GATE.
   * Default `off`.
   */
  timeReferenceGate?: ScheduleFormGate;
  /**
   * The Time dropdown's options for a picked day and reading. Default
   * `getTimeSlotOptions`: the viewer's own clock and locale. A picture of the
   * form passes fixed readings, so a server and a browser draw the same one.
   */
  getTimeSlots?: (date: Date | null, timeReference: ScheduleTimeReference) => ScheduleTimeSlot[];
}

/**
 * Date | Time | Timezone | Repeat | Repeat in — the timing a DATE_TIME schedule
 * fires on.
 *
 * `scheduledDate` + `scheduledTime` combine into the backend's `startAt` (30-min
 * boundary, enforced by the Time slots) and are both required; the repeat toggle
 * + interval + unit become `repeat` seconds.
 *
 * **Timezone** (`timeReference`, design node 793:61340) says what that pair
 * MEANS — the account's clock (SERVER, one instant worldwide) or each device's
 * (DEVICE_LOCAL, one reading re-based per device). It is behind the
 * host's `timeReferenceGate` (the product's `script-schedule-device-time`
 * flag), and it is the field that makes this a
 * five-control row: with the picker on, the design wraps Repeat onto a second
 * line, which is why the row is a 4-column GRID rather than the flex row it
 * used to be — the wrap is then a `col-start-1` on one cell instead of a second
 * layout.
 *
 * Recurrence stays OFFERED for DEVICE_LOCAL — "every day at 9 AM on each
 * device's own clock" is the reason the reading exists — even though the API
 * refuses it today ("A DEVICE_LOCAL schedule does not support repeat **yet**",
 * `ScheduleScriptService.validateTiming`). Saving one is answered by that
 * message in the error toast until the backend drops the check; nothing here
 * has to change when it does. Its offline setting is refused the same way and
 * IS hidden, because that one is not merely unimplemented: the device-local
 * runner already retries on reconnect within its catch-up window, so the
 * setting would have nothing to add — see `ScheduleOfflineFields`.
 *
 * What it does NOT constrain is the clock. The picked pair is a wall clock every
 * device reads on its own timezone, so the viewer's "already gone by" says
 * nothing about the fleet's: all 48 slots stay offered, the past-start rule is
 * off, and the only bound left is the day one (`earliestScheduleDay` — today as
 * read in UTC−12). The API validates no start against the past either, for
 * either reading.
 *
 * Only DATE_TIME schedules have timing, so the row collapses when the event
 * trigger is picked. It stays MOUNTED (a toggle back restores what was typed)
 * and animates with the `0fr → 1fr` grid-rows technique — the portable way to
 * transition to an intrinsic height, since `interpolate-size` / `calc-size()`
 * still aren't cross-browser. `inert` drops the collapsed fields out of the tab
 * order and the accessibility tree.
 *
 * The `overflow-hidden` the technique requires also clips anything hanging below
 * the fields — and field errors are absolutely positioned there (out of flow, so
 * showing one never reflows the form). The bottom padding is the room they render
 * into; the constant negative margin cancels it again, so the spacing below the
 * row is unchanged and a COLLAPSED row leaves no 24px hole.
 *
 * That padding sits on the field row INSIDE the clipping box, not on the box
 * itself, and the difference is load-bearing: a box is never shorter than its own
 * padding — `border-box` does not change that, it only decides what a specified
 * height includes — so padding on the grid item survives the 0fr track as 24px of
 * residue. The negative margin then spends itself cancelling that instead of
 * closing the section gap, and the collapsed row leaves the hole this was written
 * to avoid. Nested one level down it is clipped like everything else, and the row
 * measures 0.
 */
export function ScheduleTimingFields({
  showErrors,
  disabled = false,
  timeReferenceGate = 'off',
  getTimeSlots = getTimeSlotOptions,
}: ScheduleTimingFieldsProps) {
  const { control, getValues, setValue, trigger: triggerValidation } = useFormContext<ScheduleFormData>();

  // The Timezone picker is a layout switch — it turns one row into two — so the
  // flag is read as a GATE and the unanswered window is not guessed at. There is
  // nothing to draw for it (a picker shown and then withdrawn is exactly what a
  // both-directions gate must not do), so the window is spent with the row
  // LOCKED instead: the same treatment the page already gives fields whose
  // record has not landed, and it means the control cannot appear beside a
  // choice the user has already made.
  const showTimeReference = timeReferenceGate === 'on';
  const fieldsDisabled = disabled || timeReferenceGate === 'loading';

  /**
   * Re-checks the reconnect window after the cadence moves.
   *
   * The rule "the window must be shorter than the cadence" is attached to
   * `reconnectInterval`, and react-hook-form only refreshes the error of the
   * field that just fired an event — so fixing the CADENCE left the complaint
   * sitting under the offline block until the next Save, pointing at a value
   * that was already legal.
   *
   * Called on the cadence's blur and on its two discrete controls, never
   * per-keystroke: the half-typed "6" of "60" is briefly shorter than the
   * window, and grading it would flash an error at a number still being
   * written. Silent until the first Save, like every other rule here.
   */
  const recheckReconnectWindow = useCallback(() => {
    if (showErrors) void triggerValidation('reconnectInterval');
  }, [showErrors, triggerValidation]);
  const trigger = useWatch({ control, name: 'trigger' });
  const repeatEnabled = useWatch({ control, name: 'repeatEnabled' });
  const repeatUnit = useWatch({ control, name: 'repeatUnit' });
  const scheduledDate = useWatch({ control, name: 'scheduledDate' });
  const scheduledTime = useWatch({ control, name: 'scheduledTime' });
  const timeReference = useWatch({ control, name: 'timeReference' });
  const eventDriven = isEventTrigger(trigger);
  // Minutes are the one unit that can express a cadence finer than the runner's
  // 30-minute grid, so they are the one unit the stepper has to constrain — it
  // then produces only legal values, and the schema rule behind it is left to
  // catch typed-in ones.
  const intervalStep = repeatUnit === 'minute' ? MIN_REPEAT_MINUTES : 1;
  // Local slots, so the grid depends on the viewer's timezone — built per mount
  // rather than at import time, which would happen on the server, and rebuilt
  // per picked DAY because today offers only the slots still ahead.
  //
  // A stored start that has already gone by today keeps its option: it is the
  // value the form holds and will save if nothing else changes, and a Select
  // whose value is missing from its list renders as the placeholder — the field
  // would read empty on a schedule that has a perfectly good start time.
  //
  // The grid itself also depends on the READING: a DEVICE_LOCAL start stores its
  // wall clock verbatim, so the boundary applies to the picked digits and the
  // slots are the plain xx:00 / xx:30 — which differs from the SERVER grid in
  // the 45-minute zones, and only there.
  const timeSlots = useMemo(() => {
    const slots = getTimeSlots(scheduledDate, timeReference);
    if (!scheduledTime || slots.some(slot => slot.value === scheduledTime)) return slots;
    return [{ value: scheduledTime, label: slotToLabel(scheduledTime) }, ...slots];
  }, [getTimeSlots, scheduledDate, scheduledTime, timeReference]);
  // Today, recomputed per mount so a tab left open overnight cannot still treat
  // yesterday as selectable. Handed to the picker as `fromDate`, which greys out
  // every earlier day and stops the calendar paging past it.
  //
  // ⚠ Requires a core library that TRANSLATES that prop. Up to and including
  // 0.0.514 the calendar forwarded it straight to react-day-picker v9, where
  // `fromDate` was removed — the bound was silently dropped and past days stayed
  // clickable. Fixed in core (`DatePickerCalendar` maps it to a `disabled`
  // matcher); if this app is ever pinned back below that release, the two rules
  // below are what still hold the line.
  //
  // They are not a fallback in any case: a disabled day cannot stop the clock
  // from passing the SLOT this form already holds, and the seeded value never
  // went through the calendar at all.
  //
  // DEVICE_LOCAL moves the bound west instead of dropping it: a wall clock is
  // gone only once it is gone on every clock on Earth, so the floor is today as
  // read in UTC−12 (`earliestScheduleDay`). Depends on the reading, so it is
  // rebuilt when that changes — and on nothing else, so a tab left open still
  // cannot walk the bound backwards past its own mount.
  const minDate = useMemo(() => earliestScheduleDay(timeReference), [timeReference]);

  /**
   * Moving the DAY can invalidate the time already chosen: 8:00 AM is a fine
   * slot for tomorrow and a gone one for today. The dropdown stops offering it,
   * so a stale value would sit in the form as an empty-looking Select that fails
   * validation on Save — clear it instead, and let the user re-pick from what
   * the new day actually has. A day that keeps the slot keeps the value.
   *
   * Only for a day that is itself selectable: on a PAST day every slot is in the
   * past, and clearing the time there would replace the real complaint ("that
   * day has gone") with a second, misleading one ("pick a time").
   *
   * Never for DEVICE_LOCAL — no slot of a selectable day is withheld there, so
   * moving the day cannot invalidate the time (`isScheduleStartInPast` answers
   * false, which is what makes this a no-op rather than a second condition).
   */
  const handleDateChange = useCallback(
    (onChange: (date: Date | null) => void, date: Date | null) => {
      onChange(date);
      const time = getValues('scheduledTime');
      if (date && time && date >= minDate && isScheduleStartInPast(date, time, getValues('timeReference')))
        setValue('scheduledTime', '');
    },
    [getValues, setValue, minDate],
  );

  /**
   * Switching the reading can invalidate the time already picked: the two do not
   * share a slot grid in the 45-minute zones (see `getTimeSlotOptions`), so a
   * value the dropdown no longer lists would sit in the form as an empty-looking
   * Select that fails on Save. Cleared for the same reason a day change clears
   * it — and asked of the GRID, not of the option list, so a stored slot that
   * has merely gone by is left alone.
   *
   * Nothing else is reset. Recurrence and the offline rule survive the switch:
   * "every day, on each device's own clock" is a setting the user meant, not a
   * leftover, and the API refusing it today is a message on Save rather than a
   * reason to silently undo a choice.
   */
  const handleTimeReferenceChange = useCallback(
    (onChange: (next: ScheduleTimeReference) => void, next: ScheduleTimeReference) => {
      onChange(next);
      const time = getValues('scheduledTime');
      if (time && !isSlotOnGrid(time, next)) setValue('scheduledTime', '');
    },
    [getValues, setValue],
  );

  // Shown IMMEDIATELY, unlike every other rule on this form, which waits for
  // Save: the calendar cannot withhold a past day itself (see `minDate`), so a
  // picked one has to say so at once rather than look accepted until Save
  // refuses it. Same predicate the schema uses — stored past starts exempt — so
  // the field and the save can never disagree.
  const startAtStored = useWatch({ control, name: 'startAtStored' });
  const startsInPast =
    !eventDriven && isStartInPastAndChanged(scheduledDate, scheduledTime, startAtStored, timeReference);
  // On the field the user can act on: a past DAY is the date's problem, a past
  // slot of today is the time's.
  const pastDateError = startsInPast && scheduledDate && scheduledDate < minDate ? PAST_START_MESSAGE : undefined;
  const pastTimeError = startsInPast && !pastDateError ? PAST_START_MESSAGE : undefined;

  /**
   * Today, picked after its last slot has gone by: `timeSlots` is empty and the
   * Time dropdown has nothing to give. Reported on the DATE — that is the field
   * the user has to move — and shown immediately, for the same reason
   * `pastDateError` is: the calendar accepted the day, so nothing else says it
   * cannot work until Save refuses it for a missing time.
   *
   * `timeSlots` is only ever empty in this exact case. A future day keeps all 48
   * slots, a PAST day keeps them too, and a stored slot that has gone by is
   * re-added above — so an empty list means today, and no way to finish.
   */
  const noSlotsLeftToday = !eventDriven && timeSlots.length === 0;
  const dateError = pastDateError ?? (noSlotsLeftToday ? NO_SLOTS_TODAY_MESSAGE : undefined);

  return (
    <div
      inert={eventDriven}
      style={{
        gridTemplateRows: eventDriven ? '0fr' : '1fr',
        opacity: eventDriven ? 0 : 1,
      }}
      className="mb-[calc(-1*var(--spacing-system-lf))] grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
    >
      <div className="min-h-0 overflow-hidden">
        {/* Four equal columns, as the design lays them out. A grid rather than a
            flex row because the Timezone picker makes it five cells: the wrap is
            then the one `col-start-1` below, and both layouts are the same
            markup. */}
        <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] pb-[var(--spacing-system-lf)] content-md:grid-cols-4 content-md:items-end">
          <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Date</Label>
            <Controller
              name="scheduledDate"
              control={control}
              render={({ field, fieldState }) => (
                // The core picker has no clear affordance, so the design's xmark
                // rides on top of the trigger's free right edge.
                <div className="relative">
                  <DatePickerInputSimple
                    placeholder="Select date"
                    value={field.value ?? undefined}
                    onChange={date => handleDateChange(field.onChange, date ?? null)}
                    // No day before today: a schedule cannot start in the past.
                    fromDate={minDate}
                    disabled={fieldsDisabled}
                    className="w-full"
                    error={dateError ?? (showErrors ? fieldState.error?.message : undefined)}
                    invalid={!!dateError || (showErrors && !!fieldState.error)}
                  />
                  {field.value && !fieldsDisabled && (
                    <button
                      type="button"
                      onClick={() => field.onChange(null)}
                      aria-label="Clear date"
                      className="absolute right-3 top-6 -translate-y-1/2 text-ods-text-secondary hover:text-ods-text-primary"
                    >
                      <XmarkCircleIcon size={24} />
                    </button>
                  )}
                </div>
              )}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Time</Label>
            <Controller
              name="scheduledTime"
              control={control}
              render={({ field, fieldState }) => (
                // `''` reads as "no selection" to Radix, so the placeholder shows
                // until a slot is picked — a date at midnight no longer
                // masquerades as a chosen 12:00 AM.
                <Select value={field.value} onValueChange={field.onChange} disabled={fieldsDisabled}>
                  {/* No `border-ods-border` here: the trigger already sets it, and
                      a repeat of it in `className` lands AFTER the invalid branch
                      in the component's `cn()`, so tailwind-merge would drop the
                      error border. */}
                  <SelectTrigger
                    className="w-full"
                    error={pastTimeError ?? (showErrors ? fieldState.error?.message : undefined)}
                    invalid={!!pastTimeError || (showErrors && !!fieldState.error)}
                  >
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.length === 0 ? (
                      // Deliberately NOT a `SelectItem` — there is nothing here
                      // to select, and a selectable row would put a bogus value
                      // in the form. It replaces a popup that opened blank; the
                      // Date field carries the same sentence for whoever never
                      // opens this one.
                      <p className="px-4 py-[var(--spacing-system-sf)] text-ods-text-secondary text-h6">
                        {NO_SLOTS_TODAY_MESSAGE}
                      </p>
                    ) : (
                      timeSlots.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {showTimeReference && (
            <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
              <Label className="text-h4">Timezone</Label>
              <Controller
                name="timeReference"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    // Radix hands over a plain string; only an option's value is taken.
                    onValueChange={value => {
                      const next = Object.values(SCHEDULE_TIME_REFERENCE).find(reference => reference === value);
                      if (next) handleTimeReferenceChange(field.onChange, next);
                    }}
                    disabled={fieldsDisabled}
                  >
                    {/* No placeholder: the field always holds one of the two
                        readings — SERVER is the default a schedule carries when
                        nothing was picked, not an empty state. */}
                    <SelectTrigger className="w-full" aria-label="Timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCHEDULE_TIME_REFERENCE_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {/* Back to column 1 when the Timezone picker took the third: the
              design wraps Repeat onto its own line rather than squeezing five
              controls into four columns. */}
          <div className={cn('min-w-0', showTimeReference && 'content-md:col-start-1')}>
            <Controller
              name="repeatEnabled"
              control={control}
              render={({ field }) => (
                <CheckboxBlock
                  label="Repeat Script Run"
                  checked={field.value}
                  onCheckedChange={next => {
                    field.onChange(next);
                    // Turning recurrence off removes the cadence the window is
                    // measured against, so the rule stops applying entirely.
                    recheckReconnectWindow();
                  }}
                  disabled={fieldsDisabled}
                  className="w-full"
                />
              )}
            />
          </div>

          <div className="flex min-w-0 items-end gap-[var(--spacing-system-xs)]">
            <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
              <Label className="text-h4">Repeat in</Label>
              <Controller
                name="repeatInterval"
                control={control}
                render={({ field, fieldState }) => (
                  <ScheduleIntervalInput
                    min={intervalStep}
                    className="w-full"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={() => {
                      field.onBlur();
                      recheckReconnectWindow();
                    }}
                    disabled={fieldsDisabled || !repeatEnabled}
                    error={showErrors ? fieldState.error?.message : undefined}
                    invalid={showErrors && !!fieldState.error}
                  />
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Controller
                name="repeatUnit"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    // Switching TO minutes drags the interval up onto the grid
                    // with it: "1 Day" would otherwise become "1 Minute", a
                    // value the user never typed and the form cannot save. The
                    // other direction needs nothing — every coarser unit is
                    // already a whole number of slots at any interval.
                    onValueChange={value => {
                      const next = DURATION_UNIT_VALUES.find(unit => unit === value);
                      if (!next) return;
                      field.onChange(next);
                      const snapped = snapRepeatInterval(getValues('repeatInterval'), next);
                      if (snapped !== getValues('repeatInterval')) setValue('repeatInterval', snapped);
                      recheckReconnectWindow();
                    }}
                    disabled={fieldsDisabled || !repeatEnabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_UNIT_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
