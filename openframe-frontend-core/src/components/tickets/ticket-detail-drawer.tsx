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
  ModalV2,
  ModalV2Content,
  ModalV2Footer,
  ModalV2Header,
  ModalV2Title,
} from './../ui/modal-v2'
import {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
} from './../chat/chat-attachment-bar'
import { useChatAttachments } from './../chat/hooks/use-chat-attachments'
import { useChatIdentity } from './../chat/hooks/use-chat-identity'
import { formatRelativeTime } from './../../utils/date-utils'
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col gap-1 text-ods-text-secondary">
          <MetadataRow label="Ticket" value={`#${ticket.external_id}`} />
          <MetadataRow label="Priority" value={ticket.priority || '—'} />
          <MetadataRow label="Pipeline" value={ticket.pipeline_stage_label || '—'} />
          <MetadataRow label="Company" value={ticket.customer_company || '—'} />
        </div>
        <div className="flex flex-col gap-1 md:items-end text-ods-text-secondary">
          <MetadataRow
            label="Updated"
            value={
              ticket.hubspot_updated_at
                ? formatRelativeTime(ticket.hubspot_updated_at)
                : '—'
            }
            title={ticket.hubspot_updated_at ?? undefined}
          />
        </div>
      </div>

      <div className="border-t border-ods-border pt-4">
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

function MetadataRow({
  label,
  value,
  title,
}: {
  label: string
  value: string
  title?: string
}) {
  return (
    <span title={title} className="flex gap-2">
      <span className="text-xs uppercase tracking-wider opacity-60">
        {label}
      </span>
      <span className="text-sm text-ods-text-primary">{value}</span>
    </span>
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
const TURN_SEPARATOR_RE = /\s+---\s+/g

function TicketTimelinePanel({ ticket }: { ticket: AnyTicket }) {
  const identity = useChatIdentity()
  // Optimistic placeholders don't have a real external_id yet — skip
  // the engagement fetch until the real ticket lands.
  const externalId = isOptimistic(ticket) ? null : ticket.external_id
  const { engagements, isLoading } = useTicketEngagements(externalId, !!externalId)

  const bodyTurns = ticket.body
    ? ticket.body.split(TURN_SEPARATOR_RE).map((t) => t.trim()).filter(Boolean)
    : []

  const customerName = identity.user?.name || identity.user?.email || 'You'
  const customerAvatar = identity.user?.avatarUrl ?? undefined

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
              avatar LIVE from `identity.user.*`. This is the
              source of truth for the logged-in user's display info
              (NOT the mirror's `sender_name`, which is baked-in at
              post time and may be stale after the user updates
              their profile / identity headers).
            - CUSTOMER messages whose sender is a DIFFERENT email
              (rare — shouldn't happen on /tickets since the user
              only sees their own threads) → fall back to the
              email shown verbatim. No profile lookup.
            - SUPPORT/Note messages → "Support team" + neutral
              avatar treatment. (TODO: when the engagement carries
              a known team-member owner email, look up that
              `profiles` row for the agent's name + avatar — see
              hubspot-conversations-utils.ts removal note.) */}
      {engagements.map((eng) => {
        const isCustomer = eng.authorRole === 'customer'
        const isOwnReply =
          isCustomer && !!eng.authorId && !!identity.user?.email &&
          eng.authorId.toLowerCase() === identity.user.email.toLowerCase()

        let author: string
        let avatarSrc: string | undefined
        if (isCustomer && isOwnReply) {
          // Live identity is the source of truth for THIS user.
          author = identity.user?.name?.trim() || customerName
          avatarSrc = identity.user?.avatarUrl ?? undefined
        } else if (isCustomer) {
          author = eng.authorName ?? eng.authorId ?? customerName
          avatarSrc = undefined
        } else {
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
              variant="destructive"
              onClick={() => setCloseDialogOpen(true)}
              disabled={disabled}
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

      <ModalV2 isOpen={closeDialogOpen} onClose={() => setCloseDialogOpen(false)}>
        <ModalV2Header>
          <ModalV2Title>Close this ticket?</ModalV2Title>
          <p className="text-sm text-ods-text-secondary mt-1">
            Add an optional resolution note. You can reopen the ticket later if
            needed.
          </p>
        </ModalV2Header>
        <ModalV2Content>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution (optional)"
            rows={3}
            maxLength={TICKET_TEXT_MAX_CHARS}
          />
        </ModalV2Content>
        <ModalV2Footer>
          <Button
            type="button"
            variant="transparent"
            onClick={() => setCloseDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirmClose()}
          >
            Close ticket
          </Button>
        </ModalV2Footer>
      </ModalV2>
    </div>
  )
}
