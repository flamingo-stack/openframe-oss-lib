"use client";

import { useState, useRef, useEffect, memo, useCallback, type KeyboardEvent, type TouchEvent } from 'react';
import { cn } from "../utils/cn";
import { MediaItem } from '../utils/media-carousel-utils-stub';
import { Image, Link } from '../embed-shims';
import { Button } from './ui/button';
import { Video } from './features/video';
import { ImageOffIcon } from './icons-v2-generated/audio-and-visual/image-off-icon';

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
 * - Dots: 24px hit target, 8px dot, active = platform accent (per design).
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
  /** Always reserve the dot-row height (24px) even when there is nothing to
   *  paginate — for surfaces that swap media sets in place (the OpenFrame
   *  categories showcase), so 1-slide vs N-slide sets never shift layout.
   *  Default false: standalone carousels (vendor page) collapse the row. */
  reserveDotRow?: boolean;
}

export const MediaCarousel = memo(function MediaCarousel({
  media,
  className,
  aspectRatio = "16/9",
  showArrows = true,
  objectFit = 'contain',
  posterPriority = false,
  transformImageSrc,
  reserveDotRow = false,
}: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  /** Resource URLs that failed to load (e.g. 404, blocked CDN) */
  const [brokenResourceUrls, setBrokenResourceUrls] = useState<Record<string, true>>({});
  /** The src whose <Image> finished loading — keyed by URL (not a shared
   *  boolean) so a late onLoad from a previous slide can never reveal the
   *  current image prematurely; slide changes need no reset effect. */
  const [loadedImageSrc, setLoadedImageSrc] = useState<string | null>(null);
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
    // Explicit null checks — a swipe starting/ending at the viewport edge has
    // clientX === 0, which a truthiness check would wrongly discard.
    if (touchStart === null || touchEnd === null) return;

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

  // Render any playable slide via the SSoT `<Video>` — its default `auto`
  // routing owns the youtube-vs-file decision (lite-youtube facade vs
  // MuxPlayer), so the carousel keeps NO url-detection fork of its own.
  const renderVideo = (item: MediaItem, index: number) => (
    <Video
      key={`video-${index}-${item.src}`}
      url={item.src}
      poster={item.poster ? displayImageSrc(item.poster) : undefined}
      title={item.alt || `Video ${index + 1}`}
      muted
      layout="fill"
      priority={Boolean(posterPriority && index === 0)}
      className="w-full h-full bg-black"
    />
  );

  const renderImageUnavailable = (failedUrl: string) => (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ods-card px-6 text-center">
      <ImageOffIcon className="size-8 text-ods-text-secondary" />
      <p className="text-ods-text-secondary text-h6 max-w-md">
        This image is no longer available at the original URL.
      </p>
      <Link
        href={failedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ods-accent text-h6 underline break-all"
      >
        Open link
      </Link>
    </div>
  );

  // Render image — skeleton until onLoad; keep Image opacity-0 until then to
  // avoid the browser broken-image icon flash.
  const renderImage = (item: MediaItem, index: number) => {
    const rawSrc = typeof item.src === 'string' ? item.src.trim() : '';
    if (!rawSrc) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ods-card px-6 text-center">
          <p className="text-ods-text-secondary text-h6 max-w-md">No image URL for this slide.</p>
        </div>
      );
    }
    if (brokenResourceUrls[rawSrc]) {
      return renderImageUnavailable(rawSrc);
    }
    const mainImagePriority = Boolean(posterPriority && index === 0);
    const imageLoaded = loadedImageSrc === rawSrc;
    return (
      <div className="absolute inset-0 bg-ods-bg">
        {!imageLoaded && (
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
            !imageLoaded && 'opacity-0',
            imageLoaded && 'opacity-100 transition-opacity duration-200'
          )}
          priority={mainImagePriority}
          loading={mainImagePriority ? 'eager' : 'lazy'}
          sizes="(max-width: 1279px) 100vw, 1428px"
          width={1428}
          height={802}
          unoptimized
          onLoad={() => setLoadedImageSrc(rawSrc)}
          onError={() => onImageError(rawSrc)}
        />
      </div>
    );
  };

  // Render main media item — video AND youtube both route through the SSoT
  // `<Video>` (its `auto` kind owns the detection).
  const renderMainMedia = (item: MediaItem, index: number) => {
    switch (item.type) {
      case 'youtube':
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
    <div className={cn("flex flex-col items-center gap-[var(--spacing-system-l)]", className)}>
      {/* Main Display Area with Fixed Aspect Ratio — Figma media frame:
          rounded-md, ods border, semantic elevation token. */}
      <div
        ref={carouselRef}
        className={cn(
          "relative bg-ods-bg border border-ods-border rounded-md overflow-hidden group w-full",
          "[box-shadow:var(--shadow-media-frame)]",
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

        {/* Navigation Arrows — hover-revealed, only with multiple items.
            The common <Button> (transparent) with overlay positioning. */}
        {showArrows && media.length > 1 && (
          <>
            <Button
              variant="transparent"
              onClick={prevSlide}
              className="absolute left-3 top-1/2 h-auto md:h-auto -translate-y-1/2 rounded-full bg-black/50 p-2 text-ods-text-on-dark opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/70 z-10"
              aria-label="Previous media"
            >
              <ChevronLeftIcon />
            </Button>

            <Button
              variant="transparent"
              onClick={nextSlide}
              className="absolute right-3 top-1/2 h-auto md:h-auto -translate-y-1/2 rounded-full bg-black/50 p-2 text-ods-text-on-dark opacity-0 transition-opacity duration-200 group-hover:opacity-100 hover:bg-black/70 z-10"
              aria-label="Next media"
            >
              <ChevronRightIcon />
            </Button>
          </>
        )}
      </div>

      {/* Dot pagination (Figma) — 24px hit target, 8px dot, active accent.
          Plain grouped buttons (NOT tablist: no roving tabIndex/arrow-key
          model here — aria-current marks the active slide instead). */}
      {(media.length > 1 || reserveDotRow) && (
        <div className="flex h-6 items-center gap-[var(--spacing-system-xs)]" role="group" aria-label="Choose slide">
          {media.length > 1 && media.map((item, index) => {
            const isActive = index === currentIndex;
            return (
              <Button
                key={index}
                variant="transparent"
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => selectSlide(index)}
                className="flex h-6 w-6 md:h-6 shrink-0 items-center justify-center rounded-full p-0"
              >
                <span
                  className={cn(
                    "size-2 rounded-full transition-colors duration-150",
                    isActive
                      ? "bg-ods-accent"
                      : "bg-ods-bg-surface hover:bg-ods-bg-surface-hover"
                  )}
                />
              </Button>
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
