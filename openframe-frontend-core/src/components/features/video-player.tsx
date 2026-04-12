"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { useImageEdgeColor } from '../../hooks/ui/use-image-edge-color';
import {
  PlayIcon,
  PauseIcon,
  Expand01Icon,
  Collapse01Icon,
} from '../icons-v2-generated/media-playback';
import {
  VolumeUpIcon,
  VolumeDownIcon,
  VolumeOffIcon,
} from '../icons-v2-generated/audio-and-visual';
import { AlertCircleIcon } from '../icons-v2-generated/interface';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

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

// =============================================================================
// SRT → VTT conversion (for native <track> injection on iOS fullscreen)
// =============================================================================

function srtToVtt(srt: string): string {
  return 'WEBVTT\n\n' + srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
}

// =============================================================================
// SRT Subtitle Overlay System
// =============================================================================
// react-player's config.file.tracks is broken (GitHub #1623, #1162, #329).
// The industry standard is a custom subtitle overlay synced via onProgress.
// On iOS native fullscreen, we inject a <track> element so the native player
// shows captions (our overlay is not visible in webkitEnterFullscreen).

interface SrtCue {
  from: number; // milliseconds
  to: number;   // milliseconds
  text: string;
}

/**
 * Parse SRT content into timestamped cues.
 * SRT format: sequential blocks of [index]\n[start --> end]\n[text]\n\n
 */
function parseSrt(srt: string): SrtCue[] {
  const cues: SrtCue[] = [];
  const blocks = srt.replace(/\r\n/g, '\n').trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split('\n');
    // Find the timestamp line (contains " --> ")
    const tsIndex = lines.findIndex(l => l.includes(' --> '));
    if (tsIndex === -1) continue;

    const [startStr, endStr] = lines[tsIndex].split(' --> ');
    const from = parseSrtTimestamp(startStr?.trim());
    const to = parseSrtTimestamp(endStr?.trim());
    if (from === null || to === null) continue;

    // Everything after the timestamp line is the subtitle text
    const text = lines.slice(tsIndex + 1).join('\n').trim();
    if (text) cues.push({ from, to, text });
  }

  return cues;
}

/** Parse "HH:MM:SS,mmm" to milliseconds */
function parseSrtTimestamp(ts: string | undefined): number | null {
  if (!ts) return null;
  const match = ts.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return null;
  return (
    parseInt(match[1]) * 3600000 +
    parseInt(match[2]) * 60000 +
    parseInt(match[3]) * 1000 +
    parseInt(match[4])
  );
}

/**
 * Hook: parse SRT and provide the active subtitle text for the current time.
 * Uses linear scan — performant for typical SRT files (<1000 cues).
 */
function useSubtitleOverlay(srtContent: string | undefined) {
  const cues = useMemo(() => srtContent ? parseSrt(srtContent) : [], [srtContent]);
  const [activeText, setActiveText] = useState<string | null>(null);

  const updateTime = useCallback((playedSeconds: number) => {
    const timeMs = playedSeconds * 1000;
    // Linear scan is fine for typical SRT files (<500 cues)
    const active = cues.find(c => timeMs >= c.from && timeMs <= c.to);
    setActiveText(active?.text ?? null);
  }, [cues]);

  return { activeText, updateTime, hasCues: cues.length > 0 };
}

interface VideoPlayerProps {
  url: string;
  title?: string;
  poster?: string;
  className?: string;
  showTitle?: boolean;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  useNativeAspectRatio?: boolean;
  /** SRT subtitle content string. Parsed and rendered as overlay synced via onProgress. */
  srtContent?: string;
  /** Label for the subtitle track (default: 'English') */
  subtitleLabel?: string;
}

