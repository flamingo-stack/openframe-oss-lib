'use client'

/**
 * Chat-attachment UI primitives.
 *
 * Split into two NAMED EXPORTS following 2026 chat-compose conventions
 * (Claude.ai / ChatGPT / Cursor / Linear AI / etc.):
 *
 *   1. `<ChatAttachmentChipStrip>` — the thumbnail strip with per-file
 *      progress / × remove. Renders ABOVE the textarea (only when
 *      chips exist). Visible to the user as a small horizontal row of
 *      file pills that disappears when they Send.
 *
 *   2. `<ChatAttachmentAddButton>` — the standalone `+` glyph.
 *      Renders INLINE in the bottom-controls row alongside the
 *      `ModelDisplay` (BELOW the textarea, 2026 pattern).
 *      `attachmentsEnabled` arrives as a prop — the hub wires the
 *      `useChatIdentity().attachmentsEnabled` boolean; embedders supply
 *      their own gate. Reserves layout space when disabled
 *      (visibility, not display) so the row's width doesn't jump
 *      when chat-identity resolves.
 *
 * UI principles applied:
 *   - Borderless icon-only `+` (Claude.ai compose-box style).
 *   - Chips strip floats above input, dismissible per-file via ×.
 *   - All colors via ODS tokens; NO hex anywhere.
 *   - NO `capture="environment"` on the file input — iOS Safari would
 *     force camera-only mode and disable file picking.
 */

import { useEffect, useRef, useState } from 'react'
import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon'
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon'
import { Button } from '../ui/button'
import { ANTHROPIC_SUPPORTED_IMAGE_MIME } from './utils/chat-attachment-markdown'

// ===========================================================================
// CONSTANTS & TYPES — inlined from hub `lib/config/chat-attachment-config.ts`
// ===========================================================================

/** Hand-curated chat-attachment allow-list. Intentionally excludes
 *  `image/svg+xml` for XSS safety. */
export const CHAT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
] as const

/** Client-side cap on `addFiles` (the upload hook rejects 6+ files in a
 *  single selection). Server-side is per-IP-rate-limit; this is a UX
 *  hint more than a security boundary. */
export const CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER = 5

type Status = 'sniffing' | 'uploading' | 'ready' | 'error'

/** Staged-attachment shape consumed by the chip strip. Mirrors the hub
 *  `StagedAttachment` produced by `useChatAttachments`. */
export interface StagedAttachment {
  /** Stable client-side id; survives across re-renders. */
  id: string
  file: File
  status: Status
  /** Set when `status === 'ready'`. Server-issued. */
  storagePath?: string
  /** Set when `status === 'ready'`. Server-issued HMAC view token. */
  viewToken?: string
  /** 0-100 during 'uploading'. */
  progress: number
  /** Set when `status === 'error'`. */
  errorMessage?: string
}

// ===========================================================================
// `+` ADD BUTTON — inline in the bottom-controls row (below input)
// ===========================================================================

export interface ChatAttachmentAddButtonProps {
  /** Auth-gate flag. Hub passes `useChatIdentity().attachmentsEnabled`;
   *  embedders supply their own boolean. Disabled state collapses the
   *  button to a layout-reserving invisible placeholder. */
  attachmentsEnabled: boolean
  /** Current attachment count — drives the limit-reached disabled state. */
  attachmentsCount: number
  onAddFiles: (files: FileList | File[]) => void
  /** External disable (e.g. while chat is streaming). */
  disabled?: boolean
}

/**
 * Settled `+` icon-only button for the bottom-controls row.
 *
 * LAYOUT STABILITY — first-paint placeholder pattern:
 *   `attachmentsEnabled` typically resolves ASYNCHRONOUSLY on mount
 *   (hub's `useChatIdentity()` round-trip ~100-500ms). When the flag is
 *   false (loading OR anon final state), the component renders an
 *   INVISIBLE placeholder `<span>` with the same `h-7 w-7 shrink-0`
 *   footprint as the real button. The placeholder reserves layout space
 *   from the very first paint; if `attachmentsEnabled` flips to `true`
 *   the button replaces the placeholder at the IDENTICAL 28×28
 *   position — ZERO shift.
 *
 *   Truly-anon users see the invisible 28×28 spacer permanently —
 *   acceptable trade-off vs the universal jump on every panel open.
 */
