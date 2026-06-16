'use client'

/**
 * `<TicketDetailDrawer />` — the expanded view of a single ticket.
 *
 * Extracted from the original `ticket-row.tsx` so both compositions
 * share it:
 *   - Lib's `TicketRow` (compact `<ChatTicketItem>` summary + drawer
 *     beneath; what third-party embedders use via `TicketCenter`).
 *   - Hub's `<TicketCard>` (the DevSection-style card chrome on the
 *     openframe `/tickets` page).
 *
 * The drawer owns everything BELOW the summary tile:
 *   1. Metadata strip (ticket #, priority, pipeline, company, updated)
 *   2. Conversation timeline (`<TicketTimelinePanel>`) — original body
 *      turns + Note engagements + attachments
 *   3. Status-dependent actions (composer + close OR reopen)
 *
 * State is local to this component (composer text, attachment bag,
 * close-confirm dialog). The parent owns the ticket data + mutation
 * callbacks; we don't reach into the QueryClient.
 */

import { useStickToBottom } from 'use-stick-to-bottom'
import { Button } from './../ui/button'
import { useChatIdentity } from './../chat/hooks/use-chat-identity'
import {
  ChatMessageRow,
  ChatMessageRowSkeleton,
} from './../chat/chat-message-row'
import { EmptyState } from './../empty-state'
import {
  TicketAttachmentsList,
  type TicketAttachment,
} from './../ui/ticket-attachments-list'
import { SquareAvatar } from './../ui/square-avatar'
import { formatRelativeTime } from './../../utils/date-utils'
import { useTicketEngagements } from './hooks/use-ticket-engagements'
import type {
  TicketEngagementFile,
} from './hooks/use-ticket-engagements'
import { TicketLinkedDeliveryCard } from './ticket-linked-delivery-card'
import { TicketReplyComposer } from './ticket-reply-composer'
import type {
  AnyTicket,
  TicketAssignedOwner,
  MappedTicketActionError,
} from './types'
import { isOptimistic, TICKET_LIVE_POLL_MS } from './types'

/** Identity bundle threaded through the action callbacks: local mirror
 *  UUID + HubSpot external_id. Actions send `external_id` to HubSpot
 *  (the only id it recognizes) and use `id` for the React-side mutex +
 *  TanStack cache. */
export type TicketRef = { id: string; external_id: string }

export interface TicketDetailDrawerProps {
  ticket: AnyTicket
  busy: boolean
  supportSystemDown: boolean
  /** Single combined "reply" — text + optional attachments delivered as
   *  ONE Note engagement. */
  onSendMessage: (
    ticket: TicketRef,
    text: string,
    attachments: import('./../chat/utils/chat-attachment-markdown').ChatAttachment[],
  ) => Promise<boolean>
  onClose: (ticket: TicketRef, resolution?: string) => Promise<boolean>
  onReopen: (ticket: TicketRef) => Promise<boolean>
  /** Called after a successful close/reopen so the parent can collapse
   *  the drawer (status flipped — current action set is now stale). */
  onActionCollapsed: () => void
  /** Persisted reply-failure surface — when non-null the drawer renders
   *  an inline banner above the composer with the mapped copy + a
   *  dismiss control. Distinct from the transient toast; the banner
   *  stays visible so the customer can locate the failed draft after
   *  the toast disappears. Cleared on the next successful send. */
  replyError?: MappedTicketActionError | null
  /** Dismiss-X handler for the banner. Parent calls
   *  `actions.clearReplyError(ticket.external_id)`. */
  onClearReplyError?: () => void
}

