"use client";

import { useState, useRef, useEffect, memo, useCallback, type KeyboardEvent, type TouchEvent } from 'react';
import { cn } from "../utils/cn";
import { MediaItem } from '../utils/media-carousel-utils-stub';
import { Image } from '../embed-shims';
import { Video, extractYouTubeId } from './features/video';

// Navigation icons
const ChevronLeftIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="15,18 9,12 15,6"/>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <polyline points="9,18 15,12 9,6"/>
  </svg>
);

/**
 * THE media carousel (Figma 4033:90570) — the single slide viewer for the
 * whole codebase: OpenFrame homepage categories, openmsp vendor screenshots,
 * who-am-i profiles, reddit embeds. One viewport + dot pagination; no
 * thumbnail rail, no slide counter (both removed with the 2026-07 redesign).
 *
 * - Slides render through the SSoT `<Video>` (MuxPlayer / lite-youtube
 *   facade) for `video`/`youtube` items and a broken-image-resilient
 *   `<Image>` shim for `image` items.
 * - Dots: 24px hit target, 8px dot, active = flamingo pink (per design).
 * - Hover-revealed prev/next arrows (`showArrows`), keyboard arrows, and
 *   touch swipe all preserved from the previous generation.
 */
export interface MediaCarouselProps {
  media: MediaItem[];
  className?: string;
  /** Use aspect ratio instead of height classes for stable dimensions */
  aspectRatio?: '16/9' | '4/3' | '3/2' | '1/1';
  /** Hover-revealed prev/next arrows (default true; dots always render). */
  showArrows?: boolean;
  /** How content should fit within the container */
  objectFit?: 'contain' | 'cover';
  /** When true, the first slide's image or YouTube poster uses `priority` / eager load (e.g. vendor detail LCP). */
  posterPriority?: boolean;
  /** Optional per-host rewrite for image URLs (e.g. the hub proxies plain
   *  `http://` sources to avoid mixed content). Applied to image slide srcs
   *  and derived thumbnails only — video/youtube URLs go to `<Video>` raw. */
  transformImageSrc?: (url: string) => string;
}