export function ChatAttachmentAddButton({
  attachmentsEnabled,
  attachmentsCount,
  onAddFiles,
  disabled = false,
}: ChatAttachmentAddButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!attachmentsEnabled) {
    return <span aria-hidden="true" className="inline-block h-7 w-7 shrink-0" />
  }

  const slotsAvailable = Math.max(
    0,
    CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER - attachmentsCount,
  )
  const canAddMore = slotsAvailable > 0 && !disabled

  const handlePick = () => {
    if (!canAddMore) return
    fileInputRef.current?.click()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={CHAT_ATTACHMENT_MIME_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) {
            onAddFiles(files)
          }
          // Reset so picking the same file twice in a row works
          // (browsers don't refire change on identical selection).
          e.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="transparent"
        size="small"
        onClick={handlePick}
        disabled={!canAddMore}
        aria-label={canAddMore ? 'Add attachments' : 'Attachment limit reached'}
        title={
          canAddMore
            ? 'Add attachments'
            : `Limit reached (${CHAT_ATTACHMENT_CONCURRENT_UPLOADS_PER_USER})`
        }
        leftIcon={<PlusIcon className="h-4 w-4" />}
        className="!h-7 !w-7 !p-0 shrink-0 text-ods-text-muted hover:text-ods-text-primary"
      />
    </>
  )
}

// ===========================================================================
// CHIP STRIP — above input, only when chips exist
// ===========================================================================

export interface ChatAttachmentChipStripProps {
  attachments: StagedAttachment[]
  onRemove: (id: string) => void
  /** External disable (e.g. while chat is streaming). */
  disabled?: boolean
}

/**
 * Horizontal strip of file chips that appears ABOVE the input when one
 * or more attachments are staged. Returns `null` when empty — no
 * permanent UI footprint.
 */
export function ChatAttachmentChipStrip({
  attachments,
  onRemove,
  disabled = false,
}: ChatAttachmentChipStripProps) {
  if (attachments.length === 0) return null
  return (
    <div className="flex-shrink-0 px-5 pb-2">
      <div className="flex items-center gap-2 flex-wrap">
        {attachments.map((att) => (
          <AttachmentChip
            key={att.id}
            attachment={att}
            onRemove={() => onRemove(att.id)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AttachmentChip — single row inside the chip strip
// ---------------------------------------------------------------------------

interface AttachmentChipProps {
  attachment: StagedAttachment
  onRemove: () => void
  disabled: boolean
}

function AttachmentChip({ attachment, onRemove, disabled }: AttachmentChipProps) {
  const { file, status, progress, errorMessage } = attachment
  const isImage = (ANTHROPIC_SUPPORTED_IMAGE_MIME as readonly string[]).includes(file.type)

  // Inline thumbnail for images during STAGING (pre-upload-complete).
  // Local `URL.createObjectURL` blob — the user sees their image
  // immediately, no waiting on the upload to finish.
  const blobUrl = useObjectUrl(isImage ? file : null)

  return (
    <div
      className="flex items-center gap-2 rounded-md border border-ods-border bg-ods-card px-2 py-1.5 max-w-[240px]"
      role="group"
      aria-label={`Attachment ${file.name}`}
    >
      {/* Thumbnail OR file-type initials */}
      <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-ods-bg">
        {isImage && blobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URLs
          //  cannot go through next/image; this is a transient pre-upload
          //  preview, NOT the chat-history render path.
          <img src={blobUrl} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-mono uppercase text-ods-text-muted">
            {extLabel(file.name)}
          </div>
        )}
        {/* Progress overlay during 'uploading' state */}
        {status === 'uploading' && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-ods-bg">
            <div
              className="h-full bg-ods-accent transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Filename + status */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-ods-text-primary" title={file.name}>
          {file.name}
        </div>
        <div className="text-[10px] text-ods-text-muted">
          {status === 'sniffing' && 'Checking…'}
          {status === 'uploading' && `${progress}% · ${formatFileSize(file.size)}`}
          {status === 'ready' && formatFileSize(file.size)}
          {status === 'error' && (
            <span className="text-ods-attention-red-error" title={errorMessage}>
              {errorMessage ?? 'Upload failed'}
            </span>
          )}
        </div>
      </div>

      {/* Remove button — UI-Kit Button with `transparent` + `small`. */}
      <Button
        type="button"
        variant="transparent"
        size="small"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
        leftIcon={<XmarkIcon className="h-3.5 w-3.5" />}
        className="!h-5 !w-5 !p-0 shrink-0 text-ods-text-muted hover:text-ods-text-primary"
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers — inlined from hub upload-utils.ts to keep this file standalone
// ---------------------------------------------------------------------------

/** Same byte-rounding shape as the hub `formatFileSize` in
 *  `lib/utils/upload-utils.ts`. Inlined so the lib doesn't pull in the
 *  hub upload service. */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function extLabel(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  if (dot === -1 || dot === fileName.length - 1) return '?'
  return fileName.slice(dot + 1, dot + 4).toLowerCase()
}

/** Manage an `URL.createObjectURL` blob URL for the lifetime of the
 *  component. Returns null when `file` is null or during SSR.
 *  Revokes on unmount AND when `file` changes. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!file) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}
