"use client";

import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { cn } from "../utils/cn";
import { MediaItem } from '../utils/media-carousel-utils-stub';
import { Video, extractYouTubeId } from './features/video';
import { VideoPlayBadge } from './features/video-center-badge';

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

interface MediaCarouselProps {
  media: MediaItem[];
  className?: string;
  /** Use aspect ratio instead of height classes for stable dimensions */
  aspectRatio?: '16/9' | '4/3' | '3/2' | '1/1';
  showThumbnails?: boolean;
  autoPlay?: boolean;
  /** How content should fit within the container */
  objectFit?: 'contain' | 'cover';
}

export const MediaCarousel = memo(function MediaCarousel({ 
  media, 
  className,
  aspectRatio = "16/9",
  showThumbnails = true,
  autoPlay = false,
  objectFit = 'contain'
}: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  // Clamp `currentIndex` whenever `media` shrinks (e.g. an admin removes
  // a slide while the user is on the last one) so the thumbnail active
  // state + `currentItem` lookup stay in sync. Without this, the
  // `media[currentIndex] || media[0]` fallback renders the first slide
  // but every thumbnail's `isActive = index === currentIndex` reads
  // false — visually nothing is selected.
  useEffect(() => {
    if (currentIndex >= media.length && media.length > 0) {
      setCurrentIndex(media.length - 1);
    }
  }, [media.length, currentIndex]);

  // Early return if no media provided
  if (!media || media.length === 0) {
    return null;
  }

  const currentItem = media[currentIndex] || media[0];

  // Additional safety check
  if (!currentItem) {
    return null;
  }

  // Navigation functions — `<Video>` (MuxPlayer/YT facade) owns its own
  // play/pause lifecycle, so the previous bare-`<video>`-element pause
  // logic in nextSlide/prevSlide/selectSlide is no longer needed.
  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  }, [media.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  }, [media.length]);

  const selectSlide = useCallback((index: number) => {
    if (index === currentIndex) return;
    setCurrentIndex(index);
  }, [currentIndex]);

  // Keyboard navigation - only when carousel is focused
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (media.length <= 1) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevSlide();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextSlide();
    }
  }, [nextSlide, prevSlide, media.length]);

  // Touch/swipe handling
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
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

  // Render YouTube embed via the SSoT `<Video>` — same lite-youtube
  // facade everywhere, no carousel-local fork.
  const renderYouTubeEmbed = (item: MediaItem, index: number) => (
    <Video
      kind="youtube"
      url={item.src}
      title={item.alt || `Video ${index + 1}`}
      layout="fill"
      priority={index === currentIndex}
    />
  );

  // Render video via the SSoT `<Video>` — MuxPlayer handles both HLS
  // and plain MP4, so the carousel no longer needs its own bare
  // `<video>` element + custom play overlay + 60 LOC of error handling.
  const renderVideo = (item: MediaItem, index: number) => (
    <Video
      url={item.src}
      poster={item.poster}
      muted
      layout="fill"
      priority={index === currentIndex}
    />
  );

  // Render image
  const renderImage = (item: MediaItem, index: number) => (
    <div className="absolute inset-0 bg-black">
      <img 
        src={item.src} 
        alt={item.alt || `Media ${index + 1}`} 
        className={`w-full h-full object-${objectFit}`}
        loading="lazy"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
    </div>
  );

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

  // Render thumbnail
  const renderThumbnail = (item: MediaItem, index: number) => {
    const isActive = index === currentIndex;
    
    let thumbnailSrc = item.src;
    if (item.type === 'youtube') {
      // Use the SSoT `extractYouTubeId` (strict URL parsing, ReDoS-safe)
      // rather than a local regex so YouTube id extraction has a single
      // implementation across the lib.
      const videoId = extractYouTubeId(item.src);
      thumbnailSrc = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : item.src;
    } else if (item.type === 'video' && item.poster) {
      thumbnailSrc = item.poster;
    }

    return (
      <button
        key={index}
        onClick={() => selectSlide(index)}
        className={cn(
          "relative flex-shrink-0 overflow-hidden transition-all duration-200",
          "w-20 h-20 md:w-24 md:h-24 rounded-lg border-2",
          isActive 
            ? "border-[#FFC008] ring-2 ring-[#FFC008]/20" 
            : "border-ods-border hover:border-[#888888]"
        )}
      >
        <img
          src={thumbnailSrc}
          alt={item.alt || `Thumbnail ${index + 1}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Play icon overlay for videos */}
        {(item.type === 'video' || item.type === 'youtube') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <VideoPlayBadge size="sm" />
          </div>
        )}
        
        {/* Active indicator */}
        {isActive && (
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-[#FFC008] rounded-full" />
        )}
      </button>
    );
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
    <div className={cn("space-y-4", className)}>
      {/* Main Display Area with Fixed Aspect Ratio */}
      <div 
        ref={carouselRef}
        className={cn(
          "relative bg-ods-bg border border-ods-border rounded-2xl overflow-hidden group w-full",
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

        {/* Navigation Arrows - only show if multiple items */}
        {media.length > 1 && (
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

            {/* Media Counter */}
            <div className="absolute top-3 right-3 bg-black/70 text-white px-3 py-1 rounded-lg text-sm font-medium">
              {currentIndex + 1} / {media.length}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail Navigation - only show if multiple items and showThumbnails is true */}
      {media.length > 1 && showThumbnails && (
        <div className="w-full">
          <div 
            ref={thumbnailsRef}
            className="flex gap-2 overflow-x-auto scrollbar-none py-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {media.map((item, index) => renderThumbnail(item, index))}
          </div>
        </div>
      )}
    </div>
  );
}); 