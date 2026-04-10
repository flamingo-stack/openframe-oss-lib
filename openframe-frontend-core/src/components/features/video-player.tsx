"use client";

import React, { useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { useImageEdgeColor } from '../../hooks/ui/use-image-edge-color';

/**
 * Extract a first-frame poster from a direct video file URL via an
 * off-DOM `<video>` + `<canvas>`. This is the most reliable way to get
 * a real thumbnail for ANY video regardless of encoding or moov atom
 * placement (which is what breaks the `#t=0.5` URL-hash trick on long
 * videos whose moov atom is written at the end of the file).
 *
 * Sequence:
 *   1. Create hidden `<video>` with `crossOrigin="anonymous"` (REQUIRED
 *      before setting src, otherwise the canvas is tainted).
 *   2. `loadedmetadata` → seek to `min(0.5s, 5% of duration)`.
 *   3. `seeked` → draw the frame to a canvas → export as data URL.
 *   4. Clean up the hidden video immediately.
 *
 * Falls back to `null` on CORS failure, decode error, or unsupported
 * video format. Callers should treat `null` as "no poster — show play
 * overlay without a thumbnail."
 */
function useVideoFirstFramePoster(
  url: string | undefined,
  enabled: boolean,
): string | null {
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !url) {
      setPoster(null);
      return;
    }
    // Only direct video files — skip YouTube, Vimeo, HLS, etc.
    const isDirectFile = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
    if (!isDirectFile) {
      setPoster(null);
      return;
    }

    let cancelled = false;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.removeAttribute('src');
      try { video.load(); } catch { /* noop */ }
    };

    const onLoadedMetadata = () => {
      if (cancelled) return;
      // Seek to 10% of the video's duration (clamped between 2s and 30s).
      // Many videos have a dark fade-in during the first 1-2 seconds;
      // 10% is far enough to land on real content for both short clips
      // (30s → 3s) and long recordings (30min → 3min, clamped to 30s).
      const dur = video.duration || 10;
      const target = Math.max(2, Math.min(dur * 0.1, 30));
      video.currentTime = target;
    };

    const onSeeked = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx || !canvas.width || !canvas.height) {
          cleanup();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        if (!cancelled) setPoster(dataUrl);
      } catch (err) {
        // Tainted canvas (CORS) or decode failure — silently give up.
        console.warn('[VideoPlayer] first-frame extraction failed', err);
      } finally {
        cleanup();
      }
    };

    const onError = () => {
      cleanup();
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);
    video.src = url;

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      cleanup();
    };
  }, [url, enabled]);

  return poster;
}

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

/**
 * When no explicit poster image is provided, append `#t=0.5` to direct video
 * file URLs (`.mp4`, `.webm`, `.mov`). This tells the browser to seek to
 * 0.5 seconds and display that frame as the native poster — turning the
 * default black rectangle into an actual preview of the video content.
 * Streaming URLs (YouTube, Vimeo, HLS) are left alone since they handle
 * their own posters. URLs that already carry a `#t=` hash are left alone.
 */
function withFirstFramePoster(url: string, hasPoster: boolean): string {
  if (hasPoster) return url;
  if (!url || url.includes('#t=')) return url;
  const isDirectVideoFile = /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
  if (!isDirectVideoFile) return url;
  // Hash must come AFTER any query string: `...mp4?token=abc#t=3`
  // Use 3s (not 0.5s) to skip fade-in intros that are common in
  // screen recordings and presentation videos.
  return `${url}#t=3`;
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
  // Client-side first-frame extraction ALWAYS runs for direct video files
  // (regardless of whether an explicit `poster` was provided). Rationale:
  // the caller may pass a branded OG placeholder as the immediate poster,
  // but we'd rather SWAP it to a real first frame once extraction
  // succeeds. Extraction is short-circuited internally for non-file URLs
  // (YouTube, Vimeo, HLS) and is a no-op once the user presses play.
  const extractedPoster = useVideoFirstFramePoster(url, !hasStarted);
  // Preference order: extracted frame (best, real content) → explicit
  // poster prop (authored image or OG placeholder) → undefined.
  const effectivePoster = extractedPoster || poster || undefined;
  const posterBgColor = useImageEdgeColor(effectivePoster);
  // Derive a playable URL that displays a real first frame via the
  // native `#t=` hash as an additional fallback layer (works for short
  // videos whose moov atom is at the start of the file).
  const playableUrl = withFirstFramePoster(url, !!effectivePoster);

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
            {/* Poster image overlay — explicit OR client-extracted first frame */}
            {effectivePoster && (
              <img
                src={effectivePoster}
                alt={title || 'Video thumbnail'}
                className="w-full h-full object-contain rounded-md"
                style={{ backgroundColor: posterBgColor }}
              />
            )}
            {/* Play button — sits on top of poster or the video first frame */}
            <div className={`absolute inset-0 ${effectivePoster ? 'bg-black/40' : 'bg-black/20'} group-hover:bg-black/50 transition-all flex items-center justify-center rounded-md`}>
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
            url={playableUrl}
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
                  // `preload="metadata"` tells the browser to fetch just
                  // enough to show the first frame (combined with the
                  // `#t=0.5` hash injected by `withFirstFramePoster` above)
                  // so the video displays a real thumbnail instead of a
                  // black rectangle before the user hits play.
                  preload: 'metadata',
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
