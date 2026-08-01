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
  /** HubSpot contact's display name. Drives the customer attribution
   *  on the drawer when the viewer is NOT the customer themselves
   *  (admin browsing / multi-contact second viewer). Conversations
   *  API messages don't carry per-message sender info on Custom
   *  Channels, so this is the only reliable source for "what's the
   *  customer's name." */
  customer_name: string | null
  /** HubSpot owner id of the agent assigned to this ticket. Carried as
   *  raw id for debugging; rendering goes through `assignedOwner`. Null
   *  when unassigned. */
  assigned_to: string | null
  /** Resolved assigned-owner profile — name + email + avatar. Populated
   *  server-side via `attachOwnerProfiles` which joins through the
   *  `hubspot_owners` mirror to `profiles` by email. Drives the
   *  "Assigned to" attribution in the drawer header. Null when
   *  unassigned OR the owner couldn't be resolved (rare — only when
   *  the agent was deleted from HubSpot between the ticket update and
   *  the next owners reconcile). */
  assignedOwner: TicketAssignedOwner | null
  hubspot_updated_at: string
}

/** Resolved profile of a ticket's assigned agent — surfaced in the
 *  drawer header. Subset of the server's `MirroredOwnerProfile`
 *  trimmed to just the rendering fields. */
export interface TicketAssignedOwner {
  name: string | null
  email: string | null
  avatarUrl: string | null
}

/** Compact projection of a linked ClickUp task — matches the server's
 *  `ClickupSummary` and aligns with `DeliveryItem` so the linked-card
 *  on a ticket can render through the same `DeliveryRow` primitive used
 *  on `/bug-fixes-and-enhancements`. */
