/**
 * "Which instant does a program render, and in which zone" — ONE owner, shared
 * by every surface that shows a webinar, event or podcast.
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
 * now call this.
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
 *   with no clock.
 *
 *   The discriminator is "did an override supply this", NOT the value's
 *   precision. The override column is `timestamptz` and the host normalizes it
 *   through `toISOString()`, so it is always a full instant — an earlier
 *   attempt keyed on precision and could therefore never fire.
 */

/** Read a string field off an item type that does not declare it. */
export const programStr = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export interface ProgramInstant {
  /** The instant both the date and the time render from, or null to fall back
   *  to the caller's UTC pin. */
  instant: string | null;
  /** The event's IANA zone, or null when the row declares none. */
  timezone: string | null;
  /** True when an admin display override supplied the value: render the day
   *  UTC-pinned, with no clock. */
  dateOnly: boolean;
}

/** Resolve what a program item should render. */
export function programDateInstant(item: Record<string, unknown>): ProgramInstant {
  const timezone = programStr(item.timezone);
  const dateOnly = item.date_is_display_override === true;
  const date = programStr(item.date);
  const startAt = programStr(item.start_at);

  // No zone: the caller keeps its UTC pin, which is the React #418 fix and
  // must not be "fixed" into a viewer-local render.
  if (!timezone) return { instant: null, timezone: null, dateOnly };
  return { instant: date ?? startAt, timezone, dateOnly };
}
