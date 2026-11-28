'use client';

/**
 * One OpenFrame (Mingo, Fae) attached file (Figma `chat-uploaded-file`, 48px high, 200-220 wide): in the composer's tray
 * with its ×, or under a sent message as a button that opens it. Presentational: the host (or the uploader) owns the
 * item and its state.
 */

import type { OpenFrameAttachmentItem, OpenFrameAttachmentProfile } from '../../chat-protocol/attachment-profiles';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import { FileBannedIcon, FileContentIcon, FileImageIcon } from '../icons-v2-generated/documents';
import { DotsLoaderIcon } from '../icons-v2-generated/loaders';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { Button } from '../ui/button';
import {
  attachmentAccessibleName,
  attachmentCaption,
  isImageAttachment,
  splitFileNameForTile,
} from './utils/openframe-attachment-view';

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

/**
 * The leading 32px square: a loader on its way up, the picture of a ready image, a type icon (the image icon for an
 * image with no picture), or the banned icon.
 */
function TileLeading({ item }: { item: OpenFrameAttachmentItem }) {
  if (item.state === 'error') return <FileBannedIcon size={24} className="text-ods-error" />;
  if (item.state === 'uploading' || item.state === 'scanning') {
    return <DotsLoaderIcon size={24} className="text-ods-text-secondary" />;
  }
  const image = isImageAttachment(item);
  if (item.thumbnailUrl && image) {
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
  if (image) return <FileImageIcon size={24} className="text-ods-text-secondary" />;
  return <FileContentIcon size={24} className="text-ods-text-secondary" />;
}

/**
 * The file name, cut in the middle only when the tile is too narrow for it: the head shrinks with an ellipsis, the tail
 * (the last characters and the extension) always shows, so "outlook-error-screenshot-0921-2026.png" reads
 * "outlook-erro…2026.png" at any tile width.
 */
function TileFileName({ name }: { name: string }) {
  const { head, tail } = splitFileNameForTile(name);
  return (
    <span className="flex min-w-0 text-ods-text-primary text-h6">
      <span data-testid="openframe-attachment-name-head" className="truncate">
        {head}
      </span>
      {tail && (
        <span data-testid="openframe-attachment-name-tail" className="shrink-0 whitespace-pre">
          {tail}
        </span>
      )}
    </span>
  );
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
        <TileFileName name={item.name} />
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
        // The tile is the card: the button adds the click, the keyboard and the focus ring, no box of its own.
        <Button
          variant="card"
          type="button"
          onClick={onOpen}
          aria-label={`Open ${item.name}`}
          data-testid="openframe-attachment-frame"
          className={cn(frame, 'pr-[var(--spacing-system-xsf)] transition-colors hover:border-ods-border-hover')}
        >
          {body}
        </Button>
      ) : (
        <div data-testid="openframe-attachment-frame" className={cn(frame, 'pr-[var(--spacing-system-lf)]')}>
          {body}
        </div>
      )}
      {onRemove && (
        // Figma: a 16px × at 3px from the tile's top and right edges.
        <Button
          variant="bare"
          size="wrap"
          type="button"
          aria-label={`Remove ${item.name}`}
          onClick={() => onRemove(item.id)}
          className={cn(
            'absolute right-[3px] top-[3px] h-4 w-4 [&_svg]:h-4 [&_svg]:w-4',
            'transition-opacity focus-visible:opacity-100',
            alwaysShowRemove ? 'opacity-100' : 'opacity-0 group-hover/tile:opacity-100',
          )}
        >
          <XmarkIcon size={16} />
        </Button>
      )}
    </div>
  );
}