export interface TicketClickupSummary {
  /** ClickUp task external_id (e.g. "86ad4e022"). Used as the
   *  `?focus=<id>` URL param to scroll the public delivery page to
   *  this row. */
  external_id: string
  title: string | null
  description: string | null
  /** ClickUp status name — e.g. "complete" / "working" / "design approved"
   *  / "waiting for release". Used as the badge label. */
  status: string | null
  /** ClickUp's per-status hex color (e.g. "#008844"). Forwarded to the
   *  badge so colors match the ClickUp board exactly. */
  status_color: string | null
  /** Bucket — `'backlog' | 'working' | 'complete' | 'unknown'`. Used as
   *  a fallback when status_color is missing. */
  status_category: string | null
  /** ClickUp custom item label (`'Bug'` / `'Request'`) — drives the
   *  type badge ("BUG-FIX" / "ENHANCEMENT"). */
  task_type: string | null
  custom_item_id: number | null
  /** Every ClickUp list the task is associated with. UI joins with ", ". */
  list_names: string[]
  /** Unix-ms timestamps so the row's "ACTIVE X ago" subtitle uses the
   *  shared `getRelativeTime()` helper. */
  date_opened: number | null
  date_updated: number | null
  date_closed: number | null
  /** Direct https://app.clickup.com/t/<id> deep link. Kept on the wire
   *  for admin surfaces; the customer-facing linked card navigates
   *  internally instead. */
  clickup_url: string | null
  /** Composed server-side via the SAME `buildDevSectionUrl` helper the
   *  chat-inline delivery card uses. Carries `?search=<id>` so the
   *  delivery list filters to that single task on landing. */
  delivery_href: string
  /** Target platform name for the host's `useNavLink` to decide
   *  same-tab vs new-tab on cross-platform links. */
  delivery_target_platform: string
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
 * Shape of a single `['tickets', …]` TanStack-Query cache slot.
 * Mirrors `FindTicketResponse` in `hooks/use-tickets-list.ts` — kept
 * here because the cache-mutation call sites in `useTicketActions` and
 * `<HelpCenterList>` would otherwise have to redeclare the shape inline.
 *
 * A 2026-05-29 prod regression (`t.map is not a function` on
 * close/reopen) was caused by assuming the cache held a bare
 * `TicketData[]` instead of this wrapper — every helper that calls
 * `queryClient.setQueriesData` / `getQueriesData` on `['tickets']`
 * MUST type the value through this shape and project / reassemble
 * `tickets` explicitly.
 */
export interface TicketsCacheSlot {
  tickets?: TicketData[]
  count?: number
  totalCount?: number
  page?: number
  pageSize?: number
  totalPages?: number
  scope?: 'self' | 'all'
}

/**
 * Stable server-side error codes the ticket-action helpers route
 * through `mapTicketActionError`. Anything else is treated as a generic
 * server error.
 *
 * Reply-specific codes (`HUBSPOT_5XX` / `HUBSPOT_400_VALIDATION` /
 * `HUBSPOT_404_THREAD` / `HUBSPOT_REPLY_UNKNOWN`) drive the drawer
 * banner that appears above the composer when a customer reply fails.
 * Distinct from `HUBSPOT_DISCONNECTED` (whole-system) and
 * `TICKET_NOT_FOUND` (terminal-row) — the reply codes are per-attempt
 * + retryable except for `HUBSPOT_404_THREAD`.
 */
export type TicketActionErrorCode =
  | 'PROPOSAL_NOT_CLAIMABLE'
  | 'TICKET_NOT_FOUND'
  | 'TICKET_OWNERSHIP_DENIED'
  | 'HUBSPOT_DISCONNECTED'
  | 'RATE_LIMITED'
  | 'INVALID_TOOL_ARGS'
  | 'HUBSPOT_5XX'
  | 'HUBSPOT_400_VALIDATION'
  | 'HUBSPOT_404_THREAD'
  | 'HUBSPOT_REPLY_UNKNOWN'
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
 * Wire contract of the ticket live stream (`GET /api/chat/agent/
 * ticket-stream`, SSE). Producer (the hub route's `mapEvent`) imports
 * THIS type — same producer/consumer SSOT pattern as
 * `ConversationEngagementWire = TicketEngagement`. A schema drift here
 * would be a silent serialization bug; keep one named contract.
 *
 * Frames carry METADATA ONLY — never message bodies. Content is always
 * refetched through the ACL'd `list-engagements` path (one read path).
 *
 * Event names (`eventType`):
 *   - `ticket-message` — a message row landed in the mirror for one of
 *     the viewer's tickets. `data` carries the metadata.
 *   - `ticket-resync`  — degraded frame: something happened that the
 *     server couldn't fully describe (truncated Realtime payload, or
 *     the connection's ownership set just gained tickets). Clients
 *     respond by refetching the unread summary + invalidating queries.
 *
 * The server also emits `status` frames (`subscribed` / `retrying` /
 * `reconnect_failed`) from the shared SSE utility — clients derive
 * `connected` from those, NOT from the HTTP stream being open.
 */
export type TicketStreamEventType = 'ticket-message' | 'ticket-resync'

/** Metadata payload of a `ticket-message` frame. */
export type TicketMessageStreamData = {
  ticket_external_id: string
  /** Mirror row's HubSpot message id. */
  message_id: string
  /** Server-stamped via the same direction predicate the wire mapper
   *  uses. Clients never re-derive author classification. */
  authorRole: 'customer' | 'support'
  /** Server-stamped via the visibility+direction unread predicate
   *  (`countsAsUnread` in the hub's conversations DAL). ONLY frames
   *  with `true` may bump client-side unread state. */
  countsAsUnread: boolean
  hubspot_created_at: string | null
}

export interface TicketStreamEvent {
  eventType: TicketStreamEventType
  /** Human-readable label (SSE envelope compat) — clients ignore it. */
  message: string
  /** Present on `ticket-message`; absent on `ticket-resync`. */
  data?: TicketMessageStreamData
}

/**
 * Wire shape of `POST /api/chat/agent/ticket-unread-summary` — the
 * SINGLE unread source. Header badge total AND per-row dots both read
 * this via the `TicketLiveProvider` map; missing keys mean 0.
 */
export interface TicketUnreadSummary {
  totalUnread: number
  tickets: Record<string, number>
  /** ISO timestamp of the NEWEST unread message per ticket (same keys as
   *  `tickets`). Drives "route to the most recent update" on the header
   *  cell: the ticket with the max value here is `nextUnreadTicketId`. */
  latestUnreadAt: Record<string, string>
}

/**
 * Trailing debounce for `markRead` while the drawer is open and new
 * messages stream in — flushed on drawer close so a fast open/close
 * still persists the receipt. Named beside its sibling cadences so
 * every timing knob lives in one file.
 */
export const TICKET_MARK_READ_DEBOUNCE_MS = 2000

/**
 * THE single source of truth for "which ticket is open" — the URL query
 * param `HelpCenterList` derives its drawer state from (same model the
 * chat uses for its URL-driven state). Every producer of a ticket deep
 * link goes through `buildTicketOpenHref`; every consumer reads THIS
 * param name. No hash fragment: opening the drawer already smooth-
 * scrolls the row into view (`HelpCenterCard`'s expand effect), and a
 * second scroll mechanism (`#ticket-<id>`) fights it — hand-appending
 * the hash also produced double-hash URLs when composed with hosts'
 * own hash handling.
 */
export const TICKET_OPEN_PARAM = 'ticket'

/**
 * Build the deep link that opens a ticket's drawer:
 * `<base>?ticket=<external_id>`.
 *
 * `base` is the host's tickets surface path and may carry ANY nesting
 * prefix (hub `/tickets`, console `/help-center/tickets`, an embedder's
 * `/support/portal/tickets`) — the builder only appends the open-param.
 * Bases that already carry a query string are composed with `&`.
 */
export function buildTicketOpenHref(base: string, ticketExternalId: string): string {
  const sep = base.includes('?') ? '&' : '?'
  return `${base}${sep}${TICKET_OPEN_PARAM}=${encodeURIComponent(ticketExternalId)}`
}

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
