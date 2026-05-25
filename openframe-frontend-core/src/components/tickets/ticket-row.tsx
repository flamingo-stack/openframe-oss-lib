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
import { isOptimistic } from './types'

const COMMENT_MAX_CHARS = 5000

type ActionMode = null | 'comment' | 'attach'

export interface TicketRowProps {
  ticket: AnyTicket
  expanded: boolean
  onToggle: (ticketId: string) => void
  busy: boolean
  supportSystemDown: boolean
  onAddNote: (ticketId: string, content: string) => Promise<boolean>
  onAttachFiles: (
    ticketId: string,
    attachments: import('../chat/utils/chat-attachment-markdown').ChatAttachment[],
  ) => Promise<boolean>
  onClose: (ticketId: string, resolution?: string) => Promise<boolean>
  onReopen: (ticketId: string) => Promise<boolean>
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
        />
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Drawer body ────────────────────────────────────────────────────

interface DrawerBodyProps {
  ticket: AnyTicket
  busy: boolean
  supportSystemDown: boolean
  isClosed: boolean
  onAddNote: TicketRowProps['onAddNote']
  onAttachFiles: TicketRowProps['onAttachFiles']
  onClose: TicketRowProps['onClose']
  onReopen: TicketRowProps['onReopen']
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
}: DrawerBodyProps) {
  return (
    <div className="bg-ods-card border-t border-ods-border px-4 py-4 flex flex-col gap-4">
      {/* Zone 1 — metadata strip */}
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

      {/* Zone 2 — description (plaintext readonly) */}
      <div className="border-t border-ods-border pt-4">
        <p className="text-xs font-medium text-ods-text-secondary mb-1 uppercase tracking-wider">
          Description
        </p>
        {ticket.content ? (
          <Textarea
            readOnly
            value={ticket.content}
            rows={4}
            className="resize-none bg-ods-bg/40"
          />
        ) : (
          <p className="text-sm text-ods-text-secondary italic">
            (No description provided.)
          </p>
        )}
      </div>

      {/* Zone 3 — actions */}
      <div className="border-t border-ods-border pt-4">
        {isClosed ? (
          <ReopenAction
            ticketId={ticket.id}
            busy={busy}
            supportSystemDown={supportSystemDown}
            onReopen={onReopen}
          />
        ) : (
          <OpenActions
            ticket={ticket}
            busy={busy}
            supportSystemDown={supportSystemDown}
            onAddNote={onAddNote}
            onAttachFiles={onAttachFiles}
            onClose={onClose}
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

// ─── Reopen-only path (CLOSED tickets) ──────────────────────────────

function ReopenAction({
  ticketId,
  busy,
  supportSystemDown,
  onReopen,
}: {
  ticketId: string
  busy: boolean
  supportSystemDown: boolean
  onReopen: TicketRowProps['onReopen']
}) {
  return (
    <div className="flex justify-end">
      <Button
        type="button"
        onClick={() => void onReopen(ticketId)}
        disabled={busy || supportSystemDown}
        loading={busy}
      >
        Reopen
      </Button>
    </div>
  )
}

// ─── Open path (OPEN tickets) ───────────────────────────────────────

function OpenActions({
  ticket,
  busy,
  supportSystemDown,
  onAddNote,
  onAttachFiles,
  onClose,
}: {
  ticket: AnyTicket
  busy: boolean
  supportSystemDown: boolean
  onAddNote: TicketRowProps['onAddNote']
  onAttachFiles: TicketRowProps['onAttachFiles']
  onClose: TicketRowProps['onClose']
}) {
  const [mode, setMode] = useState<ActionMode>(null)
  const [commentText, setCommentText] = useState('')
  const [resolution, setResolution] = useState('')
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  const attachments = useChatAttachments()

  const disabled = busy || supportSystemDown

  const submitComment = async () => {
    const trimmed = commentText.trim()
    if (trimmed.length === 0 || disabled) return
    const ok = await onAddNote(ticket.id, trimmed)
    if (ok) {
      setCommentText('')
      setMode(null)
    }
  }

  const submitAttachments = async () => {
    if (attachments.readyAttachments.length === 0 || attachments.hasInflightUploads || disabled) {
      return
    }
    const ok = await onAttachFiles(ticket.id, attachments.readyAttachments)
    if (ok) {
      attachments.clear()
      setMode(null)
    }
  }

  const confirmClose = async () => {
    setCloseDialogOpen(false)
    await onClose(ticket.id, resolution.trim() || undefined)
    setResolution('')
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Sub-affordance: Add Comment */}
      {mode === 'comment' && (
        <div className="flex flex-col gap-2">
          <Textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a note for the support team…"
            disabled={disabled}
            rows={3}
            maxLength={COMMENT_MAX_CHARS}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="transparent"
              onClick={() => {
                setCommentText('')
                setMode(null)
              }}
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

      {/* Sub-affordance: Attach files */}
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
              onClick={() => {
                attachments.clear()
                setMode(null)
              }}
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

      {/* Default action strip */}
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

      {/* Close confirmation dialog */}
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
            maxLength={COMMENT_MAX_CHARS}
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
