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

import { useState } from 'react'
import { Button } from './../ui/button'
import { Textarea } from './../ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './../ui/alert-dialog'
import {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
} from './../chat/chat-attachment-bar'
import { useChatAttachments } from './../chat/hooks/use-chat-attachments'
import { useChatIdentity } from './../chat/hooks/use-chat-identity'
import { EmptyState } from './../empty-state'
import {
  ConversationCardRow,
  ConversationCardRowSkeletonList,
} from './../shared/dev-section/dev-card-row'
import type { TicketAttachment } from './../ui/ticket-attachments-list'
import { useTicketEngagements } from './hooks/use-ticket-engagements'
import type {
  TicketEngagementFile,
} from './hooks/use-ticket-engagements'
import { TicketLinkedDeliveryCard } from './ticket-linked-delivery-card'
import type { AnyTicket } from './types'
import { isOptimistic, TICKET_TEXT_MAX_CHARS } from './types'

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
}

export function TicketDetailDrawer({
  ticket,
  busy,
  supportSystemDown,
  onSendMessage,
  onClose,
  onReopen,
  onActionCollapsed,
}: TicketDetailDrawerProps) {
  const isClosed = (ticket.status ?? '').toUpperCase() === 'CLOSED'
  return (
    <div className="bg-ods-card border-t border-ods-border px-4 py-4 flex flex-col gap-4">
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
        {isClosed ? (
          <ReopenAction
            ticketRef={{ id: ticket.id, external_id: ticket.external_id }}
            busy={busy}
            supportSystemDown={supportSystemDown}
            onReopen={onReopen}
            onActionCollapsed={onActionCollapsed}
          />
        ) : (
          <OpenActions
            ticket={ticket}
            busy={busy}
            supportSystemDown={supportSystemDown}
            onSendMessage={onSendMessage}
            onClose={onClose}
            onActionCollapsed={onActionCollapsed}
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

function TicketTimelinePanel({ ticket }: { ticket: AnyTicket }) {
  const identity = useChatIdentity()
  // Optimistic placeholders don't have a real external_id yet — skip
  // the engagement fetch until the real ticket lands.
  const externalId = isOptimistic(ticket) ? null : ticket.external_id
  const { engagements, isLoading } = useTicketEngagements(externalId, !!externalId)

  const bodyTurns = ticket.body
    ? ticket.body.split(TURN_SEPARATOR_RE).map((t) => t.trim()).filter(Boolean)
    : []

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

  if (bodyTurns.length === 0 && engagements.length === 0) {
    // No content yet — distinguish loading from empty so the user
    // doesn't see "No conversation yet" flash during the initial fetch.
    if (isLoading) {
      return <ConversationCardRowSkeletonList rows={2} />
    }
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
    <div className="bg-ods-card border border-ods-border rounded-[6px] overflow-hidden w-full">
      {/* Customer-authored description + any legacy `---`-joined
          comments. Original message gets a special role label; legacy
          updates get "Update N" or "Resolution". Timestamp matches the
          ticket's creation time when available. */}
      {bodyTurns.map((turn, i) => {
        const isResolution = turn.startsWith('[Resolution]')
        const role =
          i === 0 ? 'Original message' : isResolution ? 'Resolution' : `Update ${i}`
        const text = isResolution ? turn.replace(/^\[Resolution\]\s*/, '') : turn
        // Body turns don't carry per-turn timestamps — `ticket.body` is
        // a single content field that HubSpot appends to. The role
        // label ("Original message" / "Update N" / "Resolution") plus
        // the Note engagements below it carry enough chronological
        // context that omitting a timestamp here keeps the row honest.
        return (
          <ConversationCardRow
            key={`body-${i}-${turn.slice(0, 24)}`}
            author={customerName}
            role={role}
            avatarSrc={customerAvatar}
            body={text}
            variant="current-user"
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
        const isOwnReply =
          isCustomer && !!eng.authorId && !!identity.user?.email &&
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

        return (
          <ConversationCardRow
            key={eng.id}
            author={author}
            role={isCustomer ? 'Reply' : 'Note'}
            avatarSrc={avatarSrc}
            timestamp={eng.createdAt}
            body={stripAttachmentsPreamble(eng.body ?? '')}
            attachments={mapEngagementAttachments(eng.attachments)}
            variant={isCustomer ? 'current-user' : 'support'}
          />
        )
      })}

      {isLoading && (
        // Trailing single-row skeleton when the panel already has
        // content rendered — drawer is showing the customer's body
        // turns + cached engagements while a background refetch is
        // in flight. Single row keeps the placeholder modest.
        <ConversationCardRowSkeletonList rows={1} />
      )}
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
    const ok = await onReopen(ticketRef)
    if (ok) onActionCollapsed()
  }
  return (
    <div className="flex justify-end">
      <Button
        type="button"
        onClick={() => void handleReopen()}
        disabled={busy || supportSystemDown}
        loading={busy}
      >
        Reopen
      </Button>
    </div>
  )
}

function OpenActions({
  ticket,
  busy,
  supportSystemDown,
  onSendMessage,
  onClose,
  onActionCollapsed,
}: {
  ticket: AnyTicket
  busy: boolean
  supportSystemDown: boolean
  onSendMessage: TicketDetailDrawerProps['onSendMessage']
  onClose: TicketDetailDrawerProps['onClose']
  onActionCollapsed: TicketDetailDrawerProps['onActionCollapsed']
}) {
  const [messageText, setMessageText] = useState('')
  const [resolution, setResolution] = useState('')
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  const attachments = useChatAttachments()

  const disabled = busy || supportSystemDown
  const ticketRef: TicketRef = { id: ticket.id, external_id: ticket.external_id }

  const hasText = messageText.trim().length > 0
  const hasReadyFiles = attachments.readyAttachments.length > 0
  const canSend =
    !disabled && (hasText || hasReadyFiles) && !attachments.hasInflightUploads

  const sendMessage = async () => {
    if (!canSend) return
    const ok = await onSendMessage(ticketRef, messageText.trim(), attachments.readyAttachments)
    if (ok) {
      setMessageText('')
      attachments.clear()
    }
  }

  const confirmClose = async () => {
    setCloseDialogOpen(false)
    const ok = await onClose(ticketRef, resolution.trim() || undefined)
    setResolution('')
    if (ok) onActionCollapsed()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Textarea
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Type a reply… (attach files if needed)"
          disabled={disabled}
          rows={3}
          maxLength={TICKET_TEXT_MAX_CHARS}
        />
        <ChatAttachmentChipStrip
          attachments={attachments.attachments}
          onRemove={attachments.removeAttachment}
          disabled={disabled}
        />
        <div className="flex justify-between items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ChatAttachmentAddButton
              attachmentsEnabled={!supportSystemDown}
              attachmentsCount={attachments.attachments.length}
              onAddFiles={attachments.addFiles}
              disabled={disabled}
            />
            <span className="text-xs text-ods-text-secondary">Attach files</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="transparent"
              onClick={() => setCloseDialogOpen(true)}
              disabled={disabled}
              className="bg-ods-error hover:bg-ods-error-hover text-white border-transparent"
            >
              Close ticket
            </Button>
            <Button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!canSend}
              loading={busy}
            >
              Send reply
            </Button>
          </div>
        </div>
      </div>

      {/* Destructive-confirm — canonical pattern from
          `components/admin/doc-orchestrator-dashboard.tsx:471`.
          AlertDialog (NOT ModalV2) is the lib's standard for
          destructive confirmations; bg-ods-error is the canonical
          destructive button color. */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent className="bg-ods-card border-ods-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ods-text-primary font-['DM_Sans'] text-[20px] font-semibold">
              Close this ticket?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ods-text-secondary font-['DM_Sans'] text-[14px]">
              Add an optional resolution note below. You can reopen the ticket
              later if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution (optional)"
            rows={3}
            maxLength={TICKET_TEXT_MAX_CHARS}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={busy}
              className="bg-transparent border-ods-border text-ods-text-primary hover:bg-ods-border"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmClose()}
              disabled={busy}
              className="bg-ods-error hover:bg-ods-error-hover text-white"
            >
              Close ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
