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
 *
 * There is deliberately NO escape hatch back to the un-nulled zone. One was
 * added ("for the rare consumer that needs it as data") and no consumer ever
 * wanted it — an un-nulled copy hanging off the resolved value is just the
 * mistake again, one property away.
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
}

/**
 * The columns this rule reads. Declared structurally rather than as a
 * `Record<string, unknown>` so a caller holding a real `BaseProgramItem` can
 * pass it straight in: while the parameter was a bare record, every one of the
 * four call sites wrote `as unknown as Record<string, unknown>`, and a cast at
 * every call site is how a producer that forgets to set the flag goes
 * unnoticed by the compiler.
 */
export interface ProgramDateFields {
  date?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  timezone?: unknown;
  date_is_display_override?: unknown;
}

/** Resolve what a program item should render. */
export function programDateInstant(item: ProgramDateFields): ProgramInstant {
  const declaredZone = programStr(item.timezone);
  const dateOnly = item.date_is_display_override === true;
  const date = programStr(item.date);
  const startAt = programStr(item.start_at);

  // A day-valued row has no zone to render in, and a row that declares none
  // keeps the caller's UTC pin — which is the React #418 fix and must not be
  // "fixed" into a viewer-local render.
  const timezone = dateOnly ? null : declaredZone;
  return {
    instant: timezone ? (date ?? startAt) : null,
    timezone,
    dateOnly,
    utcDate: date ?? startAt,
  };
}

/**
 * The scheduling columns the DURATION is measured from — the pair that rides
 * beside a resolved instant.
 *
 * Here rather than at each surface because five call sites projected these two
 * columns in four different shapes (`programStr`, raw reads, `?? null`, and an
 * `in`-guarded cast), which is the same defect one field-pair down from the one
 * this module exists to fix. They are read off the row, never off the resolved
 * instant, because elapsed time is not a display date: an override moves the
 * day shown, and a webinar still runs for 45 minutes.
 */
export function webinarTiming(item: ProgramDateFields): {
  startAt: string | null;
  endAt: string | null;
} {
  // No `timezone` here on purpose: it would be a second derivation of what
  // `programDateInstant` already resolved (and the UN-NULLED one, so a call
  // site could reintroduce a zone the day-valued rule just dropped).
  return { startAt: programStr(item.start_at), endAt: programStr(item.end_at) };
}

/**
 * THE compact meta line a program renders under its title:
 * `"<day> · <type-specific>"` — podcast duration, event location, or webinar
 * time + duration.
 *
 * The public card and the chat card built this separately, under a comment
 * saying the second "mirrors" the first. That is the arrangement this module
 * exists to end: the mirror drifted twice (the chat card rendered the day in
 * the VIEWER's zone, and the two disagreed about labelling the zone on a
 * zoneless row), each time only on the copy nobody was looking at.
 *
 * `kind` rather than the caller's config object, because the two callers key
 * off differently-shaped configs for the same three types.
 */
export function programMetaLine(
  item: ProgramDateFields & {
    status?: unknown;
    duration_seconds?: unknown;
    location_name?: unknown;
  },
  kind: 'podcast' | 'event' | 'webinar' | (string & {}),
  fmt: {
    date: (at: ProgramInstant) => string;
    duration: (seconds: number) => string;
    webinarMeta: (at: ProgramInstant, opts: { startAt: string | null; endAt: string | null }) => string;
  },
): { at: ProgramInstant; typeMeta: string | null; line: string } {
  const at = programDateInstant(item);
  // A scheduled podcast has not aired, so its stored duration is not elapsed
  // time yet and must not be shown as one.
  const isScheduled = item.status === 'scheduled';
  let typeMeta: string | null = null;
  if (kind === 'podcast' && typeof item.duration_seconds === 'number' && item.duration_seconds > 0 && !isScheduled) {
    typeMeta = fmt.duration(item.duration_seconds);
  } else if (kind === 'event' && typeof item.location_name === 'string' && item.location_name.trim().length > 0) {
    typeMeta = item.location_name;
  } else if (kind === 'webinar' && programStr(item.start_at)) {
    typeMeta = fmt.webinarMeta(at, webinarTiming(item)) || null;
  }
  return { at, typeMeta, line: [fmt.date(at), typeMeta].filter(Boolean).join(' · ') };
}
