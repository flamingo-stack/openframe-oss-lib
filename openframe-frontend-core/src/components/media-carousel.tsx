"use client";

import { useState, useRef, useEffect, memo, useCallback } from 'react';
import { cn } from "../utils/cn";
import { MediaItem } from '../utils/media-carousel-utils-stub';
import { LiteYouTubeEmbed } from '../utils/lite-youtube-embed-stub';

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

const PlayIcon = () => (
  <svg width="24" height="24" fill="white" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

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

// Carousel-specific YouTube embed component
const CarouselYouTubeEmbed = ({ videoId, title }: { videoId: string; title: string }) => {
  const [mounted, setMounted] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="absolute inset-0 bg-black rounded-lg overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-white text-sm">Loading video...</div>
        </div>
      </div>
    );
  }

  const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  const handleActivate = () => {
    setIsActivated(true);
    setTimeout(() => setIsLoaded(true), 100);
  };

  return (
    <div className="absolute inset-0 bg-black">
      {!isActivated ? (
        <button
          onClick={handleActivate}
          className="absolute inset-0 cursor-pointer group"
          aria-label={`Play video: ${title}`}
        >
          <img
            src={thumbnailUrl}
            alt={title}
            className="w-full h-full object-cover transition-opacity group-hover:opacity-90"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="bg-red-600 rounded-full p-4 group-hover:scale-110 transition-transform">
              <PlayIcon />
            </div>
          </div>
        </button>
      ) : (
        <div className="absolute inset-0">
          {isLoaded && (
            <iframe
              src={embedUrl}
              title={title}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      )}
    </div>
  );
};

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
  const [playingVideos, setPlayingVideos] = useState<Set<number>>(new Set());
  const carouselRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  // Early return if no media provided
  if (!media || media.length === 0) {
    return null;
  }

  const currentItem = media[currentIndex] || media[0];

  // Additional safety check
  if (!currentItem) {
    return null;
  }

  // Handle video play/pause
  const handleVideoClick = useCallback((index: number) => {
    const item = media[index];
    if (item.type !== 'video') return;
    
    // Find the video element
    const videoElements = document.querySelectorAll(`video[data-video-index="${index}"]`);
    const video = videoElements[0] as HTMLVideoElement;
    
    if (!video) {
      console.log('❌ Video element not found for index:', index);
      return;
    }
    
    if (video.paused) {
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            const playButton = video.parentElement?.querySelector('.video-play-button');
            if (playButton) {
              (playButton as HTMLElement).style.display = 'none';
            }
          })
          .catch((error) => {
            if (error.name === 'NotSupportedError' || error.name === 'MediaElementError') {
              const fallbackDiv = document.createElement('div');
              fallbackDiv.className = 'absolute inset-0 flex items-center justify-center bg-ods-card text-center p-4';
              fallbackDiv.innerHTML = `
                <div>
                  <p class="text-ods-text-primary text-sm mb-2">Video format not supported</p>
                  <a href="${item.src}" target="_blank" rel="noopener noreferrer" 
                     class="text-ods-accent hover:text-[#FFD700] text-sm">
                    Open Video Directly
                  </a>
                </div>
              `;
              video.parentElement?.appendChild(fallbackDiv);
            }
          });
      }
    } else {
      video.pause();
      const playButton = video.parentElement?.querySelector('.video-play-button');
      if (playButton) {
        (playButton as HTMLElement).style.display = 'flex';
      }
    }
  }, [media]);

  // Navigation functions
  const nextSlide = useCallback(() => {
    const currentVideo = document.querySelector(`[data-video-index="${currentIndex}"]`) as HTMLVideoElement;
    if (currentVideo && !currentVideo.paused) {
      currentVideo.pause();
    }
    setPlayingVideos(new Set());
    setCurrentIndex((prev) => (prev + 1) % media.length);
  }, [currentIndex, media.length]);

  const prevSlide = useCallback(() => {
    const currentVideo = document.querySelector(`[data-video-index="${currentIndex}"]`) as HTMLVideoElement;
    if (currentVideo && !currentVideo.paused) {
      currentVideo.pause();
    }
    setPlayingVideos(new Set());
    setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
  }, [currentIndex, media.length]);

  const selectSlide = useCallback((index: number) => {
    if (index === currentIndex) return;
    
    const currentVideo = document.querySelector(`[data-video-index="${currentIndex}"]`) as HTMLVideoElement;
    if (currentVideo && !currentVideo.paused) {
      currentVideo.pause();
    }
    setPlayingVideos(new Set());
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

  // Render YouTube embed
  const renderYouTubeEmbed = (item: MediaItem, index: number) => {
    const videoId = getYouTubeVideoId(item.src);
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

    return <CarouselYouTubeEmbed videoId={videoId} title={item.alt || `Video ${index + 1}`} />;
  };

  // Render video
  const renderVideo = (item: MediaItem, index: number) => (
    <div className="absolute inset-0 bg-black">
      <video 
        className={`w-full h-full object-${objectFit}`}
        poster={item.poster}
        preload="metadata"
        playsInline
        controls={false}
        muted
        data-video-index={index}
        onClick={() => handleVideoClick(index)}
        onPlay={() => {
          const playButton = document.querySelector(`[data-video-index="${index}"]`)?.parentElement?.querySelector('.video-play-button');
          if (playButton) {
            (playButton as HTMLElement).style.display = 'none';
          }
        }}
        onPause={() => {
          const playButton = document.querySelector(`[data-video-index="${index}"]`)?.parentElement?.querySelector('.video-play-button');
          if (playButton) {
            (playButton as HTMLElement).style.display = 'flex';
          }
        }}
        onLoadedMetadata={(e) => {
          const video = e.target as HTMLVideoElement;
          video.currentTime = 1;
        }}
        onError={(e) => {
          const target = e.target as HTMLVideoElement;
          
          if (target.crossOrigin) {
            target.crossOrigin = '';
            target.load();
          } else {
            target.style.display = 'none';
            const fallbackDiv = document.createElement('div');
            fallbackDiv.className = 'absolute inset-0 flex items-center justify-center bg-ods-card text-center p-4';
            fallbackDiv.innerHTML = `
              <div>
                <p class="text-ods-text-primary text-sm mb-2">Video could not be loaded</p>
                <a href="${item.src}" target="_blank" rel="noopener noreferrer" 
                   class="text-ods-accent hover:text-[#FFD700] text-sm">
                  Open Video Directly
                </a>
              </div>
            `;
            target.parentElement?.appendChild(fallbackDiv);
          }
        }}
      >
        <source src={item.src} type="video/mp4" />
        <source src={item.src} type="video/webm" />
        <source src={item.src} type="video/ogg" />
        Your browser does not support the video tag.
      </video>
      
      {/* Play Button Overlay */}
      <div 
        className="video-play-button absolute inset-0 flex items-center justify-center bg-black bg-opacity-20 cursor-pointer transition-opacity hover:bg-opacity-30"
        onClick={() => handleVideoClick(index)}
      >
        <div className="w-16 h-16 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
          <PlayIcon />
        </div>
      </div>
    </div>
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
          console.log('❌ Image failed to load:', item.src);
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
    </div>
  );

  // Render main media item
  const renderMainMedia = (item: MediaItem, index: number) => {
    console.log('🎬 Rendering media item:', { type: item.type, src: item.src.substring(0, 100) + '...' });
    
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
      const videoId = getYouTubeVideoId(item.src);
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
            <div className="bg-black/70 rounded-full p-1">
              <svg width="12" height="12" fill="white" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </div>
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
          "relative bg-[#161616] border border-ods-border rounded-2xl overflow-hidden group w-full",
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