'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import {
  ModalV2,
  ModalV2Header,
  ModalV2Title,
  ModalV2Footer,
} from '../ui/modal-v2'
import type { DialogItem } from './types/component.types'

// Shared button styling for the modal footers (Figma `button-full`):
// full-width, `text-h3` (DM Sans Bold 18px), 12/16 padding, rounded-md.
const footerBtn =
  'flex-1 min-w-0 rounded-md px-[var(--spacing-system-m)] py-[var(--spacing-system-sf)] text-h3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent disabled:opacity-50 disabled:cursor-not-allowed'
const cancelBtn = cn(
  footerBtn,
  'border border-ods-border bg-transparent text-ods-text-primary hover:bg-ods-bg-hover',
)
const saveBtn = cn(
  footerBtn,
  'bg-ods-accent text-ods-text-on-accent hover:bg-ods-accent-hover',
)
const dangerBtn = cn(
  footerBtn,
  'bg-ods-error text-ods-text-on-accent hover:opacity-90',
)

// =============================================================================
// Rename
// =============================================================================

export interface RenameChatModalProps {
  isOpen: boolean
  /** Current chat name, used to seed the input each time the modal opens. */
  initialName?: string
  onClose: () => void
  /** Fired with the trimmed new name when Save is pressed. */
  onSave: (name: string) => void
}

/** Rename Chat modal — Figma node `7592:225962`. */
export function RenameChatModal({
  isOpen,
  initialName = '',
  onClose,
  onSave,
}: RenameChatModalProps) {
  const [name, setName] = React.useState(initialName)
  // Reseed whenever the modal (re)opens — possibly for a different chat.
  React.useEffect(() => {
    if (isOpen) setName(initialName)
  }, [isOpen, initialName])

  const canSave = name.trim().length > 0
  const save = () => {
    if (canSave) onSave(name.trim())
  }

  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className="md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Rename Chat</ModalV2Title>
      </ModalV2Header>
      <div className="flex w-full flex-col gap-[var(--spacing-system-xxs)]">
        <label htmlFor="rename-chat-input" className="text-h4 text-ods-text-primary">
          Chat Name
        </label>
        <input
          id="rename-chat-input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
          }}
          className="w-full rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)] text-h4 text-ods-text-primary focus:outline-none focus-visible:border-ods-accent"
        />
      </div>
      <ModalV2Footer>
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancel
        </button>
        <button type="button" onClick={save} disabled={!canSave} className={saveBtn}>
          Save
        </button>
      </ModalV2Footer>
    </ModalV2>
  )
}

// =============================================================================
// Archive
// =============================================================================

export interface ArchiveChatModalProps {
  isOpen: boolean
  onClose: () => void
  /** Fired when the destructive "Archive Chat" button is pressed. */
  onConfirm: () => void
}

/** Archive Chat confirmation modal — Figma node `7592:226181`. */
export function ArchiveChatModal({
  isOpen,
  onClose,
  onConfirm,
}: ArchiveChatModalProps) {
  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className="md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Archive Chat</ModalV2Title>
      </ModalV2Header>
      <p className="w-full text-h4 text-ods-text-primary">
        This chat will be hidden from your current chats.
      </p>
      <ModalV2Footer>
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className={dangerBtn}>
          Archive Chat
        </button>
      </ModalV2Footer>
    </ModalV2>
  )
}

// =============================================================================
// Unarchive
// =============================================================================

export interface UnarchiveChatModalProps {
  isOpen: boolean
  onClose: () => void
  /** Fired when the "Unarchive Chat" button is pressed. */
  onConfirm: () => void
}

/** Unarchive (restore) Chat confirmation modal — restores an archived chat
 *  back to the current chats so the user can continue it. */
export function UnarchiveChatModal({
  isOpen,
  onClose,
  onConfirm,
}: UnarchiveChatModalProps) {
  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className="md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Unarchive Chat</ModalV2Title>
      </ModalV2Header>
      <p className="w-full text-h4 text-ods-text-primary">
        This chat will be moved back to your current chats.
      </p>
      <ModalV2Footer>
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancel
        </button>
        <button type="button" onClick={onConfirm} className={saveBtn}>
          Unarchive Chat
        </button>
      </ModalV2Footer>
    </ModalV2>
  )
}

// =============================================================================
// Composite — all three dialog-action modals
// =============================================================================

export interface ChatDialogModalsProps {
  /** Dialog pending rename (`null` = closed). */
  renameTarget: DialogItem | null
  setRenameTarget: (dialog: DialogItem | null) => void
  onConfirmRename: (name: string) => void
  /** Dialog pending archive (`null` = closed). */
  archiveTarget: DialogItem | null
  setArchiveTarget: (dialog: DialogItem | null) => void
  onConfirmArchive: () => void
  /** Dialog pending restore/unarchive (`null` = closed). */
  restoreTarget: DialogItem | null
  setRestoreTarget: (dialog: DialogItem | null) => void
  onConfirmRestore: () => void
}

/**
 * Renders the Rename / Archive / Unarchive modals together, each driven by its
 * target dialog. Pair with `useChatDialogManager`, which produces exactly this
 * prop shape.
 */
export function ChatDialogModals({
  renameTarget,
  setRenameTarget,
  onConfirmRename,
  archiveTarget,
  setArchiveTarget,
  onConfirmArchive,
  restoreTarget,
  setRestoreTarget,
  onConfirmRestore,
}: ChatDialogModalsProps) {
  return (
    <>
      <RenameChatModal
        isOpen={renameTarget != null}
        initialName={renameTarget?.title ?? ''}
        onClose={() => setRenameTarget(null)}
        onSave={onConfirmRename}
      />
      <ArchiveChatModal
        isOpen={archiveTarget != null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={onConfirmArchive}
      />
      <UnarchiveChatModal
        isOpen={restoreTarget != null}
        onClose={() => setRestoreTarget(null)}
        onConfirm={onConfirmRestore}
      />
    </>
  )
}
