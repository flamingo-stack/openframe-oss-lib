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
 * - `item.date` IS the instant to render. The host resolves it once and hands
 *   the same value to the card, the model's context and the API wire.
 *   Preferring `start_at` looks like it buys intra-card coherence — it does, by
 *   disagreeing with everything else.
 * - `start_at` / `end_at` remain the source for DURATION, which is elapsed time
 *   rather than a display date.
 *
 * `timezone` here is "the zone this value renders in and may be labelled with".
 * A row that declares none keeps the UTC pin (the React #418 fix).
 *
 */

/** Read a string field off an item type that does not declare it. */
export const programStr = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

export interface ProgramInstant {
  /** The instant both the date and the time render from, or null to fall back
   *  to `utcDate`. */
  instant: string | null;
  /** The zone this value RENDERS IN and may be LABELLED with. Null when the row
   *  declares none. */
  timezone: string | null;
  /** The row's canonical date string, used when there is no zone to render in.
   *  Kept on the resolved value so the UTC fallback is not re-derived (and
   *  re-formatted differently) at each call site. */
  utcDate: string | null;
}

/**
 * The columns this rule reads. Declared structurally rather than as a
 * `Record<string, unknown>` so a caller holding a real `BaseProgramItem` can
 * pass it straight in: while the parameter was a bare record, every one of the
 * four call sites wrote `as unknown as Record<string, unknown>`.
 */
export interface ProgramDateFields {
  date?: unknown;
  start_at?: unknown;
  end_at?: unknown;
  timezone?: unknown;
}

/** Resolve what a program item should render. */
export function programDateInstant(item: ProgramDateFields): ProgramInstant {
  const timezone = programStr(item.timezone);
  const date = programStr(item.date);
  const startAt = programStr(item.start_at);

  // A row that declares no zone keeps the caller's UTC pin — which is the
  // React #418 fix and must not be "fixed" into a viewer-local render.
  return {
    instant: timezone ? (date ?? startAt) : null,
    timezone,
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
 * instant, because elapsed time is not a display date.
 */
export function webinarTiming(item: ProgramDateFields): {
  startAt: string | null;
  endAt: string | null;
} {
  // No `timezone` here on purpose: it would be a second derivation of what
  // `programDateInstant` already resolved.
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

/** The shape `programMetaFormatters` adapts — the three renderers a program
 *  meta line is built from, supplied by the caller so this leaf stays free of
 *  `./format`. */
export interface ProgramMetaRenderers {
  date: (at: ProgramInstant, style: 'medium' | 'weekday') => string;
  duration: (seconds: number | null) => string;
  webinarMeta: (
    at: ProgramInstant,
    opts: { startAt: string | null; endAt: string | null; withZoneLabel?: boolean },
  ) => string;
}

/**
 * The formatter set `programMetaLine` needs, built once.
 *
 * `programMetaLine` unified the DISPATCH; the three formatters passed into it
 * were then mirrored byte-for-byte across the two components the function
 * exists to keep in sync, plus a second `withZoneLabel: false` variant in two
 * more. A mirrored block in exactly those files is the arrangement this module
 * documents as the cause of the original drift.
 *
 * `withZoneLabel` is the only axis: a compact density joins plain strings so
 * the zone rides inline, while the default density renders it as its own styled
 * span and asks for the value without it.
 *
 * Takes its formatters as arguments rather than importing them, so this leaf
 * stays free of `./format` and the two can be tree-shaken apart.
 */
export function programMetaFormatters(fmt: ProgramMetaRenderers, opts: { withZoneLabel?: boolean } = {}) {
  const withZoneLabel = opts.withZoneLabel !== false;
  return {
    // The meta line always renders the compact day; the one surface that wants
    // the weekday form renders it in its own slot, so a `dateStyle` option here
    // would exist for no caller.
    date: (at: ProgramInstant) => fmt.date(at, 'medium'),
    duration: fmt.duration,
    webinarMeta: (at: ProgramInstant, o: { startAt: string | null; endAt: string | null }) =>
      fmt.webinarMeta(at, { ...o, withZoneLabel }),
  };
}
