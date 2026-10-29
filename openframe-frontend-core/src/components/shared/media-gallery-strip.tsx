'use client';

import { useState } from 'react';
import Image from '../../embed-shims/next-image';
import { IMAGE_FIXED_PX } from '../../styles/image-sizes';
import { cn } from '../../utils/cn';
import { Video } from '../features/video';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { ImageGalleryModal } from '../ui/image-gallery-modal';
import { LoadingItems, useLoadingScope } from '../ui/loading-scope';

export interface MediaGalleryStripItem {
  media_type: string;
  media_url: string;
  title?: string | null;
  /** Stable key when present (e.g. release_media rows); falls back to index. */
  id?: string;
}

/** Still-images open the lightbox; clips ('video'/'demo') play inline. */
function isGalleryImage(mediaType: string): boolean {
  return mediaType !== 'video' && mediaType !== 'demo';
}

/** The strip's layout, read by the strip and by its skeleton, so the skeleton is the strip's size. */
const STRIP_CLASS = 'flex w-full gap-6 overflow-x-auto';
/** A tile's place and size in the strip (an image tile is a `card` button of this size). */
const TILE_BOX_CLASS = 'shrink-0 w-[240px] h-[200px]';
const TILE_SIZE_CLASS = `${TILE_BOX_CLASS} rounded-md`;
/** A tile's frame: the video tile's box, and the image tile's content inside its button. */
const TILE_FRAME_CLASS = 'overflow-hidden rounded-md border border-ods-border bg-ods-bg';
const TILE_CLASS = cn(TILE_SIZE_CLASS, TILE_FRAME_CLASS);
/** Tiles a skeleton draws when not told how many (a strip's first fold on a wide screen). */
export const MEDIA_GALLERY_STRIP_SKELETON_COUNT = 4;

export interface MediaGalleryStripProps {
  items: MediaGalleryStripItem[];
  className?: string;
}

/**
 * Read-only media gallery — a horizontal-scroll strip of 240×200 tiles where
 * still-images open an {@link ImageGalleryModal} lightbox and video clips play
 * inline via {@link Video}. The lightbox index is the tile's rank among the
 * IMAGE-only items (clips are skipped), so the modal opens on the correct image.
 *
 * Single source of truth for the detail-page media strip — replaces the markup
 * that was hand-rolled inline in the product-release and "What I Shipped" detail
 * pages (the release copy also had a raw-index lightbox bug this component fixes).
 */
export function MediaGalleryStrip({ items, className }: MediaGalleryStripProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // ONE switch: in a loading scope with no items yet (they are read) the strip is its skeleton; items it is given
  // there are the page's own and are drawn as they are. A record's media is optional: a page whose loading layout
  // leaves the strip out wraps the loaded one in `data-loading-optional`.
  if (useLoadingScope() && !items?.length) return <MediaGalleryStripSkeleton className={className} />;

  if (!items || items.length === 0) return null;

  const galleryImages = items.filter(m => isGalleryImage(m.media_type)).map(m => m.media_url);

  const tileClass = TILE_CLASS;

  return (
    <>
      <div className={`${STRIP_CLASS} ${className ?? ''}`}>
        {items.map((mediaItem, index) => {
          // Image tiles open the lightbox, so they're real <button>s — keyboard
          // focusable + Enter/Space activatable. Clips render in <Video>, which
          // owns its own controls, so their tile stays a plain container.
          if (isGalleryImage(mediaItem.media_type)) {
            return (
              <Button
                variant="card"
                key={mediaItem.id || index}
                data-loading-item
                type="button"
                className={TILE_BOX_CLASS}
                aria-label={`Open ${mediaItem.title || `media ${index + 1}`} in gallery`}
                onClick={() => {
                  // Lightbox position = rank among image-only items (clips skipped).
                  setGalleryIndex(items.slice(0, index).filter(m => isGalleryImage(m.media_type)).length);
                  setGalleryOpen(true);
                }}
              >
                <span className={cn('block h-full w-full', TILE_FRAME_CLASS)}>
                  <Image
                    src={mediaItem.media_url}
                    alt={mediaItem.title || `Media ${index + 1}`}
                    className="h-full w-full object-cover"
                    // The tile's 240x200 box: the image-size table's `cover` width at the tile's ratio.
                    width={IMAGE_FIXED_PX.cover}
                    height={(IMAGE_FIXED_PX.cover * 5) / 6}
                    unoptimized
                  />
                </span>
              </Button>
            );
          }
          return (
            <div key={mediaItem.id || index} className={tileClass} data-loading-item>
              <Video url={mediaItem.media_url} layout="native" />
            </div>
          );
        })}
      </div>

      {galleryImages.length > 0 && (
        <ImageGalleryModal
          images={galleryImages}
          isOpen={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          initialIndex={galleryIndex}
        />
      )}
    </>
  );
}

/** The media strip while it is read: `count` tiles of the strip's own 240×200 size. */
function MediaGalleryStripSkeleton({
  count = MEDIA_GALLERY_STRIP_SKELETON_COUNT,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn(STRIP_CLASS, 'overflow-hidden', className)} aria-hidden>
      <LoadingItems count={count}>
        {() => <UnifiedSkeleton className={TILE_SIZE_CLASS} data-loading-item />}
      </LoadingItems>
    </div>
  );
}
