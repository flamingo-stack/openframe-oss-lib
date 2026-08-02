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
 *   A link participates iff its LAST slug segment starts with `call-`.
 *   PRIMARY form (single dashes only — HubSpot's slug editor REJECTS `--`):
 *     `call-<purpose>[-<descriptor…>]` — the FIRST token after `call-` is the
 *     purpose (one word), everything after the next dash is the descriptor:
 *       `michael-assraf/call-sales-openframe-demo` → sales / openframe-demo
 *       `call-support-triage`                      → support / triage
 *       `call-onboarding`                          → onboarding
 *   ALTERNATE form (kept for API-created links / other portals that allow
 *   `--`): `call-<multi-word-purpose>--<descriptor>` — the `--` split wins
 *   when present, letting the purpose itself contain dashes:
 *       `call-customer-success--kickoff` → customer-success / kickoff
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
 * Last-segment convention, two forms tried in order:
 *  1. `--` split (multi-word purpose) — only reachable where the portal
 *     allows double dashes (API-created links; HubSpot's UI editor doesn't).
 *  2. Single-dash split — purpose is the FIRST token after `call-`, the
 *     remainder (if any) is the descriptor. This is the PRIMARY, UI-typeable
 *     form.
 * `call` / `call-` / `call-x--` (trailing) all fail both — callers log those
 * as near-misses rather than silently dropping them.
 */
const SCHEDULING_SEGMENT_DOUBLE_RE = /^call-([a-z0-9]+(?:-[a-z0-9]+)*)--([a-z0-9]+(?:-[a-z0-9]+)*)$/
const SCHEDULING_SEGMENT_SINGLE_RE = /^call-([a-z0-9]+)(?:-([a-z0-9]+(?:-[a-z0-9]+)*))?$/

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
  const double = SCHEDULING_SEGMENT_DOUBLE_RE.exec(lastSegment)
  if (double) return { purpose: double[1], descriptor: double[2] }
  const single = SCHEDULING_SEGMENT_SINGLE_RE.exec(lastSegment)
  if (!single) return null
  return { purpose: single[1], descriptor: single[2] ?? null }
}

/** `call-`-prefixed but unparseable — worth a near-miss log line at ingest. */
export function isSchedulingNearMiss(slug: string): boolean {
  const lastSegment = slug.trim().toLowerCase().split('/').pop() ?? ''
  return (
    lastSegment.startsWith(SCHEDULING_SLUG_MARKER.slice(0, -1)) &&
    !SCHEDULING_SEGMENT_DOUBLE_RE.test(lastSegment) &&
    !SCHEDULING_SEGMENT_SINGLE_RE.test(lastSegment)
  )
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
