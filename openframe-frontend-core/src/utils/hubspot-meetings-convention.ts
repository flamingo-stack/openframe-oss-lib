/**
 * HubSpot meeting-link naming convention — the single EXECUTABLE home of the
 * rule that decides which scheduling links surface on a host's booking page.
 *
 * Server-safe, React-free, zero HubSpot-API knowledge: pure string rules over
 * link slugs and names. The team-process documentation (how to name links in
 * HubSpot, welcome-screen precedence, descriptor uniqueness) lives in
 * `docs/EMBEDDING_HUBSPOT_MEETINGS.md` — this module is the parser that doc
 * describes. Do not restate the rule tables here or there; the doc links to
 * this file and this file's tests pin the behavior.
 *
 * The convention (opt-in marker + fully dynamic purpose):
 *   A link participates iff its LAST slug segment matches
 *   `call-<purpose>[--<descriptor>]`, e.g.
 *     `michael-assraf/call-sales--openframe-demo` → purpose `sales`
 *     `call-customer-success--kickoff`            → purpose `customer-success`
 *   Personal default links (`michael-assraf`) and legacy links never match —
 *   the `call-` marker is what keeps dynamic purposes junk-free.
 */

import { titleCaseFromSlug } from './format'

/** Marker prefix on the last slug segment that opts a link into the booking page. */
export const SCHEDULING_SLUG_MARKER = 'call-'

/**
 * Overall slug shape (any number of `/`-separated kebab segments).
 * Both the URL-building side and the ingest filter validate against THIS
 * pattern — one regex, one home.
 */
export const SCHEDULING_SLUG_SHAPE = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/

/**
 * Last-segment convention: group 1 = purpose (non-empty, kebab tokens),
 * group 2 = optional descriptor after a literal `--`.
 * `call` / `call-` / `call-x--` (trailing) all fail to match — callers log
 * those as near-misses rather than silently dropping them.
 */
const SCHEDULING_SEGMENT_RE = /^call-([a-z0-9]+(?:-[a-z0-9]+)*)(?:--(.+))?$/

/** Upper bound for availability month paging (widget nav, route 400, DAL clamp). */
export const MAX_MONTH_OFFSET = 11

export interface ParsedSchedulingSlug {
  purpose: string
  descriptor: string | null
}

/** Full-slug validity (shape only — not the convention). Normalizes like the parser. */
export function isValidSchedulingSlug(slug: string): boolean {
  return SCHEDULING_SLUG_SHAPE.test(slug.trim().toLowerCase())
}

/**
 * Parse a full HubSpot meeting-link slug against the convention.
 * Normalization (trim + lowercase) happens HERE, once — this parser is the
 * authoritative surface; segment count is irrelevant (always the LAST segment).
 * Returns null for non-conforming slugs (defaults, legacy, near-misses).
 */
export function parseSchedulingSlug(slug: string): ParsedSchedulingSlug | null {
  const normalized = slug.trim().toLowerCase()
  if (!SCHEDULING_SLUG_SHAPE.test(normalized)) return null
  const lastSegment = normalized.split('/').pop() ?? ''
  const match = SCHEDULING_SEGMENT_RE.exec(lastSegment)
  if (!match) return null
  return { purpose: match[1], descriptor: match[2] ?? null }
}

/** `call-`-prefixed but unparseable — worth a near-miss log line at ingest. */
export function isSchedulingNearMiss(slug: string): boolean {
  const lastSegment = slug.trim().toLowerCase().split('/').pop() ?? ''
  return lastSegment.startsWith(SCHEDULING_SLUG_MARKER.slice(0, -1)) && !SCHEDULING_SEGMENT_RE.test(lastSegment)
}

/**
 * Display label for a purpose or descriptor token: `customer-success` →
 * "Customer Success". One title-caser (format.ts's `titleCaseFromSlug`),
 * hyphen separator explicit.
 */
export function schedulingPurposeLabel(token: string): string {
  return titleCaseFromSlug(token, '-')
}

export interface ParsedSchedulingLinkName {
  title: string
  description: string | null
}

/**
 * Second convention: link NAMES may carry `"Title | Short description"`.
 * The first `|` splits; no `|` → the whole name is the title. This is the
 * day-one description source (welcome screens are an optional per-link
 * HubSpot toggle the caller checks FIRST — see the tutorial's precedence
 * table).
 */
export function parseSchedulingLinkName(name: string): ParsedSchedulingLinkName {
  const idx = name.indexOf('|')
  if (idx === -1) return { title: name.trim(), description: null }
  const title = name.slice(0, idx).trim()
  const description = name.slice(idx + 1).trim()
  return { title: title || name.trim(), description: description || null }
}