export function TicketDetailDrawer({
  ticket,
  busy,
  supportSystemDown,
  onSendMessage,
  onClose,
  onReopen,
  onActionCollapsed,
  replyError,
  onClearReplyError,
}: TicketDetailDrawerProps) {
  const isClosed = (ticket.status ?? '').toUpperCase() === 'CLOSED'
  return (
    <div className="bg-ods-card border-t border-ods-border px-4 py-4 flex flex-col gap-4">
      {/* Assignee header — surfaces who's looking at this ticket on the
          support side. Populated server-side via `attachOwnerProfiles`;
          falls back to "Unassigned" when no agent is assigned OR when
          the owner couldn't be resolved (deleted between ticket update
          + next owners reconcile). */}
      <AssignedAgentRow assignedOwner={ticket.assignedOwner} />

      {/* Linked ClickUp delivery — rendered only when the server's
          `attachClickupTasks` step populated `ticket.clickup`. Customer
          tickets with no linked task skip this entirely. The card itself
          links out to ClickUp with the per-status color badge so the
          customer can follow the delivery progress. */}
      {ticket.clickup && (
        <TicketLinkedDeliveryCard clickup={ticket.clickup} />
      )}

      <div>
        <p className="text-xs font-medium text-ods-text-secondary mb-2 uppercase tracking-wider">
          Conversation
        </p>
        <TicketTimelinePanel ticket={ticket} />
      </div>

      <div className="border-t border-ods-border pt-4">
        {/* Reply-failure banner — populated by `useTicketActions` when
            the last sendMessage attempt for THIS ticket failed with a
            reply-specific code. Rendered above the composer/reopen so
            the customer sees it in context of their failed draft. Open
            (composer) actions still allow Retry; the closed (reopen)
            state still shows the banner because the user might have
            tried to reply to a then-closing ticket. */}
        {replyError && (
          <ReplyFailureBanner
            error={replyError}
            onDismiss={onClearReplyError ?? (() => undefined)}
          />
        )}
        {isClosed ? (
          <ReopenAction
            ticketRef={{ id: ticket.id, external_id: ticket.external_id }}
            busy={busy}
            supportSystemDown={supportSystemDown}
            onReopen={onReopen}
            onActionCollapsed={onActionCollapsed}
          />
        ) : (
          <TicketReplyComposer
            ticket={ticket}
            busy={busy}
            supportSystemDown={supportSystemDown}
            onSendMessage={onSendMessage}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Render the ticket conversation as a chronological list of
 * `<ConversationCardRow>` cards inside a single bordered container.
 *
 * Top: the original ticket description (`ticket.body`). Below: every
 * Note engagement attached to the ticket via `useTicketEngagements` —
 * each with its own attachments rendered through the shared
 * `<TicketAttachmentsList>` (no more 📎-emoji chips).
 *
 * Legacy tickets whose old comments STILL live inside `ticket.body`
 * (joined by ` --- `) split on that delimiter so the historical
 * conversation surfaces correctly during the transition.
 *
 * Scroll behavior — INTENTIONALLY NONE. The drawer grows with the
 * conversation; the page scrolls. The previous `max-h-96 overflow-y-auto`
 * created two competing scroll surfaces (inner + page) which felt
 * janky on long threads and hid the composer on short ones. 2026
 * helpdesk best practice (UXPin / Coveo research) is a single
 * threaded surface that flows with the page.
 */
// Bounded quantifiers (`{1,16}`) protect against the polynomial-time
// backtracking class CodeQL flags for unbounded `\s+` on user input.
// 16 chars of leading/trailing whitespace around `---` is far more
// than any composed ticket body needs, so no real input is rejected.
const TURN_SEPARATOR_RE = /[\s]{1,16}---[\s]{1,16}/g

// Slack-channel feed framing — ported from the hub's live community feed
// (`components/slack/chat-interface.tsx`: `:62` bounded card, `:83` padding +
// `overflow-y-auto`, `:85` `gap-4 md:gap-6` message column). Single source
// within the ticket feed; the delivery `DevCardRowSkeletonList` keeps its own
// (separate, untouched) frame literal. `max-h` is responsive (vs Slack's fixed
// height).
const TICKET_FEED_FRAME =
  'bg-ods-card border border-ods-border rounded-[6px] overflow-y-auto w-full'
// FIXED height for EVERY state (skeleton, content, empty) — the Slack feed uses
// a fixed-height box too (`chat-interface.tsx:62`). Fixed (not `max-h`) is the
// fix for the "open shows 1 message, then the container grows as engagements
// land" jank: the feed is its final size from first paint, so loaded content
// just fills/scrolls inside it — the box never resizes.
const TICKET_FEED_HEIGHT = 'h-[60vh] md:h-[420px]'
const TICKET_FEED_INNER = 'flex flex-col gap-4 md:gap-6 px-4 md:px-6 py-4 md:py-6'
// Enough skeleton rows to fill the fixed height (avatar 40px + header + 2 body
// lines + gap-6) so the loading state looks like a full conversation.
const TICKET_FEED_SKELETON_ROWS = 6

function TicketTimelinePanel({ ticket }: { ticket: AnyTicket }) {
  const identity = useChatIdentity()
  // Optimistic placeholders don't have a real external_id yet — skip
  // the engagement fetch until the real ticket lands.
  const externalId = isOptimistic(ticket) ? null : ticket.external_id
  // Live conversation refresh: this panel only mounts while the drawer is
  // open, so the constant interval is already gated to "open" (closing the
  // drawer unmounts the panel → polling stops). New agent replies +
  // attachments surface within one cadence without a manual refresh — the
  // same 8s the list-level status/assignee poll uses (single source:
  // TICKET_LIVE_POLL_MS). A background poll never flashes the skeleton
  // (the `isLoading` guard below keys off "no data yet", not `isFetching`).
  const { engagements, isLoading } = useTicketEngagements(
    externalId,
    !!externalId,
    TICKET_LIVE_POLL_MS,
  )

  // Slack-style auto-tail (same lib mechanism `ChatMessageList` uses): jump to
  // the newest message on open (`initial:'instant'`), smooth-scroll on a new
  // reply. Called unconditionally here, BEFORE the empty/loading early-returns
  // (Rules of Hooks); the refs attach ONLY to the content branch's scroll frame
  // + column — never the cold-start skeleton (refs there would snap to skeleton
  // height, then again to real content). This inner scroll is a SEPARATE
  // container from `HelpCenterCard`'s page-level expand-scroll, so it never
  // fights the "scroll to top of the ticket card" behavior.
  const { scrollRef, contentRef } = useStickToBottom({ initial: 'instant', resize: 'smooth' })

  const bodyTurns = ticket.body
    ? ticket.body.split(TURN_SEPARATOR_RE).map((t) => t.trim()).filter(Boolean)
    : []

  // Suppress `bodyTurns[0]` ("Original message") when the engagement
  // timeline already has a customer-authored message whose body
  // matches it. The channel-first create path in the hub writes the
  // customer's message body BOTH into `hubspot_tickets.content` AND
  // into the first `hubspot_ticket_conversation_messages` row — pre-
  // 2026-05-29 the bot-intake-burst filter on the server dropped the
  // first-customer message from engagements, so `bodyTurns[0]` was
  // the only render. With channel-first, the engagement survives and
  // both surfaces render the same text. Drop the redundant
  // "Original message" turn when we detect that overlap.
  //
  // Only `bodyTurns[0]` is conditional. Subsequent turns ("Update N",
  // "[Resolution]") come from `update_ticket.content_addendum` and
  // are NEVER customer-written, so the engagement timeline can't
  // match them. Leave their indices intact so `Update 1` still
  // labels as such when `bodyTurns[0]` is suppressed.
  const customerEngagementBodies = new Set<string>(
    engagements
      .filter((e) => e.authorRole === 'customer')
      .map((e) => (e.body ?? '').trim())
      .filter(Boolean),
  )
  const suppressBodyTurnZero =
    bodyTurns.length > 0 &&
    customerEngagementBodies.has(bodyTurns[0])

  // Customer name resolution precedence:
  //   1. LIVE chat identity (`identity.user.name`) — when the viewer
  //      is the ticket's own customer. Always fresh.
  //   2. Mirror's `customer_name` — the HubSpot contact's display
  //      name, captured by the ticket sync. Falls back here when the
  //      viewer is NOT the customer (admin browsing / multi-contact
  //      second viewer) so the customer bubble still shows the real
  //      person's name instead of "Customer" generic.
  //   3. Session email — last resort.
  //   4. "You" — anonymous viewer.
  const sessionEmailLower = identity.user?.email?.trim().toLowerCase() ?? null
  const isViewerTheCustomer =
    !!sessionEmailLower &&
    ticket.customer_emails.some((e) => e.trim().toLowerCase() === sessionEmailLower)
  const viewerName = identity.user?.name?.trim() || null
  const ticketCustomerName = ticket.customer_name?.trim() || null
  const customerName =
    (isViewerTheCustomer ? viewerName : null) ||
    ticketCustomerName ||
    viewerName ||
    identity.user?.email ||
    'You'
  const customerAvatar = isViewerTheCustomer
    ? identity.user?.avatarUrl ?? undefined
    : undefined

  // Loading takes precedence over partial content — this is the fix for the
  // "open shows 1 message, then the rest load and the box grows" jank. The
  // ticket BODY is available synchronously, but the engagement timeline is
  // fetched on open (caches off → EVERY open refetches). Rendering the body
  // alone and then appending engagements as they arrive is the pop-in/grow the
  // user hit. Instead: show the FULL-HEIGHT skeleton until the fetch settles,
  // THEN render the whole conversation at once. Fixed height + skeleton-first =
  // zero reflow and no partial render. `isLoading` (not `isFetching`) is true
  // only on a cold open with no data yet — so a background refetch after sending
  // a reply does NOT flash the skeleton; the new row just appends.
  if (isLoading) {
    // NO scroll refs here — they attach only to the real-content branch (refs on
    // the skeleton would snap-to-bottom on skeleton height, then again on content).
    return (
      <div className={`${TICKET_FEED_FRAME} ${TICKET_FEED_HEIGHT}`}>
        <div className={TICKET_FEED_INNER}>
          {Array.from({ length: TICKET_FEED_SKELETON_ROWS }, (_, i) => (
            <ChatMessageRowSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (bodyTurns.length === 0 && engagements.length === 0) {
    return (
      <EmptyState
        type="generic"
        title="No conversation yet"
        description="Reply below to start the thread with the support team."
        showCTA={false}
      />
    )
  }

  return (
    <div ref={scrollRef} className={`${TICKET_FEED_FRAME} ${TICKET_FEED_HEIGHT}`}>
      <div ref={contentRef} className={TICKET_FEED_INNER}>
      {/* Customer-authored description + any legacy `---`-joined
          comments. Always rendered ABOVE the engagement timeline as
          "Original message" because the server's intake-burst filter
          (see `filterCustomerVisibleTimeline` in
          `hubspot-conversations-utils.ts`) drops the customer's first
          message from engagements when it was part of the HubSpot
          Custom Channel bot intake — bodyTurns IS the canonical
          original for those tickets. For tickets created without bot
          intake (admin-created, email channel) bodyTurns shows the
          manually-entered description and engagements show subsequent
          replies — same flow, no duplication. */}
      {bodyTurns.map((turn, i) => {
        // Drop the redundant first turn when the engagement timeline
        // below already renders the same customer-authored body. See
        // `suppressBodyTurnZero` derivation above for the rationale.
        if (i === 0 && suppressBodyTurnZero) return null
        const isResolution = turn.startsWith('[Resolution]')
        const text = isResolution ? turn.replace(/^\[Resolution\]\s*/, '') : turn
        // Body turns don't carry per-turn timestamps — `ticket.body` is a
        // single content field that HubSpot appends to. They render as the
        // customer's own messages (no role chip — the Slack-channel feed has
        // no role labels), oldest-first above the engagement timeline.
        return (
          <ChatMessageRow
            key={`body-${i}-${turn.slice(0, 24)}`}
            displayName={customerName}
            avatarUrl={customerAvatar}
            body={text}
          />
        )
      })}

      {/* Engagement timeline — interleaves customer-authored Custom
          Channel messages (authorRole='customer') and team-authored
          Notes (authorRole='support').
          ATTRIBUTION RULES (per repo convention):
            - CUSTOMER messages whose sender email matches the
              current chat-identity user → render BOTH name AND
              avatar LIVE from `identity.user.*` (1:1 from the
              X-Chat-First-Name + X-Chat-Last-Name + X-Chat-Avatar-Url
              headers that drive the identity webservice). This is
              the source of truth for the logged-in user; we never
              query `profiles` for customer display info.
            - CUSTOMER messages from a DIFFERENT email (rare — the
              /tickets surface only shows the current user's own
              threads) → fall back to whatever the mirror has
              (eng.authorName / eng.authorEmail), no profile lookup.
            - SUPPORT/Note messages → the server has already
              resolved `hubspot_owner_id` → owner email → `profiles`
              row in `list-engagements`. `eng.authorName` +
              `eng.authorAvatarUrl` carry the matched employee's
              display info. When the owner isn't a known Flamingo
              employee, both fields are null and we fall back to
              the generic "Support team" treatment. */}
      {engagements.map((eng) => {
        const isCustomer = eng.authorRole === 'customer'
        // Per-message own-reply check: the server populates `authorId`
        // with the message sender's email (resolved server-side via
        // the HubSpot Conversations actor batch-read for Custom
        // Channel visitor messages). When that email matches the
        // session viewer's email, the bubble is the viewer's OWN
        // reply and renders with LIVE chat identity (name + avatar
        // from chat-auth headers).
        const isOwnReply =
          isCustomer &&
          !!eng.authorId &&
          !!identity.user?.email &&
          eng.authorId.toLowerCase() === identity.user.email.toLowerCase()

        let author: string
        let avatarSrc: string | undefined
        if (isCustomer && isOwnReply) {
          // Live identity — 1:1 from chat auth headers.
          author = identity.user?.name?.trim() || customerName
          avatarSrc = identity.user?.avatarUrl ?? undefined
        } else if (isCustomer) {
          // Customer bubble whose sender email isn't the current
          // session viewer. Two sub-cases:
          //   (a) Same customer as the ticket but viewed by an admin
          //       (or no sender_email on the engagement at all — the
          //       Conversations API leaves it null on Custom Channels).
          //       Use `ticket.customer_name` from the mirror — that's
          //       the canonical HubSpot contact name for THIS ticket.
          //   (b) Multi-contact ticket (CC/BCC) — a different customer
          //       email appears here. We fall back to the same
          //       `ticket.customer_name` rather than leak the second
          //       contact's address; close enough for the rare case.
          author = ticketCustomerName || 'Customer'
          avatarSrc = undefined
        } else if (eng.authorName && eng.authorAvatarUrl) {
          // Resolved Flamingo employee — server matched the HubSpot
          // owner's email against `profiles` AND has an avatar to
          // prove it. Avatar presence IS the trust signal: only
          // owner-resolved employees carry one; raw HubSpot
          // `sender_name` (bots, integrations, system actors,
          // unmatched humans) carries name without avatar and gets
          // the generic "Support team" treatment so we never
          // attribute a customer-facing bubble to a bot string
          // ("HubSpot Bot", "Slack Integration", etc.).
          author = eng.authorName
          avatarSrc = eng.authorAvatarUrl
        } else {
          // Unmatched / unknown / bot / integration / system actor —
          // generic fallback. Customer doesn't need to see internal
          // tool branding (which has the customer "talking to" a bot
          // string instead of a person).
          author = 'Support team'
          avatarSrc = undefined
        }

        // Role label: every engagement is a customer-visible
        // Conversations message (customer ↔ agent on the Custom
        // Channel). There are no internal Notes on this surface
        // anymore — the read path explicitly filters them. So
        // "Reply" for BOTH sides. The previous "Note" label for
        // support bubbles was a legacy artifact from when Notes
        // were rendered and made customers think their support
        // engineer was leaving internal comments on their ticket.
        const engAttachments = mapEngagementAttachments(eng.attachments)
        return (
          <ChatMessageRow
            key={eng.id}
            displayName={author}
            avatarUrl={avatarSrc}
            timeLabel={eng.createdAt ? formatRelativeTime(eng.createdAt) : null}
            body={stripAttachmentsPreamble(eng.body ?? '')}
            footer={
              engAttachments.length > 0 ? (
                <div className="mt-2">
                  <TicketAttachmentsList attachments={engAttachments} size="compact" />
                </div>
              ) : null
            }
          />
        )
      })}

      {/* No trailing refetch skeleton in the tailing feed: a skeleton mounted
          inside `contentRef` on a background refetch would make the auto-tail
          smooth-scroll to the skeleton and then again to the real row (a
          double-jump). The smooth-tail to the appended real reply IS the
          feedback. (Removed the former background-refetch rows={1} skeleton.) */}
      </div>
    </div>
  )
}

/** Map the engagement file shape to the lib's canonical
 *  `TicketAttachment` so we can hand it straight to
 *  `<TicketAttachmentsList>`. Engagement `url` becomes a
 *  window.open-style download click; missing names degrade to
 *  `file-<id>` so the chip never renders an empty label. */
function mapEngagementAttachments(
  files: TicketEngagementFile[],
): TicketAttachment[] {
  return files.map((f) => ({
    id: f.id,
    fileName: f.name ?? `file-${f.id}`,
    fileSize: f.size ? formatBytes(f.size) : '',
    // Show an inline thumbnail for image attachments (the signed `url` is a
    // viewable URL). Non-images fall back to the file-type icon. SquareAvatar
    // degrades to initials on a broken/expired image URL.
    thumbnailSrc:
      f.url && (f.mime?.startsWith('image/') ?? false) ? f.url : undefined,
    onDownload: f.url
      ? () => window.open(f.url!, '_blank', 'noopener,noreferrer')
      : undefined,
  }))
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

/** Strip the redundant `Attachments:\n\n filename.png\n filename2.png`
 *  preamble that the server appends to Note engagement bodies. We
 *  already render the same files through `<TicketAttachmentsList>` with
 *  proper icons + download buttons — showing the raw filename list
 *  again above the chip strip is duplicate noise. The regex matches
 *  ANY trailing block that starts with "Attachments:" (case-insensitive,
 *  optional leading whitespace) and consumes everything to end-of-string,
 *  so server-side wording tweaks like "Attachments (3):" still strip
 *  cleanly. Idempotent — a body with no preamble passes through
 *  untouched. */
const ATTACHMENTS_PREAMBLE_RE = /\s*\n\s*Attachments\b[^]*$/i
function stripAttachmentsPreamble(body: string): string {
  return body.replace(ATTACHMENTS_PREAMBLE_RE, '').trim()
}

function ReopenAction({
  ticketRef,
  busy,
  supportSystemDown,
  onReopen,
  onActionCollapsed,
}: {
  ticketRef: TicketRef
  busy: boolean
  supportSystemDown: boolean
  onReopen: TicketDetailDrawerProps['onReopen']
  onActionCollapsed: TicketDetailDrawerProps['onActionCollapsed']
}) {
  const handleReopen = async () => {
    // Intentionally do NOT call `onActionCollapsed()` here. Pre-PR #1053
    // every reopen was followed by a full list refetch which removed
    // the (now-OPEN) row from a `?status=closed` view, so collapsing
    // the drawer hid the disappearance flash. After #1053+#1055 the
    // row stays in the list with the optimistic in-place status
    // update — collapsing the drawer now actively dismisses the
    // ticket the user is working on. Keep it mounted; the badge flip
    // is enough feedback. (Reported 2026-05-29.)
    void (await onReopen(ticketRef))
  }
  return (
    <div className="flex justify-end">
      {/* Reopen is a secondary, reversible action — `outline` (not the filled
          accent primary) so it reads as available without dominating the
          closed-ticket view. */}
      <Button
        type="button"
        variant="outline"
        size="small"
        onClick={() => void handleReopen()}
        disabled={busy || supportSystemDown}
        loading={busy}
      >
        Reopen
      </Button>
    </div>
  )
}

/**
 * Persistent banner above the drawer composer/actions when the most
 * recent customer reply failed with a reply-specific code (HUBSPOT_5XX
 * / 400 / 404 / UNKNOWN). The transient toast already fired at the
 * moment of failure; this banner stays until the next successful send
 * OR the user dismisses it explicitly. Wording is sourced from
 * `mapTicketActionError` so a future copy update lives in one place.
 *
 * 404_THREAD is the only terminal code in the set — the banner copy
 * reads "open a new ticket" and Retry would just re-fail. We still
 * render a Dismiss control instead of hiding Retry so the visual shape
 * is uniform; the parent's composer continues to function for any
 * non-thread-deletion reply path.
 */
function ReplyFailureBanner({
  error,
  onDismiss,
}: {
  error: MappedTicketActionError
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-3 flex items-start gap-3 rounded-md border border-ods-attention-red-error bg-ods-attention-red-error-secondary px-3 py-2 text-sm text-ods-attention-red-error"
    >
      <span className="font-medium leading-snug">{error.message}</span>
      <Button
        type="button"
        variant="transparent"
        onClick={onDismiss}
        aria-label="Dismiss reply failure"
        className="ml-auto px-2 py-0.5 text-xs font-medium uppercase tracking-wider text-ods-attention-red-error hover:bg-ods-attention-red-error/10 border-transparent"
      >
        Dismiss
      </Button>
    </div>
  )
}

/**
 * Compact "Assigned to" row at the top of the drawer. Surfaces the
 * support-side agent — name + avatar — so the customer knows who's
 * looking at their ticket. Renders "Unassigned" when the ticket has no
 * `hubspot_owner_id` OR when the owner couldn't be resolved against
 * the mirror (deleted between ticket update + next reconcile).
 *
 * Avatar comes from the canonical `<SquareAvatar variant="round">` so
 * it picks up the initials-fallback + image-proxy behavior used
 * everywhere else in the lib (matches the dev-section message-bubble
 * avatars). No bespoke avatar markup.
 */
function AssignedAgentRow({
  assignedOwner,
}: {
  assignedOwner: TicketAssignedOwner | null
}) {
  // Display label precedence:
  //   1. `name` from the mirror (employee match OR HubSpot's first+last)
  //   2. `email` local-part — covers HubSpot owners that exist but have
  //      no name (rare but real; the ticket IS assigned and rendering
  //      "Unassigned" would be misleading)
  //   3. "Unassigned" — only when the ticket has no `assigned_to` OR
  //      the owner couldn't be resolved against the mirror at all
  const trimmedName = assignedOwner?.name?.trim() || null
  const emailFallback = assignedOwner?.email?.trim() || null
  const displayLabel =
    trimmedName ?? (emailFallback ? emailFallback.split('@')[0] : null)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-ods-text-secondary uppercase tracking-wider font-medium">
        Assigned to
      </span>
      {displayLabel ? (
        <span className="flex items-center gap-1.5 text-ods-text-primary font-medium">
          {/* Avatar loads direct; `SquareAvatar`'s own onError falls back to initials. */}
          <SquareAvatar
            size="sm"
            variant="round"
            src={assignedOwner?.avatarUrl ?? undefined}
            alt={displayLabel}
            fallback={displayLabel}
          />
          {displayLabel}
        </span>
      ) : (
        <span className="text-ods-text-secondary italic">Unassigned</span>
      )}
    </div>
  )
}
