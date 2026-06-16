"use client";

import React, { useState } from 'react';
import { Video } from '../features/video';
import { ImageGalleryModal } from '../ui/image-gallery-modal';

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

export interface MediaGalleryStripProps {
  items: MediaGalleryStripItem[];
  /** Optional cap on tiles shown (e.g. product-release shows 5). Default: all. */
  maxDisplay?: number;
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
export function MediaGalleryStrip({ items, maxDisplay, className }: MediaGalleryStripProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  if (!items || items.length === 0) return null;

  // Explicit numeric check (clamped): `maxDisplay={0}` means "show none", which a
  // truthy check would wrongly treat as "no cap → show all".
  const display = typeof maxDisplay === 'number' ? items.slice(0, Math.max(0, maxDisplay)) : items;
  const galleryImages = display.filter((m) => isGalleryImage(m.media_type)).map((m) => m.media_url);

  const tileClass =
    'shrink-0 w-[240px] h-[200px] rounded-md overflow-hidden border border-ods-border bg-black transition-opacity';

  return (
    <>
      <div className={`flex gap-6 overflow-x-auto w-full ${className ?? ''}`}>
        {display.map((mediaItem, index) => {
          // Image tiles open the lightbox, so they're real <button>s — keyboard
          // focusable + Enter/Space activatable. Clips render in <Video>, which
          // owns its own controls, so their tile stays a plain container.
          if (isGalleryImage(mediaItem.media_type)) {
            return (
              <button
                key={mediaItem.id || index}
                type="button"
                className={`${tileClass} cursor-pointer hover:opacity-80`}
                aria-label={`Open ${mediaItem.title || `media ${index + 1}`} in gallery`}
                onClick={() => {
                  // Lightbox position = rank among image-only items (clips skipped).
                  setGalleryIndex(display.slice(0, index).filter((m) => isGalleryImage(m.media_type)).length);
                  setGalleryOpen(true);
                }}
              >
                <img src={mediaItem.media_url} alt={mediaItem.title || `Media ${index + 1}`} className="w-full h-full object-cover" />
              </button>
            );
          }
          return (
            <div key={mediaItem.id || index} className={tileClass}>
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
