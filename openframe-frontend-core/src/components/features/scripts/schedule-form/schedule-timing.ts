import { formatTime } from '../../../../utils/format-date';
import {
  SCHEDULE_OFFLINE_BEHAVIOR,
  SCHEDULE_TIME_REFERENCE,
  type ScheduleOfflineBehavior,
  type ScheduleTimeReference,
  SCRIPT_SCHEDULE_TRIGGER,
  type ScriptScheduleTrigger,
} from './schedule-enums';

/**
 * Timing model helpers for Script Schedules v2.
 *
 * The backend models a schedule's timing as two fields on `ScriptSchedule`:
 * - `startAt: Instant` — the first scheduled run as an absolute **UTC** instant,
 *   pinned to a 30-minute boundary (`xx:00` / `xx:30`).
 * - `repeat: Long` — the recurrence interval in **seconds**, a whole number of
 *   30-minute slots (1800, 3600, …). Null / 0 means a one-shot that fires once
 *   at `startAt`.
 *
 * The UI offers repeat units that are all clean multiples of 1800s (hour, day,
 * week, month=30d), so anything produced here is always a valid interval on the
 * backend's 30-minute grid. (The backend also accepts a bare 30-minute repeat;
 * the UI simply doesn't surface a sub-hour unit.)
 *
 * Two more fields say what happens when the instant arrives and the device is
 * NOT there — `offlineBehavior` (`SKIP` | `RETRY_ON_RECONNECT`) and, for the
 * latter, `reconnectWindowSeconds`, the deadline past which a queued run is
 * abandoned. They live here because they only mean anything against a scheduled
 * time: a `DEVICE_ONLINE` schedule already fires on reconnect, so it has no
 * offline case to decide and is stored as `SKIP`.
 *
 * **Everything the user sees or picks is their LOCAL wall clock**; UTC exists
 * only on the wire. See `toScheduleInstant` (the host's write side).
 */

/** True when the schedule is event-driven and has no date/time/repeat. */
export function isEventTrigger(trigger: ScriptScheduleTrigger | string | null | undefined): boolean {
  return trigger === SCRIPT_SCHEDULE_TRIGGER.DEVICE_ONLINE;
}

/**
 * Which clock the picked date + time mean — `timeReference`, the second half of
 * what `startAt` says.
 *
 * - `SERVER` (the default, and what every schedule authored before the field
 *   existed carries): `startAt` is an absolute instant. One moment, worldwide.
 * - `DEVICE_LOCAL`: `startAt` carries the picked WALL CLOCK with no zone applied
 *   — local 09:00 is stored as `…T09:00:00Z` — and the runner re-bases it into
 *   each device's own timezone. One reading, many moments; a fleet across three
 *   zones runs at 9 AM three times.
 *
 * The distinction reaches almost every function below, because it decides
 * whether a stored instant is converted through the viewer's offset or read
 * digit for digit: `toScheduleInstant`, {@link fromScheduleInstant},
 * {@link getTimeSlotOptions} (the 30-minute grid is UTC's, and only the SERVER
 * reading has to be shifted onto it) and `formatScheduleStartAt`.
 *
 * A predicate rather than `=== ENUM.X` at the call sites, for the same reason
 * {@link isEventTrigger} is one: Relay types every schema enum with a
 * `%future added value` member, so asking "is it the non-default arm" is what
 * lets an unknown value fall back to SERVER — which is what the write side
 * documents null as meaning.
 */
export function isDeviceLocalTime(timeReference: ScheduleTimeReference | string | null | undefined): boolean {
  return timeReference === SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL;
}

/**
 * The units an `[interval] [unit]` pair is built from, finest first — one list,
 * so the dropdowns, the form schema and the seconds table cannot drift apart.
 *
 * Two different settings are spelled in this vocabulary, and they are NOT the
 * same quantity: the repeat cadence (`repeat`, how often the schedule fires) and
 * the reconnect window (`reconnectWindowSeconds`, how long an offline device's
 * queued run is still worth running). They share the units and the seconds
 * table; nothing else. In particular {@link MIN_REPEAT_MINUTES} is a property of
 * the RUNNER'S grid and constrains the cadence only — a reconnect window is a
 * plain deadline and may sit anywhere.
 */
export const DURATION_UNIT_VALUES = ['minute', 'hour', 'day', 'week', 'month'] as const;

export type DurationUnit = (typeof DURATION_UNIT_VALUES)[number];

