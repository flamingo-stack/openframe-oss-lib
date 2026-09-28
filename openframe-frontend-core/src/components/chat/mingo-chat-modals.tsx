'use client';

import { useState } from 'react';
import { ModalV2, ModalV2Header, ModalV2Title, ModalV2Footer } from '../ui/modal-v2';
import { Button } from '../ui/button/button';
import type { DialogItem } from './types/component.types';

// =============================================================================
// Rename
// =============================================================================

export interface RenameChatModalProps {
  isOpen: boolean;
  /** Current chat name, used to seed the input each time the modal opens. */
  initialName?: string;
  onClose: () => void;
  /** Fired with the trimmed new name when Save is pressed. */
  onSave: (name: string) => void;
}

/** Rename Chat modal — Figma node `7592:225962`. */
export function RenameChatModal({ isOpen, initialName = '', onClose, onSave }: RenameChatModalProps) {
  const [name, setName] = useState(initialName);
  // Reseed whenever the modal (re)opens — possibly for a different chat.
  // Adjusted while rendering, not from an effect: the modal stays mounted when
  // it closes, so an effect painted the opening frame with the PREVIOUS chat's
  // name still in the field before replacing it.
  const [seededWith, setSeededWith] = useState({ isOpen, initialName });
  if (seededWith.isOpen !== isOpen || seededWith.initialName !== initialName) {
    setSeededWith({ isOpen, initialName });
    if (isOpen) setName(initialName);
  }

  const canSave = name.trim().length > 0;
  const save = () => {
    if (canSave) onSave(name.trim());
  };

  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className="md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Rename Chat</ModalV2Title>
      </ModalV2Header>
      <div className="flex w-full flex-col gap-[var(--spacing-system-xxs)]">
        <label htmlFor="rename-chat-input" className="text-ods-text-primary text-h4">
          Chat Name
        </label>
        <input
          id="rename-chat-input"
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
          }}
          className="w-full rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-sf)] text-ods-text-primary text-h4 focus:outline-none focus-visible:border-ods-accent"
        />
      </div>
      <ModalV2Footer>
        <Button type="button" variant="secondary" className="flex-1 min-w-0" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="primary" className="flex-1 min-w-0" onClick={save} disabled={!canSave}>
          Save
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}

// =============================================================================
// Archive
// =============================================================================

export interface ArchiveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired when the destructive "Archive Chat" button is pressed. */
  onConfirm: () => void;
}

/** Archive Chat confirmation modal — Figma node `7592:226181`. */
export function ArchiveChatModal({ isOpen, onClose, onConfirm }: ArchiveChatModalProps) {
  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className="md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Archive Chat</ModalV2Title>
      </ModalV2Header>
      <p className="w-full text-ods-text-primary text-h4">This chat will be hidden from your current chats.</p>
      <ModalV2Footer>
        <Button type="button" variant="secondary" className="flex-1 min-w-0" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="danger" className="flex-1 min-w-0" onClick={onConfirm}>
          Archive Chat
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}

// =============================================================================
// Unarchive
// =============================================================================

export interface UnarchiveChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired when the "Unarchive Chat" button is pressed. */
  onConfirm: () => void;
}

/** Unarchive (restore) Chat confirmation modal — restores an archived chat
 *  back to the current chats so the user can continue it. */
export function UnarchiveChatModal({ isOpen, onClose, onConfirm }: UnarchiveChatModalProps) {
  return (
    <ModalV2 isOpen={isOpen} onClose={onClose} className="md:max-w-[600px]">
      <ModalV2Header>
        <ModalV2Title>Unarchive Chat</ModalV2Title>
      </ModalV2Header>
      <p className="w-full text-ods-text-primary text-h4">This chat will be moved back to your current chats.</p>
      <ModalV2Footer>
        <Button type="button" variant="secondary" className="flex-1 min-w-0" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" variant="primary" className="flex-1 min-w-0" onClick={onConfirm}>
          Unarchive Chat
        </Button>
      </ModalV2Footer>
    </ModalV2>
  );
}

// =============================================================================
// Composite — all three dialog-action modals
// =============================================================================

export interface ChatDialogModalsProps {
  /** Dialog pending rename (`null` = closed). */
  renameTarget: DialogItem | null;
  setRenameTarget: (dialog: DialogItem | null) => void;
  onConfirmRename: (name: string) => void;
  /** Dialog pending archive (`null` = closed). */
  archiveTarget: DialogItem | null;
  setArchiveTarget: (dialog: DialogItem | null) => void;
  onConfirmArchive: () => void;
  /** Dialog pending restore/unarchive (`null` = closed). */
  restoreTarget: DialogItem | null;
  setRestoreTarget: (dialog: DialogItem | null) => void;
  onConfirmRestore: () => void;
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
  );
}
