"use client";

import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player/youtube';

// Simple SVG icon components
const Play = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} fill="currentColor" viewBox="0 0 24 24" className={className}>
    <polygon points="5,3 19,12 5,21"/>
  </svg>
);

const Loader = ({ size = 16, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" className={className}>
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
    <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
  </svg>
);

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
  showTitle?: boolean;
  showMeta?: boolean;
  minimalControls?: boolean;
}

export const YouTubeEmbed: React.FC<YouTubeEmbedProps> = ({ 
  videoId, 
  title = "YouTube Video",
  className = "",
  showTitle = true,
  showMeta = true,
  minimalControls = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useIframe, setUseIframe] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Always use iframe to avoid CSP issues with ReactPlayer scripts
    setUseIframe(true);
    setIsLoading(false);
  }, []);

  const handleReady = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
    // Fallback to iframe on error
    setUseIframe(true);
  };

  const handlePlay = () => {
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  
  // Build embed URL with conditional parameters
  const embedParams = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1'
  });
  
  if (minimalControls) {
    embedParams.set('controls', '0'); // Hide all controls
    embedParams.set('showinfo', '0'); // Hide video info
    embedParams.set('fs', '0'); // Disable fullscreen
    embedParams.set('iv_load_policy', '3'); // Hide annotations
    embedParams.set('cc_load_policy', '0'); // Hide captions
    embedParams.set('disablekb', '1'); // Disable keyboard controls
    embedParams.set('rel', '0'); // Hide related videos (already set above, but ensure it's enforced)
  }
  
  const embedUrl = `https://www.youtube.com/embed/${videoId}?${embedParams.toString()}`;

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className={`youtube-embed-container my-6 ${className}`}>
        <div className="video-wrapper relative w-full" style={{ paddingBottom: '56.25%' }}>
          <div className="loading-overlay absolute inset-0 bg-ods-card border border-ods-border rounded-lg flex items-center justify-center">
            <div className="loading-content flex flex-col items-center gap-3">
              <Loader className="animate-spin text-ods-accent" size={32} />
              <span className="font-sans text-sm text-ods-text-secondary">Loading video...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`youtube-embed-error ${className}`}>
        <div className="error-state bg-ods-card border border-ods-error rounded-lg p-6 text-center my-6">
          <div className="error-icon flex justify-center mb-4">
            <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24" className="text-ods-error">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <div className="error-title font-sans font-semibold text-lg text-ods-error mb-2">
            Video Unavailable
          </div>
          <div className="error-description font-sans text-sm text-ods-text-secondary mb-4">
            Unable to load YouTube video. The video may be private or deleted.
          </div>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="error-retry-button bg-ods-error hover:bg-ods-error-hover text-ods-text-on-error border-none rounded px-4 py-2 font-sans font-medium text-sm cursor-pointer transition-colors duration-200"
          >
            Watch on YouTube
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`youtube-embed-container my-6 ${className}`}>
      {/* Video Title */}
      {title && showTitle && (
        <div className="video-title font-sans text-lg font-medium text-ods-text-primary mb-3">
          {title}
        </div>
      )}

      {/* Video Container with 16:9 Aspect Ratio */}
      <div className="video-wrapper relative w-full" style={{ paddingBottom: '56.25%' }}>
        {/* Loading State */}
        {isLoading && (
          <div className="loading-overlay absolute inset-0 bg-ods-card border border-ods-border rounded-lg flex items-center justify-center">
            <div className="loading-content flex flex-col items-center gap-3">
              <Loader className="animate-spin text-ods-accent" size={32} />
              <span className="font-sans text-sm text-ods-text-secondary">Loading video...</span>
            </div>
          </div>
        )}

        {/* Video Player */}
        <div className="video-player absolute inset-0 rounded-lg overflow-hidden border border-ods-border bg-ods-bg-inverse">
          {useIframe ? (
            // Iframe fallback for mobile and error cases
            <iframe
              src={embedUrl}
              title={title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ border: 'none' }}
            />
          ) : (
            <ReactPlayer
              url={videoUrl}
              width="100%"
              height="100%"
              onReady={handleReady}
              onError={handleError}
              onPlay={handlePlay}
              onPause={handlePause}
              config={{
                youtube: {
                  playerVars: {
                    autoplay: 0,
                    controls: 1,
                    rel: 0,
                    showinfo: 0,
                    modestbranding: 1,
                    iv_load_policy: 3,
                    cc_load_policy: 0,
                    playsinline: 1
                  }
                }
              } as any}
              light={false} // Show video immediately
              playing={false} // Don't autoplay
            />
          )}
        </div>

        {/* Custom Play Button Overlay (optional enhancement) - only for ReactPlayer */}
        {!useIframe && !isPlaying && !isLoading && (
          <div className="play-overlay absolute inset-0 flex items-center justify-center bg-ods-bg-inverse bg-opacity-20 rounded-lg transition-opacity duration-300 hover:bg-opacity-30">
            <button 
              onClick={() => setIsPlaying(true)}
              className="play-button bg-ods-accent hover:bg-ods-accent-hover text-ods-text-on-accent w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 transform hover:scale-110 shadow-lg"
              aria-label="Play video"
            >
              <Play size={24} className="ml-1" />
            </button>
          </div>
        )}
      </div>

      {/* Video Meta Information */}
      {showMeta && (
        <div className="video-meta flex items-center justify-between mt-3 text-sm text-ods-text-secondary">
          <div className="video-platform font-sans">
            YouTube
          </div>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="video-link font-sans text-ods-accent hover:text-ods-accent-hover transition-colors duration-200"
          >
            Watch on YouTube →
          </a>
        </div>
      )}
    </div>
  );
};

// Utility function to extract YouTube video ID from various URL formats
export const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
};

// Component for parsing YouTube URLs in markdown
export const YouTubeLinkParser: React.FC<{ href: string; children: React.ReactNode }> = ({ href, children }) => {
  const videoId = extractYouTubeId(href);
  
  // If it's a YouTube URL, render the embed instead of a link
  if (videoId) {
    return <YouTubeEmbed videoId={videoId} title={typeof children === 'string' ? children : undefined} />;
  }

  // Otherwise, render as a normal link
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="text-ods-accent hover:text-ods-accent-hover transition-colors duration-200"
    >
      {children}
    </a>
  );
};