'use client'
// compact-size support added for the ticket-drawer reply composer.

import { formatFileSize } from '../../utils/format'

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
import { cn } from '../../utils/cn'
import { ANTHROPIC_SUPPORTED_IMAGE_MIME } from './utils/chat-attachment-markdown'

/** Chip strip / chip density. `compact` shrinks the thumbnail, padding, text
 *  and max-width for narrow surfaces (e.g. the ticket-drawer reply composer);
 *  `default` is the global Ask-AI chat sizing. */
export type ChatAttachmentSize = 'default' | 'compact'

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
  /** Density. `compact` renders a smaller 24×24 button for narrow surfaces
   *  (ticket-drawer composer); `default` is the 28×28 global-chat button. */
  size?: ChatAttachmentSize
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
  size = 'default',
}: ChatAttachmentAddButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const compact = size === 'compact'
  // Keep the placeholder footprint in lockstep with the real button size so
  // there's zero layout shift when `attachmentsEnabled` resolves.
  const boxClass = compact ? 'h-6 w-6' : 'h-7 w-7'

  if (!attachmentsEnabled) {
    return <span aria-hidden="true" className={cn('inline-block shrink-0', boxClass)} />
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
        leftIcon={<PlusIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
        className={cn('!p-0 shrink-0 text-ods-text-muted hover:text-ods-text-primary', compact ? '!h-6 !w-6' : '!h-7 !w-7')}
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
  /** Density. `compact` (smaller thumbnail/padding/text, narrower chips) suits
   *  narrow surfaces like the ticket-drawer reply composer; `default` is the
   *  global Ask-AI chat sizing. */
  size?: ChatAttachmentSize
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
  size = 'default',
}: ChatAttachmentChipStripProps) {
  if (attachments.length === 0) return null
  const compact = size === 'compact'
  return (
    <div className={cn('flex-shrink-0', compact ? 'px-3 pb-1.5' : 'px-5 pb-2')}>
      <div className={cn('flex items-center flex-wrap', compact ? 'gap-1.5' : 'gap-2')}>
        {attachments.map((att) => (
          <AttachmentChip
            key={att.id}
            attachment={att}
            onRemove={() => onRemove(att.id)}
            disabled={disabled}
            size={size}
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
  size?: ChatAttachmentSize
}

function AttachmentChip({ attachment, onRemove, disabled, size = 'default' }: AttachmentChipProps) {
  const { file, status, progress, errorMessage } = attachment
  const isImage = (ANTHROPIC_SUPPORTED_IMAGE_MIME as readonly string[]).includes(file.type)
  const compact = size === 'compact'

  // Inline thumbnail for images during STAGING (pre-upload-complete).
  // Local `URL.createObjectURL` blob — the user sees their image
  // immediately, no waiting on the upload to finish.
  const blobUrl = useObjectUrl(isImage ? file : null)

  return (
    <div
      className={cn(
        'flex items-center rounded-md border border-ods-border bg-ods-card',
        compact ? 'gap-1.5 px-1.5 py-1 max-w-[180px]' : 'gap-2 px-2 py-1.5 max-w-[240px]',
      )}
      role="group"
      aria-label={`Attachment ${file.name}`}
    >
      {/* Thumbnail OR file-type initials */}
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded bg-ods-bg',
          compact ? 'h-6 w-6' : 'h-8 w-8',
        )}
      >
        {isImage && blobUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- blob: URLs
          //  cannot go through next/image; this is a transient pre-upload
          //  preview, NOT the chat-history render path.
          <img src={blobUrl} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <div className={cn('flex h-full w-full items-center justify-center font-mono uppercase text-ods-text-muted', compact ? 'text-[9px]' : 'text-[10px]')}>
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
        <div className={cn('truncate text-ods-text-primary', compact ? 'text-[11px] leading-tight' : 'text-xs')} title={file.name}>
          {file.name}
        </div>
        {/* Compact mode hides the size/status sub-line for ready files to keep the
            chip to a single line; uploading/error states still surface. */}
        {(!compact || status !== 'ready') && (
          <div className={cn('text-ods-text-muted', compact ? 'text-[9px] leading-tight' : 'text-[10px]')}>
            {status === 'sniffing' && 'Checking…'}
            {status === 'uploading' && `${progress}% · ${formatFileSize(file.size)}`}
            {status === 'ready' && formatFileSize(file.size)}
            {status === 'error' && (
              <span className="text-ods-attention-red-error" title={errorMessage}>
                {errorMessage ?? 'Upload failed'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Remove button — UI-Kit Button with `transparent` + `small`. */}
      <Button
        type="button"
        variant="transparent"
        size="small"
        onClick={onRemove}
        disabled={disabled}
        aria-label={`Remove ${file.name}`}
        leftIcon={<XmarkIcon className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
        className={cn('!p-0 shrink-0 text-ods-text-muted hover:text-ods-text-primary', compact ? '!h-4 !w-4' : '!h-5 !w-5')}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// formatFileSize was previously inlined here as a copy of the hub's helper. It
// now lives in `../../utils/format.ts` (lifted during the doc-viewer unification).
// Imported at the top of this file.

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
