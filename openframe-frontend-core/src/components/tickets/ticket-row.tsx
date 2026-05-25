'use client'

/**
 * Single ticket row + expanded details drawer.
 *
 * Layout:
 *   1. `<ChatTicketItem>` summary tile (existing component, reused as-is).
 *      Clicking it toggles the `expandedTicketId` state owned by the parent
 *      `<TicketCenter>` — we use the item's existing `onClick` prop rather
 *      than nesting a `<CollapsibleTrigger>` (button-in-button is invalid).
 *   2. `<CollapsibleContent>` drawer beneath the tile, rendered only when
 *      this row is the expanded one.
 *
 * Drawer zones (see plan §C-3a):
 *   - Metadata strip (read-only key/value labels)
 *   - Description block (plaintext readonly Textarea — NO markdown)
 *   - Actions strip (status-dependent: comment/attach/close OR reopen)
 */

import { useState } from 'react'
import {
  Collapsible,
  CollapsibleContent,
} from '../collapsible'
import { Card } from '../ui/card'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import {
  ChatTicketItem,
  type ChatTicketItemData,
} from '../chat/entity-cards/chat-ticket-item'
import {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
} from '../chat/chat-attachment-bar'
import { useChatAttachments } from '../chat/hooks/use-chat-attachments'
import { formatRelativeTime } from '../../utils/date-utils'
import type { AnyTicket } from './types'
import { isOptimistic, TICKET_TEXT_MAX_CHARS } from './types'

type ActionMode = null | 'comment' | 'attach'

/** Identity bundle: local mirror UUID + HubSpot external_id. Actions
 *  send `external_id` to HubSpot (the only id it recognizes) and use
 *  `id` for the React-side mutex + cache. */
type TicketRef = { id: string; external_id: string }

export interface TicketRowProps {
  ticket: AnyTicket
  expanded: boolean
  onToggle: (ticketId: string) => void
  busy: boolean
  supportSystemDown: boolean
  onAddNote: (ticket: TicketRef, content: string) => Promise<boolean>
  onAttachFiles: (
    ticket: TicketRef,
    attachments: import('../chat/utils/chat-attachment-markdown').ChatAttachment[],
  ) => Promise<boolean>
  onClose: (ticket: TicketRef, resolution?: string) => Promise<boolean>
  onReopen: (ticket: TicketRef) => Promise<boolean>
  /** Called after a successful close/reopen so the parent can collapse
   *  the drawer (status flipped — current action set is now stale). */
  onActionCollapsed: () => void
}