// `Record<DurationUnit, …>` on both maps: adding a unit above is then a compile
// error until its seconds and its label exist.
export const DURATION_UNIT_SECONDS: Record<DurationUnit, number> = {
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
  month: 2592000, // 30 days — the only "calendar" unit the seconds model can approximate
};

export const DURATION_UNIT_LABELS: Record<DurationUnit, string> = {
  minute: 'Minute',
  hour: 'Hour',
  day: 'Day',
  week: 'Week',
  month: 'Month',
};

/**
 * The smallest cadence the backend's grid allows: `repeat` must be a whole
 * number of 30-minute slots, so 30 minutes is one slot and there is nothing
 * below it. Every other unit clears this by construction (an hour is two slots),
 * which is why the rule only ever has to be enforced on minutes.
 */
export const MIN_REPEAT_MINUTES = 30;

export const DURATION_UNIT_OPTIONS: { label: string; value: DurationUnit }[] = DURATION_UNIT_VALUES.map(value => ({
  value,
  label: DURATION_UNIT_LABELS[value],
}));

/**
 * Snaps a repeat interval onto what its unit can legally express. Only minutes
 * can be illegal — see {@link MIN_REPEAT_MINUTES} — so every other unit is
 * returned untouched.
 *
 * Used when the unit CHANGES: switching "1 Day" to minutes would otherwise leave
 * "1 Minute" sitting in the form, a value the user never typed and cannot save.
 */
export function snapRepeatInterval(interval: number | null, unit: DurationUnit): number | null {
  if (unit !== 'minute' || interval === null) return interval;
  if (!Number.isFinite(interval) || interval < MIN_REPEAT_MINUTES) return MIN_REPEAT_MINUTES;
  return Math.ceil(interval / MIN_REPEAT_MINUTES) * MIN_REPEAT_MINUTES;
}

/**
 * True when a schedule QUEUES a run for a device that was offline at its
 * scheduled time, instead of logging the miss and moving on.
 *
 * The counterpart of {@link isEventTrigger}, and the reason both are predicates
 * rather than `=== ENUM.X` at the call sites: Relay types every schema enum with
 * a `%future added value` member, so a stored value this client doesn't know
 * reads as neither arm. Asking "is it the non-default one" answers that safely —
 * an unknown behavior falls back to SKIP, which is also what the backend
 * documents as the default.
 */
export function isRetryOnReconnect(behavior: ScheduleOfflineBehavior | string | null | undefined): boolean {
  return behavior === SCHEDULE_OFFLINE_BEHAVIOR.RETRY_ON_RECONNECT;
}

/**
 * The floor on the reconnect window, in minutes.
 *
 * NOT the runner's grid — this field sits on none, the backend accepts any
 * number of seconds. It is the same 30 as {@link MIN_REPEAT_MINUTES} and a
 * separate constant on purpose: that one follows the runner, this one follows
 * the shortest cadence a schedule can have, and there is no reason the two must
 * move together.
 *
 * Unlike the repeat floor it is a MINIMUM only — no multiple-of-30 rule, because
 * there is no grid for a value to land on. A 45-minute window is legal.
 */
export const MIN_RECONNECT_MINUTES = 30;

/**
 * Raises a reconnect interval to its floor when the unit switches to minutes —
 * the counterpart of {@link snapRepeatInterval}, minus the multiple half.
 *
 * `null` (the field cleared while typing) passes through untouched: snapping it
 * to a number would refill a box the user is in the middle of emptying, which is
 * the behaviour this whole pair of fields was reported for.
 */
export function snapReconnectInterval(interval: number | null, unit: DurationUnit): number | null {
  if (unit !== 'minute' || interval === null) return interval;
  return Math.max(interval, MIN_RECONNECT_MINUTES);
}

/**
 * What the "Stop Retry after" pair starts at.
 *
 * The design shows 1 Week (node 460:63425); the product rule is the floor —
 * minutes, at the minimum — so a new schedule starts at the smallest legal
 * window and the user raises it, rather than starting at a week they may not
 * want. It is only ever a SEED: the field is required whenever
 * RETRY_ON_RECONNECT is picked, so every saved schedule carries a window the
 * user could see, and `reconnectWindowSeconds` is never written blind.
 */
export const DEFAULT_RECONNECT_WINDOW: { interval: number; unit: DurationUnit } = {
  interval: MIN_RECONNECT_MINUTES,
  unit: 'minute',
};