export const MediaCarousel = memo(function MediaCarousel({
  media,
  className,
  aspectRatio = "16/9",
  showArrows = true,
  objectFit = 'contain',
  posterPriority = false,
  transformImageSrc,
}: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  /** Resource URLs that failed to load (e.g. 404, blocked CDN) */
  const [brokenResourceUrls, setBrokenResourceUrls] = useState<Record<string, true>>({});
  /** Main slide: hide <Image> until load succeeds so broken URLs never flash the browser broken icon */
  const [mainImageVisible, setMainImageVisible] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);

  const onImageError = useCallback((originalUrl: string) => {
    const key = originalUrl.trim() || '__missing_src__';
    setBrokenResourceUrls((b) => (b[key] ? b : { ...b, [key]: true }));
  }, []);

  // Clamp `currentIndex` whenever `media` shrinks (e.g. an admin removes a
  // slide while the user is on the last one) so the dot active state +
  // `currentItem` lookup stay in sync.
  useEffect(() => {
    if (currentIndex >= media.length && media.length > 0) {
      setCurrentIndex(media.length - 1);
    }
  }, [media.length, currentIndex]);

  const currentItem = media[currentIndex] || media[0];

  // When the active slide (or its type) changes, hide the main image until
  // onLoad again — avoids flashing the previous slide while the next loads.
  useEffect(() => {
    if (currentItem && (currentItem.type === 'image' || !currentItem.type)) {
      setMainImageVisible(false);
    }
  }, [currentItem?.src, currentItem?.type]);

  // Navigation — `<Video>` owns its own play/pause lifecycle.
  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  }, [media.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  }, [media.length]);

  const selectSlide = useCallback((index: number) => {
    setCurrentIndex((prev) => (index === prev ? prev : index));
  }, []);

  // Keyboard navigation - only when carousel is focused
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (media.length <= 1) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    }
  }, [nextSlide, prevSlide, media.length]);

  // Early return if no media provided
  if (!media || media.length === 0) {
    return null;
  }

  // Additional safety check
  if (!currentItem) {
    return null;
  }

  // Touch/swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && media.length > 1) {
      nextSlide();
    }
    if (isRightSwipe && media.length > 1) {
      prevSlide();
    }
  };

  const displayImageSrc = (url: string): string =>
    transformImageSrc ? transformImageSrc(url) : url;

  // Render YouTube embed via the SSoT `<Video>` — same lite-youtube facade
  // everywhere, no carousel-local fork.
  const renderYouTubeEmbed = (item: MediaItem, index: number) => {
    const videoId = extractYouTubeId(item.src);
    if (!videoId) {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-ods-card text-center p-4">
          <div>
            <p className="text-ods-text-primary text-sm mb-2">Invalid YouTube URL</p>
            <a href={item.src} target="_blank" rel="noopener noreferrer" className="text-ods-accent text-sm">
              Open Link Directly
            </a>
          </div>
        </div>
      );
    }

    return (
      <Video
        kind="youtube"
        url={videoId}
        title={item.alt || `Video ${index + 1}`}
        layout="fill"
        priority={Boolean(posterPriority && index === 0)}
      />
    );
  };

  // Render video via the SSoT `<Video>` — MuxPlayer handles both HLS and
  // plain MP4.
  const renderVideo = (item: MediaItem, index: number) => (
    <Video
      key={`video-${index}-${item.src}`}
      kind="file"
      url={item.src}
      poster={item.poster}
      muted
      layout="fill"
      className="w-full h-full bg-black"
    />
  );

  const renderImageUnavailable = (failedUrl: string) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ods-card px-6 text-center">
      <p className="text-ods-text-secondary text-sm max-w-md">
        This image is no longer available at the original URL.
      </p>
      <a
        href={failedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ods-accent text-sm underline break-all"
      >
        Open link
      </a>
    </div>
  );

  // Render image — skeleton until onLoad; keep Image opacity-0 until then to
  // avoid the browser broken-image icon flash.
  const renderImage = (item: MediaItem, index: number) => {
    const rawSrc = typeof item.src === 'string' ? item.src.trim() : '';
    if (!rawSrc) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ods-card px-6 text-center">
          <p className="text-ods-text-secondary text-sm max-w-md">No image URL for this slide.</p>
        </div>
      );
    }
    if (brokenResourceUrls[rawSrc]) {
      return renderImageUnavailable(rawSrc);
    }
    const mainImagePriority = Boolean(posterPriority && index === 0);
    return (
      <div className="absolute inset-0 bg-ods-bg">
        {!mainImageVisible && (
          <div
            className="absolute inset-0 z-[1] bg-ods-card/90 animate-pulse"
            aria-hidden
          />
        )}
        <Image
          src={displayImageSrc(rawSrc)}
          alt={item.alt || `Media ${index + 1}`}
          className={cn(
            `w-full h-full object-${objectFit} relative z-[2]`,
            !mainImageVisible && 'opacity-0',
            mainImageVisible && 'opacity-100 transition-opacity duration-200'
          )}
          priority={mainImagePriority}
          loading={mainImagePriority ? 'eager' : 'lazy'}
          sizes="(max-width: 1279px) 100vw, 1428px"
          width={1428}
          height={802}
          unoptimized
          onLoad={() => setMainImageVisible(true)}
          onError={() => {
            setMainImageVisible(false);
            onImageError(rawSrc);
          }}
        />
      </div>
    );
  };

  // Render main media item
  const renderMainMedia = (item: MediaItem, index: number) => {
    switch (item.type) {
      case 'youtube':
        return renderYouTubeEmbed(item, index);
      case 'video':
        return renderVideo(item, index);
      case 'image':
      default:
        return renderImage(item, index);
    }
  };

  // Get CSS for aspect ratio
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case '4/3':
        return 'aspect-[4/3]';
      case '3/2':
        return 'aspect-[3/2]';
      case '1/1':
        return 'aspect-square';
      case '16/9':
      default:
        return 'aspect-video';
    }
  };

  return (
    <div className={cn("flex flex-col items-center gap-[var(--spacing-system-l,24px)]", className)}>
      {/* Main Display Area with Fixed Aspect Ratio — Figma media frame:
          rounded-md, ods border, deep drop shadow. */}
      <div
        ref={carouselRef}
        className={cn(
          "relative bg-ods-bg border border-ods-border rounded-md overflow-hidden group w-full",
          "shadow-[0px_24px_48px_0px_rgba(0,0,0,0.24)]",
          getAspectRatioClass()
        )}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onKeyDown={media.length > 1 ? handleKeyDown : undefined}
        tabIndex={media.length > 1 ? 0 : undefined}
        role={media.length > 1 ? "region" : undefined}
        aria-label={media.length > 1 ? "Media carousel, use arrow keys to navigate" : undefined}
      >
        {/* Media content */}
        {renderMainMedia(currentItem, currentIndex)}

        {/* Navigation Arrows - hover-revealed, only with multiple items */}
        {showArrows && media.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70 z-10"
              aria-label="Previous media"
            >
              <ChevronLeftIcon />
            </button>

            <button
              onClick={nextSlide}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-black/50 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-black/70 z-10"
              aria-label="Next media"
            >
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {/* Dot pagination (Figma) — 24px hit target, 8px dot, active pink. */}
      {media.length > 1 && (
        <div className="flex items-center gap-[var(--spacing-system-xs,8px)]" role="tablist" aria-label="Slides">
          {media.map((item, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => selectSlide(index)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent"
              >
                <span
                  className={cn(
                    "size-2 rounded-full transition-colors duration-150",
                    isActive
                      ? "bg-[var(--ods-flamingo-pink-base)]"
                      : "bg-[var(--ods-system-greys-soft-grey)] hover:bg-[var(--ods-system-greys-soft-grey-hover)]"
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});

// The carousel's item shape is the lib-wide SSOT — re-exported here so hub
// code can `import type { MediaItem } from '.../components'`.
export type { MediaItem };
