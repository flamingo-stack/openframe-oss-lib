'use client'

/**
 * The "Open Ticket" form at the top of <TicketCenter />.
 *
 * Composition only — every leaf is an existing oss-lib primitive:
 *   - `<Input>` for subject
 *   - `<Textarea>` for content
 *   - `<ChatAttachmentAddButton>` + `<ChatAttachmentChipStrip>` for files
 *   - `<Button>` for submit
 *
 * Submit gating combines:
 *   - subject + content trim non-empty
 *   - no uploads in flight
 *   - not currently submitting (single-flight, parent-owned)
 *   - support system online
 */

import { useState } from 'react'
import { Card } from '../ui/card'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import {
  ChatAttachmentAddButton,
  ChatAttachmentChipStrip,
} from '../chat/chat-attachment-bar'
import { useChatAttachments } from '../chat/hooks/use-chat-attachments'

/** Defensive client-side cap. HubSpot Note engagement supports more
 *  but a 100KB paste should fail fast at the UI rather than burning a
 *  round trip. Tracked for future server-side hardening. */
const CONTENT_MAX_CHARS = 5000
const COUNTER_VISIBLE_AT = Math.floor(CONTENT_MAX_CHARS * 0.8)

export interface TicketOpenFormProps {
  /** Wired to `useTicketActions().submitTicket`. Returns true on success
   *  so the form can clear itself. */
  onSubmit: (input: { subject: string; content: string; attachments: import('../chat/utils/chat-attachment-markdown').ChatAttachment[] }) => Promise<boolean>
  isSubmitting: boolean
  supportSystemDown: boolean
}

export function TicketOpenForm({
  onSubmit,
  isSubmitting,
  supportSystemDown,
}: TicketOpenFormProps) {
  const [subject, setSubject] = useState('')
  const [content, setContent] = useState('')

  // Reuse the chat composer's attachment hook directly — same upload
  // pipeline, same readiness flags. The hook returns `readyAttachments`
  // (the wire-shape projection) and `hasInflightUploads`.
  const { attachments, readyAttachments, hasInflightUploads, addFiles, removeAttachment, clear } = useChatAttachments()

  const trimmedSubject = subject.trim()
  const trimmedContent = content.trim()
  const overCap = content.length > CONTENT_MAX_CHARS
  const showCounter = content.length >= COUNTER_VISIBLE_AT

  const canSubmit =
    !isSubmitting &&
    !supportSystemDown &&
    !hasInflightUploads &&
    trimmedSubject.length > 0 &&
    trimmedContent.length > 0 &&
    !overCap

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const ok = await onSubmit({
      subject: trimmedSubject,
      content: trimmedContent,
      attachments: readyAttachments,
    })
    if (ok) {
      setSubject('')
      setContent('')
      clear()
    }
  }

  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6">
        {/* Left column — title + description, mirrors the Figma split */}
        <div className="flex-1 min-w-0 md:max-w-md">
          <h2 className="text-2xl font-semibold text-ods-text-primary mb-2">
            Need Support?
          </h2>
          <p className="text-ods-text-secondary text-sm">
            Can&apos;t find what you&apos;re looking for? Submit a support ticket
            below — we&apos;ll follow up shortly.
          </p>
          {supportSystemDown && (
            <p className="mt-4 text-sm text-ods-error">
              Support system temporarily unavailable. Please try again shortly.
            </p>
          )}
        </div>

        {/* Right column — form fields */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <div>
            <label
              htmlFor="ticket-subject"
              className="block text-sm font-medium text-ods-text-primary mb-1"
            >
              Ticket Subject
            </label>
            <Input
              id="ticket-subject"
              type="text"
              placeholder="Enter Subject Here"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSubmitting || supportSystemDown}
              maxLength={200}
            />
          </div>

          <div>
            <label
              htmlFor="ticket-content"
              className="block text-sm font-medium text-ods-text-primary mb-1"
            >
              Your Message
            </label>
            <Textarea
              id="ticket-content"
              placeholder="Describe your issue or question in detail..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting || supportSystemDown}
              rows={5}
              className="resize-none"
            />
            {showCounter && (
              <p
                className={`mt-1 text-xs text-right ${
                  overCap ? 'text-ods-error' : 'text-ods-text-secondary'
                }`}
              >
                {content.length}/{CONTENT_MAX_CHARS}
              </p>
            )}
          </div>

          {/* Attachment composer — reuses the chat composer primitives.
              ChipStrip returns null when empty so it has no permanent
              footprint. */}
          <ChatAttachmentChipStrip
            attachments={attachments}
            onRemove={removeAttachment}
            disabled={isSubmitting || supportSystemDown}
          />

          <div className="flex items-center justify-between gap-3">
            <ChatAttachmentAddButton
              attachmentsEnabled={!supportSystemDown}
              attachmentsCount={attachments.length}
              onAddFiles={addFiles}
              disabled={isSubmitting}
            />
            <Button
              type="submit"
              disabled={!canSubmit}
              loading={isSubmitting}
            >
              Open Ticket
            </Button>
          </div>
        </div>
      </form>
    </Card>
  )
}