const SLOTS_PER_DAY = 48;
const SLOT_MINUTES = 30;

/**
 * The minute-of-hour the local time slots sit on.
 *
 * Almost everywhere this is 0 and the slots are the plain `xx:00` / `xx:30` of
 * the local day. Zones offset by 45 minutes (Kathmandu, Chatham, Eucla) are the
 * exception: there a local `xx:00` is `xx:15` in UTC, which the backend rejects,
 * so their grid shifts to `xx:15` / `xx:45` — the local readings that DO land on
 * the UTC grid. Those users pick a time that looks unusual but actually runs;
 * the alternative is a save that fails with nothing they can do about it.
 *
 * Read per call, never once at module load: on the server this would be the
 * *server's* timezone, and this module is imported during the prerender pass.
 *
 * The picked date doesn't enter into it. Every DST transition moves the offset
 * by a whole hour (Lord Howe's 30 minutes is the outlier), so the remainder
 * mod 30 holds all year and the grid never has to be rebuilt per date.
 *
 * All of which is the SERVER reading's problem alone. A DEVICE_LOCAL start is
 * stored as its wall clock verbatim (see `toScheduleInstant`), so the
 * boundary applies to the picked digits themselves and the grid is the plain
 * `xx:00` / `xx:30` — in Kathmandu too, where the two grids genuinely differ.
 */
function slotBaseMinutes(timeReference: ScheduleTimeReference | string | null | undefined): number {
  if (isDeviceLocalTime(timeReference)) return 0;
  // getTimezoneOffset() is (UTC − local) in minutes, so UTC lands on a boundary
  // exactly when (localMinutesOfDay + offset) % 30 === 0.
  const offset = new Date().getTimezoneOffset();
  return ((-offset % SLOT_MINUTES) + SLOT_MINUTES) % SLOT_MINUTES;
}

/**
 * Whether an `HH:mm` the form already holds is a slot the given reading offers.
 *
 * Only ever false where the two grids differ — the 45-minute zones — which is
 * exactly where switching the Timezone control leaves a picked time the new
 * dropdown cannot show. Asked about the GRID and not about the option list, so
 * a stored start that has simply gone by (which the list withholds, and which
 * the form is allowed to keep) is not mistaken for one the grid rejects.
 */
export function isSlotOnGrid(slot: string, timeReference: ScheduleTimeReference | string | null | undefined): boolean {
  if (!slot) return true;
  const [hours, minutes] = slot.split(':').map(Number);
  const offGrid = (hours * 60 + minutes - slotBaseMinutes(timeReference)) % SLOT_MINUTES;
  return ((offGrid % SLOT_MINUTES) + SLOT_MINUTES) % SLOT_MINUTES === 0;
}

