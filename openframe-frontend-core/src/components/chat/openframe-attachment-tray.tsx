'use client';

/**
 * OpenFrame (Mingo, Fae) composer attachments: the file tile (Figma `chat-uploaded-file`, 48px high, 200-220 wide),
 * the tray of tiles with its notes, the one-click attach button and the drop overlay. Presentational: the host (or
 * the uploader) owns the items and their states. Guide mode's chips (`chat-attachment-bar.tsx`) are separate and
 * untouched.
 */

import type { ReactNode } from 'react';
import {
  type OpenFrameAttachmentItem,
  type OpenFrameAttachmentProfile,
  type OpenFrameAttachmentTrayPlacement,
  openFrameMaxFileMegabytes,
} from '../../chat-protocol/attachment-profiles';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import { FileBannedIcon, FileContentIcon } from '../icons-v2-generated/documents';
import { DotsLoaderIcon } from '../icons-v2-generated/loaders';
import { PlusIcon } from '../icons-v2-generated/signs-and-symbols/plus-icon';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { Button } from '../ui/button';
import {
  type OpenFrameTraySummary,
  attachmentAccessibleName,
  attachmentCaption,
  isImageAttachment,
  middleTruncateFileName,
} from './utils/openframe-attachment-view';

// ===========================================================================
// Tile
// ===========================================================================

export interface OpenFrameAttachmentTileProps {
  item: OpenFrameAttachmentItem;
  profile: OpenFrameAttachmentProfile;
  /** Remove a ready file, cancel an upload, dismiss an error. No × without it (a sent message's tile). */
  onRemove?: (id: string) => void;
  /** Open the file (a sent message's tile). The tile is then a button. */
  onOpen?: () => void;
  /** Hide the token estimate whatever the profile says (a sent message's tile). */
  hideTokenEstimate?: boolean;
  /** The second line in place of the state's (a sent message's tile: its size, or its type when that is unknown). */
  caption?: string;
  className?: string;
}

/** The leading 32px square: a loader on its way up, the picture of a ready image, a type icon, or the banned icon. */
function TileLeading({ item }: { item: OpenFrameAttachmentItem }) {
  if (item.state === 'error') return <FileBannedIcon size={24} className="text-ods-error" />;
  if (item.state === 'uploading' || item.state === 'scanning') {
    return <DotsLoaderIcon size={24} className="text-ods-text-secondary" />;
  }
  if (item.thumbnailUrl && isImageAttachment(item)) {
    return (
      <Image
        src={item.thumbnailUrl}
        alt=""
        data-testid="openframe-attachment-thumbnail"
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 rounded-[6px] border border-ods-border object-cover"
      />
    );
  }
  return <FileContentIcon size={24} className="text-ods-text-secondary" />;
}

/**
 * One file. A ready file shows its × on hover (and on keyboard focus); an upload in flight and a refused file show it
 * always, so an upload can be cancelled and an error dismissed. Read by a screen reader as "name, image|file, size,
 * state".
 */
export function OpenFrameAttachmentTile({
  item,
  profile,
  onRemove,
  onOpen,
  hideTokenEstimate = false,
  caption,
  className,
}: OpenFrameAttachmentTileProps) {
  const isError = item.state === 'error';
  const captionProfile = hideTokenEstimate ? { ...profile, showTokenEstimate: false } : profile;
  const body = (
    <>
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center">
        <TileLeading item={item} />
      </span>
      <span aria-hidden className="flex min-w-0 flex-1 flex-col text-left">
        <span className="truncate text-ods-text-primary text-h6">{middleTruncateFileName(item.name)}</span>
        <span className={cn('truncate text-h6', isError ? 'text-ods-error' : 'text-ods-text-secondary')}>
          {caption ?? attachmentCaption(item, captionProfile)}
        </span>
      </span>
    </>
  );
  const frame = cn(
    'flex h-12 min-w-[200px] max-w-[220px] shrink-0 items-center gap-[var(--spacing-system-xsf)] rounded-[6px] border',
    'py-[var(--spacing-system-xxs)] pl-[var(--spacing-system-xsf)]',
    isError ? 'border-ods-error bg-ods-error-secondary' : 'border-ods-border bg-ods-card',
  );
  const label =
    caption === undefined
      ? attachmentAccessibleName(item, captionProfile)
      : `${item.name}, ${isImageAttachment(item) ? 'image' : 'file'}, ${caption}`;
  const alwaysShowRemove = item.state !== 'ready';

  return (
    <div
      role="group"
      aria-label={label}
      title={item.name}
      data-state={item.state}
      data-error={item.error}
      className={cn('group/tile relative', className)}
    >
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${item.name}`}
          data-testid="openframe-attachment-frame"
          className={cn(frame, 'pr-[var(--spacing-system-xsf)] transition-colors hover:border-ods-border-hover')}
        >
          {body}
        </button>
      ) : (
        <div data-testid="openframe-attachment-frame" className={cn(frame, 'pr-[var(--spacing-system-lf)]')}>
          {body}
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${item.name}`}
          onClick={() => onRemove(item.id)}
          className={cn(
            'absolute right-[3px] top-[3px] flex h-4 w-4 items-center justify-center text-ods-text-secondary',
            'transition-opacity hover:text-ods-text-primary focus-visible:opacity-100 focus-visible:outline-none',
            alwaysShowRemove ? 'opacity-100' : 'opacity-0 group-hover/tile:opacity-100',
          )}
        >
          <XmarkIcon size={16} />
        </button>
      )}
    </div>
  );
}

