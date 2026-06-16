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

  const display = maxDisplay ? items.slice(0, maxDisplay) : items;
  const galleryImages = display.filter((m) => isGalleryImage(m.media_type)).map((m) => m.media_url);

  return (
    <>
      <div className={`flex gap-6 overflow-x-auto w-full ${className ?? ''}`}>
        {display.map((mediaItem, index) => (
          <div
            key={mediaItem.id || index}
            className="shrink-0 w-[240px] h-[200px] rounded-md overflow-hidden border border-ods-border bg-black cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => {
              if (isGalleryImage(mediaItem.media_type)) {
                // Lightbox position = rank among image-only items (clips skipped).
                setGalleryIndex(display.slice(0, index).filter((m) => isGalleryImage(m.media_type)).length);
                setGalleryOpen(true);
              }
            }}
          >
            {isGalleryImage(mediaItem.media_type) ? (
              <img src={mediaItem.media_url} alt={mediaItem.title || `Media ${index + 1}`} className="w-full h-full object-cover" />
            ) : (
              <Video url={mediaItem.media_url} layout="native" />
            )}
          </div>
        ))}
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
