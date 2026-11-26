'use client';

/**
 * The files of a sent OpenFrame (Mingo, Fae) message, under its bubble (Figma `chat/user-message`, "show
 * attachments"): file tiles first (200×48, no ×, no token count), then a grid of 112px image thumbnails. An image opens
 * in the lightbox; any other file goes to the host (`onOpenAttachment`), which signs it and opens it. The lib never
 * builds a file's address: thumbnails are the host's, drawn by the boxed `Image` so the host's auth reaches them.
 */

import { useMemo, useState } from 'react';
import {
  type OpenFrameMessageAttachment,
  OPENFRAME_MINGO_ATTACHMENT_PROFILE,
  isOpenFrameImageType,
  openFrameFileExtension,
} from '../../chat-protocol/attachment-profiles';
import Image from '../../embed-shims/next-image';
import { cn } from '../../utils/cn';
import { formatFileSize } from '../../utils/format';
import { Button } from '../ui/button';
import { ImageGalleryModal } from '../ui/image-gallery-modal';
import { OpenFrameAttachmentTile } from './openframe-attachment-tile';

export interface OpenFrameMessageAttachmentsProps {
  attachments: readonly OpenFrameMessageAttachment[];
  /** The side of the message: `end` for the viewer's own (right-aligned), `start` for anyone else's. */
  align?: 'start' | 'end';
  /** A file was clicked (not an image with a picture, which opens in the lightbox). */
  onOpenAttachment?: (attachment: OpenFrameMessageAttachment) => void;
  className?: string;
}

/** An image the thread can draw: an image type with a picture to draw. */
function pictureOf(attachment: OpenFrameMessageAttachment): string | undefined {
  return isOpenFrameImageType(attachment.mediaType) ? (attachment.thumbnailUrl ?? attachment.previewUrl) : undefined;
}

/** A sent tile's second line: its size, or its type when the size is unknown ("PDF"). */
function sentCaption(attachment: OpenFrameMessageAttachment): string {
  if (attachment.size !== undefined) return formatFileSize(attachment.size);
  return openFrameFileExtension(attachment.name).toUpperCase() || 'File';
}

export function OpenFrameMessageAttachments({
  attachments,
  align = 'end',
  onOpenAttachment,
  className,
}: OpenFrameMessageAttachmentsProps) {
  const [openImage, setOpenImage] = useState<number | null>(null);
  const { files, images } = useMemo(
    () => ({
      files: attachments.filter(attachment => !pictureOf(attachment)),
      images: attachments.filter(attachment => !!pictureOf(attachment)),
    }),
    [attachments],
  );
  const lightboxImages = useMemo(() => images.map(image => image.previewUrl ?? image.thumbnailUrl ?? ''), [images]);

  if (attachments.length === 0) return null;
  const rowClass = cn(
    'flex flex-wrap gap-[var(--spacing-system-xsf)]',
    align === 'end' ? 'justify-end' : 'justify-start',
  );

  return (
    <div data-testid="openframe-message-attachments" className={cn('grid gap-[var(--spacing-system-xsf)]', className)}>
      {files.length > 0 && (
        <ul aria-label="Attached files" className={cn('m-0 list-none p-0', rowClass)}>
          {files.map(file => (
            <li key={file.id}>
              <OpenFrameAttachmentTile
                item={{ id: file.id, name: file.name, size: file.size ?? 0, mediaType: file.mediaType, state: 'ready' }}
                // The profile only feeds the caption here, and the sent tile's caption is its own.
                profile={OPENFRAME_MINGO_ATTACHMENT_PROFILE}
                caption={sentCaption(file)}
                hideTokenEstimate
                onOpen={onOpenAttachment ? () => onOpenAttachment(file) : undefined}
              />
            </li>
          ))}
        </ul>
      )}
      {images.length > 0 && (
        <ul aria-label="Attached images" className={cn('m-0 list-none p-0', rowClass)}>
          {images.map((image, index) => (
            <li key={image.id}>
              {/* The thumbnail is the card: the button adds the click, the keyboard and the focus ring, no box. */}
              <Button
                variant="card"
                type="button"
                aria-label={`Open ${image.name}`}
                onClick={() => setOpenImage(index)}
                className="h-28 w-28 overflow-hidden rounded-[6px] border border-ods-border transition-colors hover:border-ods-border-hover"
              >
                <Image
                  src={pictureOf(image) ?? ''}
                  alt={image.name}
                  width={112}
                  height={112}
                  unoptimized
                  className="h-full w-full object-cover"
                />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ImageGalleryModal
        images={lightboxImages}
        isOpen={openImage !== null}
        initialIndex={openImage ?? 0}
        onClose={() => setOpenImage(null)}
      />
    </div>
  );
}
