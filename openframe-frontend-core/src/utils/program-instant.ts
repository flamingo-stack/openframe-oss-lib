/**
 * "Which instant does a program render, in which zone, and does it have a clock
 * at all" — ONE owner, shared by every surface that shows a webinar, event or
 * podcast, in this package AND in the hub.
 *
 * WHY THIS EXISTS. A card must render every part of ONE timestamp in ONE zone.
 * The date used to come from `item.date` while the time beside it came from
 * `start_at` in the event's own IANA zone, so a webinar at
 * `2026-03-20T01:18Z` / `America/New_York` read "Mar 20, 2026 · 9:18 PM" — a
 * date and a time that never coexisted. That was fixed on the public card and
 * then, because the chat card is a SEPARATE component that merely mirrors it in
 * a comment, the chat card kept the bug — and rendered the date in the
 * VIEWER's zone besides, which is also a React #418 hydration mismatch.
 *
 * Two components describing the same rule in prose is how that happens. They
 * now call this. It lives in `utils/` rather than beside the chat cards
 * because it is not chat-specific and because the hub's own program surfaces
 * must be able to import it — while it sat unexported next to the cards, the
 * hub re-derived it by hand and the copies drifted again, which is the third
 * time this one rule has been re-stated.
 *
 * THE RULE:
 *
 * - `item.date` IS the instant to render. The host resolves it once, applying
 *   any admin display override, and hands the same value to the card, the
 *   model's context and the API wire. Preferring `start_at` looks like it buys
 *   intra-card coherence — it does, by disagreeing with everything else.
 * - `start_at` / `end_at` remain the source for DURATION, which is elapsed time
 *   rather than a display date.
 * - A DISPLAY OVERRIDE is a chosen date, not a moment. An admin backdating in a
 *   `datetime-local` control gets `00:00`, so "show this as March 19" is stored
 *   at UTC midnight; rendering that in a west-of-UTC zone shows March 18 at
 *   8 PM — a day early, at a time nobody chose. Such a value renders UTC-pinned
 *   with no clock and WITHOUT A ZONE LABEL.
 *
 *   The discriminator is "did an override supply this", NOT the value's
 *   precision. The override column is `timestamptz` and the host normalizes it
 *   through `toISOString()`, so it is always a full instant — an earlier
 *   attempt keyed on precision and could therefore never fire.
 *
 * THE ZONE IS NULLED RATHER THAN FLAGGED, deliberately. `timezone` here is "the
 * zone this value renders in and may be labelled with", so a day-valued row
 * carries none and a consumer CANNOT print `America/New_York` under a clock the
 * rule just suppressed. Three surfaces had to remember that gate; two forgot,
 * and one of them rendered a bare IANA string under an empty heading. A rule
 * enforced by the shape of the data cannot be forgotten by the next call site.
 * The row's raw zone stays available as `rowTimezone` for the rare consumer
 * that needs to state it as data rather than as a label.
 */

/** Read a string field off an item type that does not declare it. */
export const programStr = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export interface ProgramInstant {
  /** The instant both the date and the time render from, or null to fall back
   *  to `utcDate`. */
  instant: string | null;
  /** The zone this value RENDERS IN and may be LABELLED with. Null when the row
   *  declares none, and null when the value is day-valued — see the note above
   *  on why this is nulled rather than flagged. */
  timezone: string | null;
  /** True when an admin display override supplied the value: render the day
   *  UTC-pinned, with no clock. */
  dateOnly: boolean;
  /** The row's canonical date string, used when there is no zone to render in.
   *  Kept on the resolved value so the UTC fallback is not re-derived (and
   *  re-formatted differently) at each call site. */
  utcDate: string | null;
  /** The zone the ROW declares, whatever the render rule decided. For a
   *  consumer stating the zone as data; never for a label beside a clock. */
  rowTimezone: string | null;
}

/** Resolve what a program item should render. */
export function programDateInstant(item: Record<string, unknown>): ProgramInstant {
  const rowTimezone = programStr(item.timezone);
  const dateOnly = item.date_is_display_override === true;
  const date = programStr(item.date);
  const startAt = programStr(item.start_at);

  // A day-valued row has no zone to render in, and a row that declares none
  // keeps the caller's UTC pin — which is the React #418 fix and must not be
  // "fixed" into a viewer-local render.
  const timezone = dateOnly ? null : rowTimezone;
  return {
    instant: timezone ? (date ?? startAt) : null,
    timezone,
    dateOnly,
    utcDate: date ?? startAt,
    rowTimezone,
  };
}