// NOTE: withFirstFramePoster (appending #t=3 to URLs) was removed.
// The #t= media fragment caused playback to START at 3 seconds instead of 0.
// Poster generation is now handled by useVideoFirstFramePoster (canvas extraction)
// and the persisted main_video_thumbnail field — no URL hacks needed.

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  url,
  title,
  poster,
  className = "",
  showTitle = false,
  autoPlay = false,
  loop = false,
  muted = false,
  useNativeAspectRatio = false,
  srtContent,
  subtitleLabel,
}) => {
  // =========================================================================
  // Core state
  // =========================================================================
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [mounted, setMounted] = useState(false);
  const [hasStarted, setHasStarted] = useState(autoPlay);
  const playerRef = useRef<ReactPlayer | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Custom controls state
  const [played, setPlayed] = useState(0);
  const [loaded, setLoaded] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(muted);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Subtitle + fullscreen state
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { activeText, updateTime, hasCues } = useSubtitleOverlay(srtContent);

  // =========================================================================
  // Fullscreen — industry standard dual-mode (Plyr / Video.js / Vidstack pattern)
  //
  // Desktop/Android: container.requestFullscreen() — custom controls survive
  // iOS Safari: video.webkitEnterFullscreen() — native iOS controls take over
  //
  // Every battle-tested player (Plyr, Video.js, Vidstack, YouTube mobile web)
  // surrenders custom controls to iOS in fullscreen. The Fullscreen API doesn't
  // support divs on iOS, and CSS simulation has too many edge cases (notch,
  // address bar, orientation). Native iOS fullscreen is the correct UX.
  // =========================================================================
  useEffect(() => {
    const onChange = () => {
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
      setIsFullscreen(!!fsEl);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isFullscreen) {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      return;
    }

    // Enter fullscreen — try container first (desktop/Android), then native video (iOS)
    if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {
        // Fullscreen API failed on container — try native video element (iOS)
        enterNativeVideoFullscreen();
      });
    } else if ((container as any).webkitRequestFullscreen) {
      (container as any).webkitRequestFullscreen();
    } else {
      // No container fullscreen support (iOS Safari) — use native video fullscreen
      enterNativeVideoFullscreen();
    }
  }, [isFullscreen]);

  // Ref to track blob URL for cleanup
  const nativeTrackBlobRef = useRef<string | null>(null);

  const enterNativeVideoFullscreen = useCallback(() => {
    const video = playerRef.current?.getInternalPlayer() as HTMLVideoElement | null;
    if (!video || !(video as any).webkitEnterFullscreen) return;

    // Inject a native <track> element so iOS's built-in player shows captions
    if (srtContent) {
      // Clean up any previous track
      const old = video.querySelector('track[data-native-cc]');
      if (old) old.remove();
      if (nativeTrackBlobRef.current) URL.revokeObjectURL(nativeTrackBlobRef.current);

      const vtt = srtToVtt(srtContent);
      const blob = new Blob([vtt], { type: 'text/vtt' });
      const blobUrl = URL.createObjectURL(blob);
      nativeTrackBlobRef.current = blobUrl;

      const track = document.createElement('track');
      track.kind = 'captions';
      track.label = subtitleLabel || 'English';
      track.srclang = 'en';
      track.src = blobUrl;
      track.default = true;
      track.setAttribute('data-native-cc', 'true');
      video.appendChild(track);

      // Activate the track
      requestAnimationFrame(() => {
        for (let i = 0; i < video.textTracks.length; i++) {
          if (video.textTracks[i].label === (subtitleLabel || 'English')) {
            video.textTracks[i].mode = 'showing';
            break;
          }
        }
      });
    }

    (video as any).webkitEnterFullscreen();
  }, [srtContent, subtitleLabel]);

  // =========================================================================
  // Volume
  // =========================================================================
  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      setVolume(prevVolume || 0.5);
    } else {
      setPrevVolume(volume);
      setIsMuted(true);
      setVolume(0);
    }
  }, [isMuted, volume, prevVolume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (val > 0) setPrevVolume(val);
  }, []);

  // =========================================================================
  // Auto-hide controls (3s inactivity)
  // Desktop: mouse move shows controls, hide after 3s
  // Mobile: tap toggles controls visibility, auto-hide after 3s when shown
  // =========================================================================
  const startHideTimer = useCallback(() => {
    clearTimeout(hideTimeoutRef.current);
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [isPlaying]);

  // Desktop: mouse movement
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    startHideTimer();
  }, [startHideTimer]);

  // Mobile: tap on video area toggles controls (not on controls bar itself)
  const handleTouchToggle = useCallback(() => {
    if (!hasStarted) return;
    setShowControls(prev => {
      const next = !prev;
      clearTimeout(hideTimeoutRef.current);
      if (next && isPlaying) {
        hideTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      }
      return next;
    });
  }, [hasStarted, isPlaying]);

  // =========================================================================
  // Keyboard shortcuts (Space, Arrow keys, M, F)
  // =========================================================================
  useEffect(() => {
    if (!hasStarted) return;
    const el = containerRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          setIsPlaying(prev => !prev);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          playerRef.current?.seekTo(Math.max(0, (playerRef.current?.getCurrentTime() ?? 0) - 5), 'seconds');
          break;
        case 'ArrowRight':
          e.preventDefault();
          playerRef.current?.seekTo(Math.min(duration, (playerRef.current?.getCurrentTime() ?? 0) + 5), 'seconds');
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(v => { const nv = Math.min(1, v + 0.1); setIsMuted(false); return nv; });
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(v => { const nv = Math.max(0, v - 0.1); if (nv === 0) setIsMuted(true); return nv; });
          break;
        case 'm': case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f': case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'c': case 'C':
          e.preventDefault();
          setCaptionsEnabled(prev => !prev);
          break;
      }
    };

    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [hasStarted, duration, toggleMute, toggleFullscreen]);

  // =========================================================================
  // Helpers
  // =========================================================================
  const formatTime = (secs: number) => {
    if (!secs || !isFinite(secs)) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setPlayed(fraction);
    playerRef.current?.seekTo(fraction, 'fraction');
  }, []);

  // Desktop: Double-click = fullscreen, single click = play/pause
  // Mobile: Single tap = toggle controls (handled by onTouchEnd)
  const isTouchRef = useRef(false);

  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Skip click events that originated from touch (mobile)
    if (isTouchRef.current) { isTouchRef.current = false; return; }
    if ((e.target as HTMLElement).closest('.video-controls-bar')) return;
    if (!hasStarted) return;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = undefined;
      toggleFullscreen();
    } else {
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = undefined;
        setIsPlaying(prev => !prev);
      }, 250);
    }
  }, [hasStarted, toggleFullscreen]);

  const handleContainerTouchEnd = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.video-controls-bar')) return;
    isTouchRef.current = true; // Suppress the subsequent click event
    if (!hasStarted) return;
    handleTouchToggle();
  }, [hasStarted, handleTouchToggle]);
  // Client-side first-frame extraction ALWAYS runs for direct video files
  // (regardless of whether an explicit `poster` was provided). Rationale:
  // the caller may pass a branded OG placeholder as the immediate poster,
  // but we'd rather SWAP it to a real first frame once extraction
  // Skip canvas extraction when an explicit poster is provided — avoids a
  // redundant CDN request for the hidden video element (which causes slow
  // page loads on cold CDN cache). Only extract when no poster exists.
  const extractedPoster = useVideoFirstFramePoster(url, !hasStarted && !poster);
  const effectivePoster = poster || extractedPoster || undefined;
  const posterBgColor = useImageEdgeColor(effectivePoster);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (nativeTrackBlobRef.current) URL.revokeObjectURL(nativeTrackBlobRef.current);
    };
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
              <PlayIcon size={24} className="ml-1 text-ods-text-on-accent" />
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
            <AlertCircleIcon size={48} className="text-ods-attention-red-error" />
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
      {title && showTitle && (
        <div className="video-title font-sans text-lg font-medium text-ods-text-primary mb-3">
          {title}
        </div>
      )}

      {/* Container — fullscreened via Fullscreen API (desktop/Android) so custom controls + subtitles travel with video.
          On iOS Safari, native video.webkitEnterFullscreen() is used (Apple's controls take over — industry standard). */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="region"
        aria-label={title || 'Video player'}
        className={`video-wrapper relative w-full outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
          isFullscreen ? 'bg-black' : ''
        } ${isFullscreen && !showControls && isPlaying ? 'cursor-none' : ''}`}
        style={
          isFullscreen ? { width: '100%', height: '100%' }
          : useNativeAspectRatio ? {}
          : { paddingBottom: '56.25%' }
        }
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
        onTouchEnd={handleContainerTouchEnd}
        onClick={handleContainerClick}
      >
        {/* Initial play overlay */}
        {!hasStarted && !hasError && (
          <div className="absolute inset-0 cursor-pointer group z-20" onClick={handlePlayClick}>
            {effectivePoster && (
              <img src={effectivePoster} alt={title || 'Video thumbnail'}
                className="w-full h-full object-contain rounded-md"
                style={{ backgroundColor: posterBgColor }} />
            )}
            <div className={`absolute inset-0 ${effectivePoster ? 'bg-black/40' : 'bg-black/20'} group-hover:bg-black/50 transition-all flex items-center justify-center rounded-md`}>
              <div className="w-16 h-16 rounded-full bg-ods-accent hover:bg-ods-accent/90 transition-all flex items-center justify-center shadow-lg">
                <PlayIcon size={24} className="ml-1 text-ods-text-on-accent" />
              </div>
            </div>
          </div>
        )}

        {/* ReactPlayer */}
        <div className={
          isFullscreen ? "video-player absolute inset-0"
          : useNativeAspectRatio ? "video-player rounded-md overflow-hidden border border-ods-border bg-ods-background"
          : "video-player absolute inset-0 rounded-md overflow-hidden border border-ods-border bg-ods-background"
        }>
          <ReactPlayer
            ref={playerRef}
            url={url}
            width="100%"
            height="100%"
            controls={false}
            playing={isPlaying}
            loop={loop}
            muted={isMuted}
            volume={isMuted ? 0 : volume}
            onError={handleError}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onDuration={setDuration}
            onBuffer={() => setIsBuffering(true)}
            onBufferEnd={() => setIsBuffering(false)}
            onProgress={({ played: p, loaded: l, playedSeconds }) => {
              setPlayed(p);
              setLoaded(l);
              updateTime(playedSeconds);
            }}
            progressInterval={200}
            config={{ file: { attributes: { controlsList: 'nodownload', playsInline: true, preload: 'metadata' } } }}
            light={false}
            playsinline
          />
        </div>

        {/* Buffering spinner */}
        {isBuffering && hasStarted && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Subtitle overlay — moves up/down in sync with controls bar visibility */}
        {captionsEnabled && activeText && hasStarted && (
          <div
            className="absolute left-[5%] right-[5%] text-center pointer-events-none z-10 transition-[bottom] duration-300 ease-in-out"
            style={{ bottom: (showControls || !isPlaying) ? 72 : 16 }}
          >
            <span
              className="inline-block bg-black/80 text-white leading-relaxed px-4 py-1.5 rounded font-sans font-medium whitespace-pre-line"
              style={{
                fontSize: isFullscreen ? 'clamp(20px, 3.3vh, 42px)' : 'clamp(15px, 3.3cqw, 26px)',
                maxWidth: '90%',
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                WebkitTextStroke: '0.3px rgba(0,0,0,0.3)',
              }}
            >
              {activeText}
            </span>
          </div>
        )}

        {/* Custom Controls Bar — always on, CC button shown only when subtitles exist */}
        {hasStarted && (
          <div
            className={`video-controls-bar absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onTouchEnd={(e) => { e.stopPropagation(); startHideTimer(); }}
          >
            <div className="bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-8 pb-2 px-3 rounded-b-md">
              {/* Progress bar — 3-layer with 44px touch hit area, ARIA slider for screen readers */}
              <div
                className="group/seek relative w-full h-11 cursor-pointer mb-1 flex items-center"
                role="slider"
                aria-label="Video progress"
                aria-valuenow={Math.round(played * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onClick={handleProgressBarClick}
                onTouchEnd={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); playerRef.current?.seekTo(Math.min(duration, (playerRef.current?.getCurrentTime() ?? 0) + 5), 'seconds'); }
                  if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); playerRef.current?.seekTo(Math.max(0, (playerRef.current?.getCurrentTime() ?? 0) - 5), 'seconds'); }
                }}
              >
                {/* Visual track (thin line, expands on hover) */}
                <div className="absolute left-0 right-0 h-1 [@media(hover:hover)]:group-hover/seek:h-1.5 transition-all top-1/2 -translate-y-1/2">
                  <div className="absolute inset-0 bg-white/20 rounded-full" />
                  <div className="absolute inset-y-0 left-0 bg-white/40 rounded-full transition-all"
                    style={{ width: `${loaded * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 bg-white rounded-full"
                    style={{ width: `${played * 100}%` }} />
                </div>
                {/* Scrub thumb — always visible on touch, hover on desktop, scales up on hover */}
                <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-md opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/seek:opacity-100 [@media(hover:hover)]:group-hover/seek:scale-125 transition-all"
                  style={{ left: `calc(${played * 100}% - 8px)` }} />
              </div>

              <div className="flex items-center justify-between">
                {/* Left: Play, Volume, Time */}
                <div className="flex items-center gap-0.5">
                  {/* Play/Pause — 44×44 touch target */}
                  <Button variant="ghost" size="icon"
                    onClick={(e) => { e.stopPropagation(); setIsPlaying(prev => !prev); }}
                    className="h-11 w-11 text-white hover:text-white/80 hover:bg-white/10"
                    aria-label={isPlaying ? 'Pause (Space)' : 'Play (Space)'}>
                    {isPlaying ? <PauseIcon size={22} color="white" /> : <PlayIcon size={22} color="white" />}
                  </Button>

                  {/* Volume: icon + hover-reveal slider */}
                  <div className="group/vol flex items-center">
                    <Button variant="ghost" size="icon"
                      onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                      className="h-11 w-11 text-white hover:text-white/80 hover:bg-white/10"
                      aria-label={isMuted ? 'Unmute (M)' : 'Mute (M)'}>
                      {isMuted || volume === 0
                        ? <VolumeOffIcon size={22} color="white" />
                        : volume < 0.5
                          ? <VolumeDownIcon size={22} color="white" />
                          : <VolumeUpIcon size={22} color="white" />
                      }
                    </Button>
                    {/* Volume slider — reveals on hover (desktop only, hidden on touch) */}
                    <div className="w-0 overflow-hidden group-hover/vol:w-20 transition-all duration-200 flex items-center">
                      <Input
                        type="range" min={0} max={1} step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Volume"
                        className="w-16 ml-1"
                        style={{ background: `linear-gradient(to right, white ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.3) ${(isMuted ? 0 : volume) * 100}%)` }}
                      />
                    </div>
                  </div>

                  {/* Time */}
                  <span className="text-white/70 text-xs font-mono tabular-nums select-none ml-1">
                    {formatTime(played * duration)} / {formatTime(duration)}
                  </span>
                </div>

                {/* Right: CC, Fullscreen */}
                <div className="flex items-center gap-0.5">
                  {hasCues && (
                    <Button variant="ghost" size="sm"
                      onClick={(e) => { e.stopPropagation(); setCaptionsEnabled(prev => !prev); }}
                      className={`h-11 min-w-[44px] px-2 text-xs font-bold rounded ${
                        captionsEnabled ? 'bg-white text-black hover:bg-white/90' : 'text-white/50 hover:text-white hover:bg-white/10'
                      }`}
                      style={{ borderBottom: captionsEnabled ? '2px solid white' : '2px solid transparent' }}
                      title={captionsEnabled ? 'Hide captions (C)' : 'Show captions (C)'}
                      aria-label={captionsEnabled ? 'Hide captions' : 'Show captions'}>
                      CC
                    </Button>
                  )}

                  <Button variant="ghost" size="icon"
                    onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
                    className="h-11 w-11 text-white/80 hover:text-white hover:bg-white/10"
                    title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
                    aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                    {isFullscreen ? <Collapse01Icon size={22} color="white" /> : <Expand01Icon size={22} color="white" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