export function TicketRow({
  ticket,
  expanded,
  onToggle,
  busy,
  supportSystemDown,
  onAddNote,
  onAttachFiles,
  onClose,
  onReopen,
  onActionCollapsed,
}: TicketRowProps) {
  // Optimistic placeholders have no drawer — the real id hasn't arrived yet,
  // so action targets would be undefined.
  const optimistic = isOptimistic(ticket)

  // Project the wider TicketData onto the narrower ChatTicketItemData shape
  // the existing summary tile expects. The `_optimistic` flag is dropped
  // here so it doesn't leak to the DOM as an unknown prop on the underlying
  // `<button>`.
  const tileData: ChatTicketItemData = {
    id: ticket.id,
    title: ticket.subject ?? '(untitled)',
    ticketNumber: `#${ticket.external_id}`,
    status: ticket.status ?? 'OPEN',
    category: ticket.customer_company ?? undefined,
    timeAgo: ticket.hubspot_updated_at
      ? formatRelativeTime(ticket.hubspot_updated_at)
      : undefined,
  }

  const isClosed = (ticket.status ?? '').toUpperCase() === 'CLOSED'

  return (
    <Collapsible open={expanded && !optimistic} className="border-b border-ods-border last:border-b-0">
      <ChatTicketItem
        ticket={tileData}
        onClick={optimistic ? undefined : onToggle}
        aria-expanded={expanded && !optimistic}
        aria-controls={`ticket-drawer-${ticket.id}`}
      />
      <CollapsibleContent
        id={`ticket-drawer-${ticket.id}`}
        className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down"
      >
        <DrawerBody
          ticket={ticket}
          busy={busy}
          supportSystemDown={supportSystemDown}
          isClosed={isClosed}
          onAddNote={onAddNote}
          onAttachFiles={onAttachFiles}
          onClose={onClose}
          onReopen={onReopen}
          onActionCollapsed={onActionCollapsed}
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

interface DrawerBodyProps {
  ticket: AnyTicket
  busy: boolean
  supportSystemDown: boolean
  isClosed: boolean
  onAddNote: TicketRowProps['onAddNote']
  onAttachFiles: TicketRowProps['onAttachFiles']
  onClose: TicketRowProps['onClose']
  onReopen: TicketRowProps['onReopen']
  onActionCollapsed: TicketRowProps['onActionCollapsed']
}

function DrawerBody({
  ticket,
  busy,
  supportSystemDown,
  isClosed,
  onAddNote,
  onAttachFiles,
  onClose,
  onReopen,
  onActionCollapsed,
}: DrawerBodyProps) {
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
          Description &amp; Updates
        </p>
        {ticket.body ? (
          // `body` is the server's sanitized full content. The
          // update_ticket executor re-writes this property with
          // `oldContent\n\n---\n\n<addendum>` for every comment, so
          // the user sees the original message + every comment they
          // (or staff) added without a separate notes-engagement
          // fetch. Rendered as a non-interactive scroll panel — NOT
          // <Textarea>, which has hover/active styles for editable
          // input that flash the surface light on mouseover.
          <div
            className="text-sm text-ods-text-primary whitespace-pre-wrap break-words rounded-md border border-ods-border bg-ods-card p-3 max-h-64 overflow-y-auto"
          >
            {ticket.body}
          </div>
        ) : (
          <p className="text-sm text-ods-text-secondary italic">
            (No description provided.)
          </p>
        )}
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
            onAddNote={onAddNote}
            onAttachFiles={onAttachFiles}
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
  onReopen: TicketRowProps['onReopen']
  onActionCollapsed: TicketRowProps['onActionCollapsed']
}) {
  const handleReopen = async () => {
    const ok = await onReopen(ticketRef)
    // Reopen flips status to OPEN — current action set (just "Reopen")
    // is now stale; collapse so the next expand shows the OPEN actions.
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
  onAddNote,
  onAttachFiles,
  onClose,
  onActionCollapsed,
}: {
  ticket: AnyTicket
  busy: boolean
  supportSystemDown: boolean
  onAddNote: TicketRowProps['onAddNote']
  onAttachFiles: TicketRowProps['onAttachFiles']
  onClose: TicketRowProps['onClose']
  onActionCollapsed: TicketRowProps['onActionCollapsed']
}) {
  const [mode, setMode] = useState<ActionMode>(null)
  const [commentText, setCommentText] = useState('')
  const [resolution, setResolution] = useState('')
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  const attachments = useChatAttachments()

  const disabled = busy || supportSystemDown

  // Reset the sub-affordance state when the user cancels OR after a
  // successful submit. Both paths clear the textarea AND any staged
  // attachments, even when the cancelled mode wasn't the attachment
  // mode (defensive — symmetry prevents files leaking across mode
  // toggles within an open drawer).
  const resetSubAffordance = () => {
    setMode(null)
    setCommentText('')
    attachments.clear()
  }

  const ticketRef: TicketRef = { id: ticket.id, external_id: ticket.external_id }

  const submitComment = async () => {
    const trimmed = commentText.trim()
    if (trimmed.length === 0 || disabled) return
    const ok = await onAddNote(ticketRef, trimmed)
    if (ok) resetSubAffordance()
  }

  const submitAttachments = async () => {
    if (attachments.readyAttachments.length === 0 || attachments.hasInflightUploads || disabled) {
      return
    }
    const ok = await onAttachFiles(ticketRef, attachments.readyAttachments)
    if (ok) resetSubAffordance()
  }

  const confirmClose = async () => {
    setCloseDialogOpen(false)
    const ok = await onClose(ticketRef, resolution.trim() || undefined)
    setResolution('')
    // Close flips status to CLOSED — current action set is stale;
    // collapse the drawer so re-expand shows the Reopen-only view.
    if (ok) onActionCollapsed()
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === 'comment' && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a note for the support team…"
            disabled={disabled}
            rows={3}
            maxLength={TICKET_TEXT_MAX_CHARS}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="transparent"
              onClick={resetSubAffordance}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitComment()}
              disabled={disabled || commentText.trim().length === 0}
              loading={busy}
            >
              Post comment
            </Button>
          </div>
        </div>
      )}

      {mode === 'attach' && (
        <div className="flex flex-col gap-2">
          <ChatAttachmentChipStrip
            attachments={attachments.attachments}
            onRemove={attachments.removeAttachment}
            disabled={disabled}
          />
          <div className="flex justify-end items-center gap-2">
            <ChatAttachmentAddButton
              attachmentsEnabled={!supportSystemDown}
              attachmentsCount={attachments.attachments.length}
              onAddFiles={attachments.addFiles}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="transparent"
              onClick={resetSubAffordance}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submitAttachments()}
              disabled={
                disabled ||
                attachments.readyAttachments.length === 0 ||
                attachments.hasInflightUploads
              }
              loading={busy}
            >
              Upload
            </Button>
          </div>
        </div>
      )}

      {mode === null && (
        <div className="flex justify-end gap-2 flex-wrap">
          <Button
            type="button"
            variant="transparent"
            onClick={() => setMode('comment')}
            disabled={disabled}
          >
            Add comment
          </Button>
          <Button
            type="button"
            variant="transparent"
            onClick={() => setMode('attach')}
            disabled={disabled}
          >
            Attach files
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setCloseDialogOpen(true)}
            disabled={disabled}
          >
            Close ticket
          </Button>
        </div>
      )}

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close this ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Add an optional resolution note. You can reopen the ticket later if
              needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Resolution (optional)"
            rows={3}
            maxLength={TICKET_TEXT_MAX_CHARS}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmClose()}>
              Close ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