// ===========================================================================
// Tray
// ===========================================================================

export interface OpenFrameAttachmentTrayProps {
  items: readonly OpenFrameAttachmentItem[];
  profile: OpenFrameAttachmentProfile;
  onRemove: (id: string) => void;
  /** Defaults to the profile's. */
  placement?: OpenFrameAttachmentTrayPlacement;
  className?: string;
}

/**
 * The staged files. `below` (Mingo): under the input row, tiles wrap, indented to the text after the `+`. `above`
 * (Fae): over the input row in one row that scrolls sideways, fading out at the right edge. Nothing when empty.
 */
export function OpenFrameAttachmentTray({
  items,
  profile,
  onRemove,
  placement,
  className,
}: OpenFrameAttachmentTrayProps) {
  if (items.length === 0) return null;
  const where = placement ?? profile.trayPlacement;
  const list = (
    <ul
      aria-label="Attached files"
      data-placement={where}
      className={cn(
        'm-0 flex list-none gap-[var(--spacing-system-xsf)] p-0',
        where === 'below'
          ? 'flex-wrap pb-[var(--spacing-system-sf)] pl-[var(--spacing-system-xlf)] pr-[var(--spacing-system-sf)]'
          : 'overflow-x-auto p-[var(--spacing-system-xsf)] pr-[var(--spacing-system-xlf)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {items.map(item => (
        <li key={item.id} className="shrink-0">
          <OpenFrameAttachmentTile item={item} profile={profile} onRemove={onRemove} />
        </li>
      ))}
    </ul>
  );
  if (where === 'below') return <div className={className}>{list}</div>;
  return (
    <div className={cn('relative border-b border-ods-border', className)}>
      {list}
      {/* Figma `scroll-gradient`: the row runs on under the fade. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-ods-card to-transparent"
      />
    </div>
  );
}

// ===========================================================================
// Notes under the tray
// ===========================================================================

export interface OpenFrameAttachmentNotesProps {
  summary: OpenFrameTraySummary;
  className?: string;
}

/**
 * One note per refused file ("Larger than 20 MB"), "Send is available when 2 files finish uploading and scanning."
 * while any is on its way, and "1 file won't be sent" while refused files remain. Nothing when there is nothing to say.
 */
export function OpenFrameAttachmentNotes({ summary, className }: OpenFrameAttachmentNotesProps) {
  const { errorNotes, pendingNote, leftOutNote } = summary;
  if (errorNotes.length === 0 && !pendingNote && !leftOutNote) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="openframe-attachment-notes"
      className={cn('flex flex-col gap-[var(--spacing-system-xxs)] text-h6', className)}
    >
      {errorNotes.map(note => (
        <p key={note.id} className="m-0 min-w-0 break-words text-ods-error">
          <span className="text-ods-text-primary">{note.name}</span> {note.text}
        </p>
      ))}
      {pendingNote && <p className="m-0 text-ods-text-secondary">{pendingNote}</p>}
      {leftOutNote && <p className="m-0 text-ods-text-secondary">{leftOutNote}</p>}
    </div>
  );
}

// ===========================================================================
// Counter, attach button, drop overlay
// ===========================================================================

/** "2/10 · 5/20 in chat", in the input row before Send. */
export function OpenFrameAttachmentCounter({ summary }: { summary: OpenFrameTraySummary }) {
  return (
    <span
      data-testid="openframe-attachment-counter"
      className="shrink-0 whitespace-nowrap text-ods-text-secondary text-h6"
    >
      {summary.counter}
    </span>
  );
}

export interface OpenFrameAttachButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

/** Fae's one-click `+` in the input: opens the file picker, no menu. */
export function OpenFrameAttachButton({ onClick, disabled = false }: OpenFrameAttachButtonProps) {
  return (
    <Button
      variant="bare"
      data-tone="accent"
      size="icon-sm"
      type="button"
      aria-label="Attach a file"
      title="Attach a file"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0"
    >
      <PlusIcon />
    </Button>
  );
}

export interface OpenFrameDropOverlayProps {
  profile: OpenFrameAttachmentProfile;
  /** Shown while files are dragged over the zone. */
  visible: boolean;
  /** Overrides the default copy. */
  children?: ReactNode;
}

/** Covers its `relative` zone while files are dragged over it. Not designed yet: a dashed accent frame and one line. */
export function OpenFrameDropOverlay({ profile, visible, children }: OpenFrameDropOverlayProps) {
  if (!visible) return null;
  return (
    <div
      aria-hidden
      data-testid="openframe-drop-overlay"
      className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-[var(--spacing-system-xxs)] rounded-md border border-dashed border-ods-accent bg-ods-bg p-[var(--spacing-system-sf)] text-center"
    >
      {children ?? (
        <>
          <span className="text-ods-text-primary text-h4">Drop files to attach</span>
          <span className="text-ods-text-secondary text-h6">
            Up to {profile.maxFilesPerMessage} files, {openFrameMaxFileMegabytes(profile)} MB each
          </span>
        </>
      )}
    </div>
  );
}
