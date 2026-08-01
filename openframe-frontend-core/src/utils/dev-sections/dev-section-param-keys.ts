/**
 * Canonical URL param keys for the dev-center sections — the ONE source for both:
 *   - the chrome registry (`OPENFRAME_DEV_SECTIONS`), which WRITES `?<key>=…` to the URL, and
 *   - the list views (`RoadmapView` / `ProductReleasesView` / `DeliveryLists`), which READ
 *     `?<key>=…` to fetch the filtered list.
 *
 * The chrome and the view MUST agree on the key or filtering silently breaks. Importing
 * from here (instead of re-declaring the literal in each place) makes that impossible to
 * get wrong. Pure string constants — no React, no heavy deps — so both server-bundled
 * utils and client views can import it freely.
 */
export const DEV_SECTION_PARAM_KEYS = {
  /** Free-text search box — shared by every dev-center section. */
  search: 'search',
  /** Roadmap (and Help Center tickets) status filter. */
  status: 'status',
  /** Product-releases stability-tier filter. */
  releaseStatus: 'release_status',
  /** Delivery (bug-fix / enhancement) task-type filter. */
  deliveryTaskType: 'task_type',
} as const

/** Section keys that participate in `<section>-<id>` anchor IDs.
 *  The URL composer (`appendSearchAndHash` in hub `dev-section-url.ts`)
 *  and the row components (`DeliveryRow`, `RoadmapCard`, `HelpCenterCard`)
 *  both call `devSectionAnchorId` so the DOM `id` and the URL hash stay
 *  in lockstep — adding a new section means adding the literal here
 *  ONCE, not at every render site. */
export type DevSectionAnchorKind = 'roadmap' | 'delivery' | 'ticket'

/** Compose the canonical `<section>-<id>` anchor id used by the dev-center
 *  rows + URL composer. */
export function devSectionAnchorId(section: DevSectionAnchorKind, id: string): string {
  return `${section}-${id}`
}

/**
 * THE single source of truth for "which ticket is open" — the URL query
 * param `HelpCenterList` derives its drawer state from. Every producer
 * of a ticket deep link goes through `buildTicketOpenHref`; every
 * consumer reads THIS param name. Lives HERE (pure, server-safe, beside
 * its sibling param keys) because producers span both worlds: the hub's
 * SERVER-side chat-ref builder and the client header cell.
 */
export const TICKET_OPEN_PARAM = 'ticket'

/**
 * Build THE canonical ticket deep link — the ONE producer for every
 * surface that links to a ticket (chat inline cards via the hub's
 * `buildChatRefFromTicketRow`, the header `TicketAlertsButton`, any
 * future caller). Byte-identical output everywhere:
 *
 *   `<base>?ticket=<id>&search=<id>#ticket-<id>`
 *
 * All three parts are load-bearing:
 *   - `?ticket=`  — drawer auto-open (`HelpCenterList` derives its open
 *                   state from this param);
 *   - `&search=`  — filters the list to ONLY that ticket so the
 *                   drawer-open lookup hits regardless of which PAGE the
 *                   ticket would normally land on (without it, tickets
 *                   on page 2+ silently fail to auto-open);
 *   - `#ticket-…` — scroll anchor via the dev-section deep-link
 *                   dispatch (`useScrollToHash` + `devSectionAnchorId`).
 *
 * `base` is the host's tickets surface path and may carry ANY nesting
 * prefix (hub `/tickets`, console `/help-center/tickets`, an embedder's
 * `/support/portal/tickets`). Bases already carrying a query string are
 * composed with `&`.
 */
export function buildTicketOpenHref(base: string, ticketExternalId: string): string {
  const enc = encodeURIComponent(ticketExternalId)
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${TICKET_OPEN_PARAM}=${enc}&${DEV_SECTION_PARAM_KEYS.search}=${enc}#${devSectionAnchorId('ticket', enc)}`
}