/** Minutes since local midnight → the `HH:mm` the form stores. */
function slotValue(minutesOfDay: number): string {
  const hours = Math.floor(minutesOfDay / 60);
  const minutes = minutesOfDay % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Minutes since local midnight → the reading shown in the dropdown.
 *
 * Formatted through the app's date module like every other clock reading, so a
 * 24-hour locale sees "14:15" rather than a hand-rolled AM/PM. The reference day
 * is arbitrary and never leaves this function: a local `Date` formatted in the
 * local zone returns the same wall clock it was built from.
 */
function slotLabel(minutesOfDay: number): string {
  return formatTime(new Date(1970, 0, 1, Math.floor(minutesOfDay / 60), minutesOfDay % 60));
}

/**
 * The Time dropdown's options — one per 30-minute slot of the **local** day,
 * shifted onto the grid `startAt` must land on (see {@link slotBaseMinutes}).
 * `value` is 24h `HH:mm` (what the form stores); `label` is the 12h form.
 *
 * A function rather than a const because the grid depends on the viewer's
 * timezone, which a module evaluated during prerender does not know.
 *
 * `forDate` drops the slots that have already gone by: a schedule cannot start
 * in the past, and offering "8:00 AM" at noon means offering a save the backend
 * refuses. Only a `forDate` of TODAY narrows the list — a later day keeps the
 * full 48, and so does a day not yet picked (the user may well be about to pick
 * tomorrow; picking today afterwards is what clears a time that has gone by).
 * A PAST day keeps them too: it can only be a stored start, and the value that
 * schedule already holds has to stay readable.
 *
 * **None of that narrowing applies to DEVICE_LOCAL**, which keeps all 48 slots
 * always. The reading is not the viewer's clock, so "already gone by" is not the
 * viewer's to judge: the fleet's own clocks span 26 hours (UTC−12 … UTC+14), so
 * 8:00 AM at the author's noon is still hours ahead for every device west of
 * them. Withholding it would hide a perfectly good schedule behind the accident
 * of where the admin sits. See {@link earliestDeviceLocalDay} for the one bound
 * that IS meaningful, and note the backend agrees — it validates no start
 * against the past, for either reading.
 */
export function getTimeSlotOptions(
  forDate?: Date | null,
  timeReference?: ScheduleTimeReference | string | null,
): { value: string; label: string }[] {
  const base = slotBaseMinutes(timeReference);
  const cutoff = !isDeviceLocalTime(timeReference) && forDate && isToday(forDate) ? nowMinutesOfDay() : -1;
  return Array.from({ length: SLOTS_PER_DAY }, (_, slot) => {
    const minutesOfDay = base + slot * SLOT_MINUTES;
    return { value: slotValue(minutesOfDay), label: slotLabel(minutesOfDay), minutesOfDay };
  })
    .filter(slot => slot.minutesOfDay > cutoff)
    .map(({ value, label }) => ({ value, label }));
}

/**
 * The dropdown reading for an `HH:mm` the option list no longer carries — a
 * stored start whose slot has already gone by today. The form's value has to
 * stay VISIBLE (it is what will be saved if nothing else changes), so the Select
 * gets its option back with the same label the live slots use.
 */
export function slotToLabel(slot: string): string {
  const [hours, minutes] = slot.split(':').map(Number);
  return slotLabel(hours * 60 + minutes);
}

/** Minutes since local midnight, right now. */
function nowMinutesOfDay(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** Same local calendar day as right now. */
function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  );
}

/**
 * Local midnight today — the earliest day a schedule may start, and what the
 * date picker takes as its `fromDate`.
 *
 * Midnight rather than "now": the calendar selects whole days, so today has to
 * stay pickable all day long. Which of today's SLOTS are still available is the
 * time dropdown's half of the same rule ({@link getTimeSlotOptions}).
 *
 * Built per call — a module-level constant would freeze the boundary at import
 * time and let a tab left open overnight pick yesterday.
 */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The earliest day a DEVICE_LOCAL schedule may start: today **as read on the
 * westernmost clock on Earth** (UTC−12), returned as a local `Date` the calendar
 * can take as its `fromDate`.
 *
 * The viewer's own midnight is the wrong bound here. A wall clock is not an
 * instant, so a day is "gone" only once it has gone everywhere — and the fleet's
 * clocks span 26 hours, so for a viewer in Kyiv or Auckland the calendar day
 * that already ended for THEM is still running for a device in Baker Island.
 * Bounding by the viewer would refuse a date that is genuinely in the future for
 * part of the fleet; bounding by UTC−12 refuses only what no device anywhere can
 * still reach.
 *
 * In practice this is today, or yesterday for viewers far enough east — which is
 * the whole of the correction, and it is deliberately the only one: within a day
 * that is still live somewhere, WHICH devices are still ahead of the picked time
 * is the runner's business (it fires each device at its own local reading and
 * marks the ones that have gone past their catch-up window MISSED), not a rule
 * the form can usefully pre-empt.
 */
export function earliestDeviceLocalDay(): Date {
  const westernmostNow = new Date(Date.now() - 12 * 60 * 60 * 1000);
  return new Date(westernmostNow.getUTCFullYear(), westernmostNow.getUTCMonth(), westernmostNow.getUTCDate());
}

/**
 * The earliest day the picker may offer, for either reading — the calendar's
 * `fromDate`, and the day the "start in the past" rules measure against.
 */
export function earliestScheduleDay(timeReference?: ScheduleTimeReference | string | null): Date {
  return isDeviceLocalTime(timeReference) ? earliestDeviceLocalDay() : startOfToday();
}

/**
 * Whether a picked day + slot has already gone by. Compared as instants, so a
 * slot that is still minutes away passes.
 *
 * Always false for DEVICE_LOCAL: the pair is a wall clock every device reads on
 * its own timezone, so there is no single instant to have gone by — see
 * {@link getTimeSlotOptions}.
 */
export function isScheduleStartInPast(
  date: Date | null | undefined,
  slot: string,
  timeReference?: ScheduleTimeReference | string | null,
): boolean {
  if (!date || !slot || isDeviceLocalTime(timeReference)) return false;
  return applyTimeSlot(date, slot).getTime() < Date.now();
}

