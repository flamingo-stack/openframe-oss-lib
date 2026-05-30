'use client'

import { useCallback, useState } from 'react'
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
import { ChatInput } from './../chat/chat-input'
import {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
} from './../chat/chat-attachment-bar'
import { useChatAttachments } from './../chat/hooks/use-chat-attachments'
import type { AnyTicket } from './types'
import { TICKET_TEXT_MAX_CHARS } from './types'
import type { TicketDetailDrawerProps, TicketRef } from './ticket-detail-drawer'

export interface TicketReplyComposerProps {
  ticket: AnyTicket
  busy: boolean
  supportSystemDown: boolean
  onSendMessage: TicketDetailDrawerProps['onSendMessage']
  onClose: TicketDetailDrawerProps['onClose']
}

/**
 * Open-ticket reply composer — REUSES the exact same layout as the global
 * Ask-AI chat composer (`embeddable-chat.tsx`): the shared `<ChatInput>` with
 * the staged-file chip strip above it and the attachment `+` button in a
 * controls row BELOW the input (identical placement to the global chat), plus
 * the destructive close-confirm `AlertDialog`.
 *
 * Replaces the former `OpenActions` raw-`<Textarea>` composer. The text lives
 * inside `ChatInput`; this component owns only the attachment bag + the close
 * dialog. Send semantics:
 *   - `sending={busy || hasInflightUploads}` disables the input while sending
 *     OR uploading (same as the global chat); `allowEmptySend` lets an
 *     attachments-only reply send once uploads finish;
 *   - the typed draft + staged files survive a FAILED send: `handleSend`
 *     returns `false`, so `ChatInput` keeps the text and we only `clear()` the
 *     attachments on success;
 *   - close does NOT collapse the drawer (no `onActionCollapsed`).
 *
 * `disabled={supportSystemDown}` is the only flag that drives the "Connection
 * lost…" placeholder. The `+` attach gate stays `!supportSystemDown` (same gate
 * the old composer used).
 */
export function TicketReplyComposer({
  ticket,
  busy,
  supportSystemDown,
  onSendMessage,
  onClose,
}: TicketReplyComposerProps) {
  const [resolution, setResolution] = useState('')
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const attachments = useChatAttachments()

  const ticketRef: TicketRef = { id: ticket.id, external_id: ticket.external_id }
  const hasReadyFiles = attachments.readyAttachments.length > 0

  const handleSend = useCallback(
    async (text: string): Promise<boolean> => {
      const ref: TicketRef = { id: ticket.id, external_id: ticket.external_id }
      const ok = await onSendMessage(ref, text.trim(), attachments.readyAttachments)
      if (ok) attachments.clear()
      return ok
    },
    // Depend on the reactive projections, not the whole bag (a fresh object each
    // render). `readyAttachments` is memo-stable; `clear` is callback-stable.
    [
      onSendMessage,
      ticket.id,
      ticket.external_id,
      attachments.readyAttachments,
      attachments.clear,
    ],
  )

  const confirmClose = async () => {
    setCloseDialogOpen(false)
    await onClose(ticketRef, resolution.trim() || undefined)
    setResolution('')
    // Intentionally NO `onActionCollapsed()` — collapsing the drawer after a
    // close dismisses the ticket the user is working on (PR #1053). The
    // optimistic in-place status update keeps the row mounted with the new
    // badge; that is the only feedback needed.
  }

  const disabled = busy || supportSystemDown

  return (
    <div className="flex flex-col gap-2">
      {/* Unified composer — mirrors the global Ask-AI chat layout
          (embeddable-chat.tsx :1160-1206): compact staged-file chip strip
          above, the shared <ChatInput> (Send icon = the PRIMARY action), then a
          quiet bottom toolbar: attachment "+" on the left, and a LOW-EMPHASIS
          "Close ticket" text button on the right. Closing is reversible (Reopen
          exists), so it is NOT styled as destructive/danger — that would
          over-signal a routine, undoable status change (UX best practice:
          reserve red for irreversible actions). */}
      <ChatAttachmentChipStrip
        attachments={attachments.attachments}
        onRemove={attachments.removeAttachment}
        disabled={disabled}
        size="compact"
      />
      <ChatInput
        fullWidth
        // Focus the reply box when the drawer opens so the customer can type
        // immediately. `ChatInput`'s autoFocus uses `{ preventScroll: true }`,
        // so this does NOT scroll the page — the card's smooth scroll-to-top
        // (HelpCenterCard) wins, and the input stays focused + visible (it
        // sits within the viewport below the fixed-height feed).
        autoFocus
        placeholder="Type a reply…"
        sending={busy || attachments.hasInflightUploads}
        disabled={supportSystemDown}
        allowEmptySend={hasReadyFiles}
        maxLength={TICKET_TEXT_MAX_CHARS}
        onSend={handleSend}
      />
      <div className="flex items-center gap-2 w-full">
        {!supportSystemDown && (
          <ChatAttachmentAddButton
            attachmentsEnabled
            attachmentsCount={attachments.attachments.length}
            onAddFiles={attachments.addFiles}
            disabled={disabled}
            size="compact"
          />
        )}
        <div className="flex-1 min-w-0" />
        <Button
          type="button"
          variant="transparent"
          size="small"
          onClick={() => setCloseDialogOpen(true)}
          disabled={disabled}
          className="text-ods-text-secondary hover:text-ods-text-primary"
        >
          Close ticket
        </Button>
      </div>

      {/* Confirm dialog — collects an optional resolution note. Closing is
          REVERSIBLE, so the confirm action is the standard accent primary, NOT
          a red destructive button. */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent className="bg-ods-card border-ods-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-ods-text-primary">
              Close this ticket?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ods-text-secondary">
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
              className="bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover"
            >
              Close ticket
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
