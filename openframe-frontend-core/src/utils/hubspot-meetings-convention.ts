/**
 * HubSpot meeting-link naming convention — the single EXECUTABLE home of the
 * rule that decides which scheduling links surface on a host's booking page.
 *
 * Server-safe, React-free, zero HubSpot-API knowledge: pure string rules over
 * link NAMES. The team-process documentation lives in
 * `docs/EMBEDDING_HUBSPOT_MEETINGS.md` — this module is the parser that doc
 * describes; this file's tests pin the behavior.
 *
 * THE CONVENTION IS NAME-ONLY. HubSpot link slugs are IMMUTABLE after
 * creation (verified in-portal), so nothing semantic may ever live in the
 * slug — it is an opaque URL identity. The link NAME (freely editable in
 * HubSpot at any time) carries everything:
 *
 *   "Title | Short description | Audience Label"
 *
 *  - A link is LISTED on the booking page iff its name declares the third
 *    (Audience) segment — that segment is the opt-in marker, the displayed
 *    intended-audience entity ("For Prospect Investors") AND the grouping
 *    key (via `schedulingAudienceKey`). Links without it stay unlisted but
 *    remain natively bookable through path deep-links.
 *  - Title/description feed the directory rows and booking pages (an
 *    enabled per-link welcome screen wins over the name for those two).
 */

/**
 * Slug SHAPE guard (any number of `/`-separated kebab segments) — used only
 * to validate path-deep-link input before lookups. Carries NO semantics.
 */
export const SCHEDULING_SLUG_SHAPE = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/

/** Upper bound for availability month paging (widget nav, route 400, DAL clamp). */
export const MAX_MONTH_OFFSET = 11

/** Full-slug shape validity (path-resolution safety only — never semantics). */
export function isValidSchedulingSlug(slug: string): boolean {
  return SCHEDULING_SLUG_SHAPE.test(slug.trim().toLowerCase())
}

export interface ParsedSchedulingLinkName {
  title: string
  description: string | null
  /**
   * The third `|` segment: the intended-audience entity ("Prospect
   * Investors", "OpenFrame Users"). Non-null ⇒ the link is LISTED; it is
   * both the display label and (slugified) the grouping key.
   */
  audienceLabel: string | null
}

/**
 * Parse a link NAME against the `"Title | Description | Audience"`
 * convention. Splits on `|` (first two pipes); no `|` → the whole name is
 * the title. Empty segments normalize to null.
 */
export function parseSchedulingLinkName(name: string): ParsedSchedulingLinkName {
  const parts = name.split('|')
  if (parts.length === 1) return { title: name.trim(), description: null, audienceLabel: null }
  const title = (parts[0] ?? '').trim()
  const description = (parts[1] ?? '').trim()
  const audienceLabel = parts.length > 2 ? parts.slice(2).join('|').trim() : ''
  return {
    title: title || name.trim(),
    description: description || null,
    audienceLabel: audienceLabel || null,
  }
}

/** Whether a link name opts into the directory (has an Audience segment). */
export function isListedSchedulingName(name: string): boolean {
  return parseSchedulingLinkName(name).audienceLabel !== null
}

/**
 * Grouping key for an audience label: `"Prospect Investors"` →
 * `"prospect-investors"`. Links sharing a key group together regardless of
 * their (opaque) slugs. Empty after slugification → null (caller treats the
 * link as unlisted).
 */
export function schedulingAudienceKey(label: string): string | null {
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return key || null
}
