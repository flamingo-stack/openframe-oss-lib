/**
 * Wire shape of a row returned by `POST /api/chat/agent/find-ticket`.
 * Mirrors the executor's projection at `lib/data/hubspot-tools.ts`
 * (`FIND_TICKET_SELECT` / `FindTicketResult`).
 *
 * Cross-repo duplication is INTENTIONAL: this lib ships independently
 * of the hub, so we can't import `FindTicketResult` from
 * `hubspot-tools.ts` directly. If the server adds a column to
 * `FIND_TICKET_SELECT`, also add it here. The smoke test in §F of the
 * plan covers the happy path; a wire-contract test belongs in the hub.
 *
 * `find-ticket` returns `customer_emails: string[]` (jsonb array), NOT
 * a single `customer_email`. The list is server-self-scoped to the
 * caller's session email; the array is exposed for admin/staff
 * surfaces, which the ticket center doesn't render.
 */
export interface TicketData {
  id: string
  /** HubSpot ticket id (display number, e.g. "1234"). */
  external_id: string
  subject: string | null
  /** Short (≤400 char) HTML-stripped preview of the ticket body —
   *  used for the list-card subtitle when needed. */
  preview: string | null
  /** Longer (≤4k char) sanitized body. INCLUDES every appended
   *  `content_addendum` comment because the `update_ticket` executor
   *  reads + re-writes the `content` property server-side with a
   *  `---` separator. Render this in the drawer's description block
   *  and the user sees both the original message + every comment they
   *  (or staff) added. */
  body: string | null
  /** Canonical OPEN | CLOSED (HubSpot pipeline derived). */
  status: string | null
  /** Human label like "New" / "Working on it" / "Waiting on contact" /
   *  "Closed". Drives the badge text; canonical status drives color. */
  pipeline_stage_label: string | null
  clickup_task_id: string | null
  /** Snapshot of the linked ClickUp delivery task — populated server-side
   *  via the `clickup_tasks` mirror when `clickup_task_id` is set. Drives
   *  the "Linked delivery" card surface on the ticket drawer (status
   *  badge + ClickUp deep link). `null` when no link OR the ClickUp row
   *  was deleted / not yet synced. */
  clickup: TicketClickupSummary | null
  priority: string | null
  customer_emails: string[]
  customer_company: string | null
  hubspot_updated_at: string
}

/** Compact projection of a linked ClickUp task. Mirrors server-side
 *  `ClickupSummary` in `lib/data/hubspot-tools.ts`. */
export interface TicketClickupSummary {
  external_id: string
  name: string | null
  /** ClickUp status name — e.g. "complete" / "working" / "design approved"
   *  / "waiting for release". Used as the badge label. */
  status: string | null
  /** ClickUp's per-status hex color (e.g. "#008844"). Forwarded to the
   *  badge so colors match the ClickUp board exactly. */
  status_color: string | null
  /** Bucket — `'backlog' | 'working' | 'complete' | 'unknown'`. Used as
   *  a fallback when status_color is missing. */
  status_category: string | null
  /** Direct https://app.clickup.com/t/<id> deep link. Used as the card's
   *  navigation target. */
  url: string | null
  /** Release version label set by the delivery team, e.g. "0.9" / "1.0".
   *  Shown beside the status when present. */
  target_version: string | null
}

/**
 * Optimistic placeholder a `submitTicket` call prepends to the list
 * BEFORE the server roundtrip resolves. Drawer is hidden until the
 * real id arrives. The wrapper destructures `_optimistic` before
 * forwarding to `<ChatTicketItem>` so the DOM doesn't see an unknown
 * prop.
 */
export interface OptimisticTicket extends TicketData {
  _optimistic: true
}

export type AnyTicket = TicketData | OptimisticTicket

export function isOptimistic(t: AnyTicket): t is OptimisticTicket {
  return (t as OptimisticTicket)._optimistic === true
}

/**
 * Stable server-side error codes the ticket-action helpers route
 * through `mapTicketActionError`. Anything else is treated as a generic
 * server error.
 */
export type TicketActionErrorCode =
  | 'PROPOSAL_NOT_CLAIMABLE'
  | 'TICKET_NOT_FOUND'
  | 'TICKET_OWNERSHIP_DENIED'
  | 'HUBSPOT_DISCONNECTED'
  | 'RATE_LIMITED'
  | 'INVALID_TOOL_ARGS'
  | 'UNKNOWN'

export interface MappedTicketActionError {
  code: TicketActionErrorCode
  /** Human-readable copy safe to show in a toast. */
  message: string
  /** When true, the form should disable submit + show the
   *  support-down banner. Set only for HUBSPOT_DISCONNECTED. */
  supportSystemDown: boolean
  /** When true, the helper should remove the affected row optimistically
   *  (TICKET_NOT_FOUND). */
  removeRowFromCache: boolean
  /** Retry hint surfaced from a 429 response. Caller decides whether
   *  to mention it in the toast. */
  retryAfterSeconds?: number
}

/**
 * Defensive client-side cap on ticket text (initial content + comment
 * addendums). HubSpot Note engagements accept more, but a 100KB paste
 * should fail fast at the UI rather than burning a server round-trip.
 * Both the open-ticket form and the per-row comment textarea import
 * this so a future server-side hardening only touches one place.
 */
export const TICKET_TEXT_MAX_CHARS = 5000

/**
 * Centralized toast copy. Keep all wording here so QA / localization
 * can find every user-visible string in one file.
 */
export const TOAST_COPY = {
  open_success: { title: 'Ticket opened', description: 'We received your message and will follow up shortly.' },
  open_mirror_pending: { title: 'Ticket opened', description: 'Syncing — your ticket will appear momentarily.' },
  close_success: { title: 'Ticket closed' },
  reopen_success: { title: 'Ticket reopened' },
  comment_success: { title: 'Comment added' },
  attach_success: { title: 'Files attached' },
  // Failure variants are constructed dynamically from MappedTicketActionError.
} as const