/** What both the field and the schema say about a start that has gone by. */
export const PAST_START_MESSAGE = 'Start time must be in the future';

/**
 * What a picked TODAY says once its last 30-minute slot has gone by.
 *
 * The dead end this names: `getTimeSlotOptions` correctly withholds every slot,
 * so the Time dropdown has nothing to offer — and an empty popup states no
 * reason and offers no way on. It is the DATE that has to change, which is why
 * the message says so and why the field showing it is the date's.
 *
 * Not a schema rule: a schedule with no time already fails the save on
 * `scheduledTime` being required. This is the earlier, more useful half of the
 * same fact, said while the user can still act on it.
 */
export const NO_SLOTS_TODAY_MESSAGE = 'No start times left today — pick another day';

/**
 * The "no start in the past" rule as the FORM applies it — stated once, and read
 * by both the fields (which show it the moment it happens) and the schema (which
 * refuses the save).
 *
 * The exemption is the whole reason it needs a name: a schedule already stored
 * with a past start keeps it. Recurring schedules legitimately started long ago,
 * and without this, renaming one would demand re-picking its date. So the stored
 * instant stays legal for exactly as long as the form still shows it; moving
 * either half makes the choice a new one, held to the same rule as any other.
 *
 * The rule does not exist at all for DEVICE_LOCAL — `isScheduleStartInPast`
 * answers false there — which is why the day bound
 * ({@link earliestDeviceLocalDay}) is the only thing left holding that reading
 * to a future the fleet can still reach.
 */
export function isStartInPastAndChanged(
  date: Date | null | undefined,
  slot: string,
  storedIso: string | null | undefined,
  timeReference?: ScheduleTimeReference | string | null,
): boolean {
  if (!isScheduleStartInPast(date, slot, timeReference) || !date) return false;
  // Read under the schedule's own reading, or the stored start of a DEVICE_LOCAL
  // schedule would come back shifted by the viewer's offset and never match the
  // pair on screen — the exemption would lapse and an untouched schedule would
  // become unsaveable.
  const stored = storedIso ? fromScheduleInstant(storedIso, timeReference).getTime() : null;
  return applyTimeSlot(date, slot).getTime() !== stored;
}

/**
 * A picked date → the local `HH:mm` slot it sits on (empty when no date yet).
 *
 * A stored `startAt` always lands on a slot exactly, since the backend enforces
 * the same grid this builds from; the flooring is for values authored outside
 * this UI, and it keeps them on a slot the dropdown can actually show.
 */
export function dateToTimeSlot(
  date: Date | null | undefined,
  timeReference?: ScheduleTimeReference | string | null,
): string {
  if (!date) return '';
  const base = slotBaseMinutes(timeReference);
  const minutesOfDay = date.getHours() * 60 + date.getMinutes();
  const slot = Math.min(SLOTS_PER_DAY - 1, Math.max(0, Math.floor((minutesOfDay - base) / SLOT_MINUTES)));
  return slotValue(base + slot * SLOT_MINUTES);
}

/**
 * Applies an `HH:mm` slot to the picked date. Choosing a time before a date
 * anchors it to today — the same fallback the core date-time picker uses.
 */
export function applyTimeSlot(date: Date | null | undefined, slot: string): Date {
  const [hours, minutes] = slot.split(':').map(Number);
  const next = date ? new Date(date) : new Date();
  next.setHours(hours, minutes, 0, 0);
  return next;
}

/**
 * Inverse of `toScheduleInstant`: a stored UTC instant → the `Date` for
 * that moment, which the picker and every formatter below then read through the
 * viewer's own clock.
 *
 * A DEVICE_LOCAL start carries no moment to convert — its digits are a wall
 * clock — so they are lifted back out of UTC and rebuilt as LOCAL components.
 * The `Date` that comes back is therefore not the instant the string names; it
 * is the reading, in the only form the pickers and formatters here can hold one.
 * Passing the reference through is what keeps "9 AM on every device" from
 * displaying as noon to the viewer who typed it.
 */
export function fromScheduleInstant(iso: string, timeReference?: ScheduleTimeReference | string | null): Date {
  const instant = new Date(iso);
  if (!isDeviceLocalTime(timeReference)) return instant;
  return new Date(
    instant.getUTCFullYear(),
    instant.getUTCMonth(),
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
  );
}
