"use client";

import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';

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

interface VideoPlayerProps {
  url: string;
  title?: string;
  poster?: string;
  className?: string;
  showTitle?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  useNativeAspectRatio?: boolean;
  /** @deprecated No longer needed — play overlay always shows. Kept for backward compatibility. */
  showPlayOverlay?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  title,
  poster,
  className = "",
  showTitle = false,
  autoPlay = false,
  loop = false,
  muted = false,
  controls = true,
  useNativeAspectRatio = false,
}) => {
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [mounted, setMounted] = useState(false);
  const [hasStarted, setHasStarted] = useState(autoPlay);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleError = () => {
    setHasError(true);
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setHasStarted(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const handlePlayClick = () => {
    setHasStarted(true);
    setIsPlaying(true);
  };

  // SSR placeholder — consistent loading skeleton
  if (!mounted) {
    return (
      <div className={`video-player-container ${className}`}>
        <div
          className="video-wrapper relative w-full"
          style={useNativeAspectRatio ? {} : { paddingBottom: '56.25%' }}
        >
          <div className={useNativeAspectRatio
            ? "bg-black rounded-md flex items-center justify-center min-h-[200px]"
            : "absolute inset-0 bg-black rounded-md flex items-center justify-center"
          }>
            <div className="w-16 h-16 rounded-full bg-ods-accent flex items-center justify-center shadow-lg">
              <Play size={24} className="ml-1 text-ods-text-on-accent" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className={`video-player-error ${className}`}>
        <div className="error-state bg-ods-card border border-ods-border rounded-md p-6 text-center">
          <div className="error-icon flex justify-center mb-4">
            <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24" className="text-ods-attention-red-error">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <div className="error-title font-sans font-semibold text-lg text-ods-attention-red-error mb-2">
            Video Unavailable
          </div>
          <div className="error-description font-sans text-sm text-ods-text-secondary mb-4">
            Unable to load video. The video may be unavailable or the format is not supported.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`video-player-container ${className}`}>
      {/* Video Title */}
      {title && showTitle && (
        <div className="video-title font-sans text-lg font-medium text-ods-text-primary mb-3">
          {title}
        </div>
      )}

      {/* Video Container */}
      <div
        className="video-wrapper relative w-full"
        style={useNativeAspectRatio ? {} : { paddingBottom: '56.25%' }}
      >
        {/* Play button overlay — shown before user clicks play */}
        {!hasStarted && !hasError && (
          <div
            className={useNativeAspectRatio
              ? "absolute inset-0 cursor-pointer group z-20"
              : "absolute inset-0 cursor-pointer group z-20"
            }
            onClick={handlePlayClick}
          >
            {/* Poster image overlay (when provided) */}
            {poster && (
              <img
                src={poster}
                alt={title || 'Video thumbnail'}
                className="w-full h-full object-cover rounded-md"
              />
            )}
            {/* Play button — sits on top of poster or the video first frame */}
            <div className={`absolute inset-0 ${poster ? 'bg-black/40' : 'bg-black/20'} group-hover:bg-black/50 transition-all flex items-center justify-center rounded-md`}>
              <div className="w-16 h-16 rounded-full bg-ods-accent hover:bg-ods-accent/90 transition-all flex items-center justify-center shadow-lg">
                <Play size={24} className="ml-1 text-ods-text-on-accent" />
              </div>
            </div>
          </div>
        )}

        {/* Video Player — always rendered; shows first frame when no poster */}
        <div className={useNativeAspectRatio
          ? "video-player rounded-md overflow-hidden border border-ods-border bg-ods-background"
          : "video-player absolute inset-0 rounded-md overflow-hidden border border-ods-border bg-ods-background"
        }>
          <ReactPlayer
            url={url}
            width="100%"
            height={useNativeAspectRatio ? "auto" : "100%"}
            controls={hasStarted && controls}
            playing={isPlaying}
            loop={loop}
            muted={muted}
            onError={handleError}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            config={{
              file: {
                attributes: {
                  controlsList: 'nodownload',
                  playsInline: true,
                }
              }
            }}
            light={false}
            playsinline
          />
        </div>
      </div>
    </div>
  );
};
