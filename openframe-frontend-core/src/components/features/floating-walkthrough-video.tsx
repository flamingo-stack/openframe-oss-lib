"use client";

/**
 * <FloatingWalkthroughVideo> — THE generic, embeddable per-platform demo-video
 * widget. A collapsed card pinned bottom-left (bite-identical hover grammar via
 * <VideoHoverPreviewSurface>) that opens a large in-page theater (Radix Dialog
 * primitives, NOT native fullscreen) hosting <EntityVideoSection> for full
 * controls + captions + AI summary.
 *
 * All UI lives here in the lib so every platform site AND the react-embedding
 * example mount the same component; the host supplies only the video data.
 *
 * Audio invariant (both directions): never two overlapping streams, nor a blip.
 *   - open: pause the hover preview synchronously (pointerdown), force the
 *     surface inactive for the whole open duration, reset the YouTube suspend.
 *   - close: snapshot then pause the theater player (file) / suspend (YouTube)
 *     before the Radix exit animation can bleed audio.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../utils/cn';
import { getProxiedImageUrl } from '../../utils/image-proxy';
import { DialogPortal, DialogOverlay } from '../ui/dialog';
import { VideoHoverPreviewSurface } from './video-hover-preview';
import { EntityVideoSection } from './entity-video-section';
import { VideoPlayBadge, VideoUnmuteGlyph } from './video-center-badge';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { Video, type VideoPlayerHandle, type VideoMutedFallbackState } from './video';
import {
  WALKTHROUGH_VIDEO_DISMISS_KEY,
  isDismissed as isDismissedStore,
  writeDismissed,
} from '../../utils/dismissal-storage';

interface MarkdownRendererProps {
  content: string;
}

/** Wire-shape data for the widget. Kept as the shared contract the hub DAL
 *  re-exports as `PublicWalkthroughVideo & { id }`. `mainVideoUrl`/`youtubeUrl`
 *  stay SEPARATE — YouTube-vs-file precedence is resolved by EntityVideoSection. */
export interface WalkthroughVideoData {
  mainVideoUrl?: string | null;
  youtubeUrl?: string | null;
  posterUrl?: string | null;
  /** RELATIVE VTT path (/api/captions/...); embedders prefix their proxy base. */
  captionsUrl?: string | null;
  summary?: string | null;
  title?: string | null;
  presenterName?: string | null;
  presenterAvatarUrl?: string | null;
}

export interface FloatingWalkthroughVideoProps {
  video: WalkthroughVideoData | null | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  label?: string;
  appearDelayMs?: number;
  dismissal?: { storageKey?: string; ttlDays?: number } | false;
  hideNearSelector?: string;
  /** Route identity from the host (the lib can't observe navigation). Changing
   *  it re-queries the footer IO target. */
  pathname?: string;
  /** Image-proxy prefix for the presenter avatar (external URL). When unset the
   *  raw URL is used (proxy is opt-in — the hub threads `/api/image-proxy`). */
  imageProxyPrefix?: string;
  MarkdownRenderer?: React.ComponentType<MarkdownRendererProps>;
  className?: string;
}

const WALKTHROUGH_Z = 'z-[9980]'; // one layer BELOW the chat dock (z-[9990]).
const DEFAULT_TTL_DAYS = 7;

interface Handoff {
  time: number;
  muted: boolean;
  playing: boolean;
}

export function FloatingWalkthroughVideo({
  video,
  open: openProp,
  onOpenChange,
  defaultOpen,
  label = 'Play Demo Video',
  appearDelayMs = 3000,
  dismissal = {},
  hideNearSelector = 'footer',
  pathname,
  imageProxyPrefix,
  MarkdownRenderer,
  className,
}: FloatingWalkthroughVideoProps): React.ReactElement | null {
  const dismissEnabled = dismissal !== false;
  const storageKey = (dismissEnabled && dismissal.storageKey) || WALKTHROUGH_VIDEO_DISMISS_KEY;
  const ttlDays = (dismissEnabled && dismissal.ttlDays) || DEFAULT_TTL_DAYS;

  // --- mount gate (never LCP; storage read happens post-delay, no hydration mismatch) ---
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let idleHandle: number | null = null;
    const timer = setTimeout(() => {
      const reveal = () => {
        if (dismissEnabled && isDismissedStore(storageKey, ttlDays)) {
          setDismissed(true);
          return;
        }
        setMounted(true);
      };
      const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
      if (typeof ric === 'function') idleHandle = ric(reveal);
      else reveal();
    }, appearDelayMs);
    return () => {
      clearTimeout(timer);
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (idleHandle !== null && typeof cic === 'function') cic(idleHandle);
    };
  }, [appearDelayMs, dismissEnabled, storageKey, ttlDays]);

  // --- environment preferences (read after mount; no SSR access) ---
  const [previewSuppressed, setPreviewSuppressed] = useState(false);
  useEffect(() => {
    try {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const saveData = conn?.saveData === true || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
      setPreviewSuppressed(Boolean(reducedMotion || saveData));
    } catch { /* ignore */ }
  }, []);

  // --- controlled/uncontrolled open ---
  const [openState, setOpenState] = useState(Boolean(defaultOpen));
  const open = openProp !== undefined ? openProp : openState;

  // --- refs & continuation state ---
  const previewHandleRef = useRef<VideoPlayerHandle | null>(null);
  const theaterHandleRef = useRef<VideoPlayerHandle | null>(null);
  const resumeHandleRef = useRef<VideoPlayerHandle | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const endedLatchRef = useRef(false);

  const [hovered, setHovered] = useState(false);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [theaterStart, setTheaterStart] = useState<{ time: number; muted: boolean }>({ time: 0, muted: false });
  const [footerHidden, setFooterHidden] = useState(false);
  const [cardFallback, setCardFallback] = useState<VideoMutedFallbackState>({ muted: false, blocked: false });

  const isYouTube = Boolean(video?.youtubeUrl);
  const resumeMode = handoff?.playing === true && !isYouTube;
  const previewAllowed = !previewSuppressed && !isYouTube;

  // --- footer fade (re-query on pathname change; null-tolerant) ---
  useEffect(() => {
    if (!mounted) return;
    const el = typeof document !== 'undefined' ? document.querySelector(hideNearSelector) : null;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setFooterHidden(false);
      return;
    }
    const io = new IntersectionObserver(
      entries => setFooterHidden(entries[0]?.isIntersecting ?? false),
      { rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, hideNearSelector, pathname]);

  // --- tab-hidden: pause resume-mode playback, keep the timestamp ---
  useEffect(() => {
    if (!resumeMode) return;
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        const h = resumeHandleRef.current;
        if (h) {
          const time = h.getCurrentTime();
          h.pause();
          setHandoff({ time, muted: h.getMuted(), playing: false });
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [resumeMode]);

  const commitOpen = useCallback((next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  }, [openProp, onOpenChange]);

  // Synchronous preview pause on pointerdown — the window-capture activation
  // waiter unmutes a pre-activation preview on the first pointerdown; without
  // this the opening/dismissing press itself blips at 50% volume.
  const pausePreviewNow = useCallback(() => {
    try { previewHandleRef.current?.pause(); } catch { /* ignore */ }
  }, []);

  const openTheater = useCallback(() => {
    // Seed theater start from the resume player (live state) or a paused handoff.
    let start = { time: 0, muted: false };
    if (resumeHandleRef.current) {
      start = { time: resumeHandleRef.current.getCurrentTime(), muted: resumeHandleRef.current.getMuted() };
    } else if (handoff) {
      // Honor user-chosen mute; a fallback-forced mute reopens unmuted.
      start = { time: handoff.time, muted: handoff.muted && !cardFallback.blocked };
    }
    setTheaterStart(start);
    setHovered(false);          // force preview inactive
    setSuspended(false);        // reset YouTube suspend for this open
    endedLatchRef.current = false;
    setHandoff(null);           // resume player unmounts
    commitOpen(true);
  }, [handoff, cardFallback.blocked, commitOpen]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) { openTheater(); return; }
    // Closing: snapshot + stop the theater player BEFORE the exit animation.
    if (isYouTube) {
      setSuspended(true);
      commitOpen(false);
      return;
    }
    const h = theaterHandleRef.current;
    if (h) {
      const time = h.getCurrentTime();
      const muted = h.getMuted();
      const paused = h.getPaused();
      const duration = h.getDuration();
      const atEnd = duration > 0 && duration - time < 1;
      h.pause();
      if (!paused) {
        // Live playing snapshot always wins (beats a stale ended latch).
        setHandoff({ time, muted, playing: true });
      } else if (endedLatchRef.current && atEnd) {
        setHandoff(null);       // finished — plain poster, no continuation
      } else if (time < 1) {
        setHandoff(null);       // degenerate close — keep hover preview enabled
      } else {
        setHandoff({ time, muted, playing: false });
      }
    }
    commitOpen(false);
  }, [isYouTube, commitOpen]);

  const onCardFallbackChange = useCallback((s: VideoMutedFallbackState) => setCardFallback(s), []);

  const dismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    pausePreviewNow();
    if (dismissEnabled) writeDismissed(storageKey);
    setDismissed(true);
  }, [dismissEnabled, storageKey, pausePreviewNow]);

  // Card-level unmute/play control (the internal glyph is unreachable under the
  // activation overlay — hideMutedBadge). Acts on the active player handle.
  const activeHandle = () => (resumeMode ? resumeHandleRef.current : previewHandleRef.current);
  const onUnmuteOrPlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const h = activeHandle();
    if (!h) return;
    try { h.setMuted(false); void h.play(); } catch { /* ignore */ }
  }, [resumeMode]);

  const summaryTitle = video?.title || undefined;

  // Presenter avatar is an EXTERNAL URL — route it through the image proxy when
  // the host supplies a prefix (raw fallback otherwise; relative URLs pass through).
  const presenterAvatarSrc = useMemo(
    () => getProxiedImageUrl(video?.presenterAvatarUrl ?? null, { proxyPrefix: imageProxyPrefix }),
    [video?.presenterAvatarUrl, imageProxyPrefix],
  );

  const embedUrlKey = useMemo(() => `${video?.mainVideoUrl ?? ''}|${video?.youtubeUrl ?? ''}`, [video?.mainVideoUrl, video?.youtubeUrl]);

  if (!video || (!video.mainVideoUrl && !video.youtubeUrl)) return null;

  // The collapsed card is suppressed by the appear-delay mount gate and by
  // dismissal — but the THEATER (Dialog) is NOT. A host that controls
  // `open={true}` must be able to force the theater even before the card has
  // appeared or after it was dismissed, so the gate lives on the card only.
  const showCard = mounted && !dismissed;

  const cardActive = !open && previewAllowed && hovered && !handoff;
  const showCardControl = cardFallback.muted;

  // --- collapsed card (div root + overlay button + sibling X/unmute controls) ---
  const collapsed = (
    <div
      className={cn(
        'pointer-events-auto relative overflow-hidden rounded-lg border border-ods-border bg-ods-card shadow-2xl',
        'aspect-video w-60 sm:w-80 transition-opacity duration-200',
        footerHidden ? 'opacity-0 pointer-events-none' : 'opacity-100',
        className,
      )}
      onPointerEnter={() => { if (previewAllowed && !resumeMode) setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
    >
      {resumeMode ? (
        <EmbeddedResumePlayer
          key={`resume-${embedUrlKey}`}
          url={video.mainVideoUrl!}
          poster={video.posterUrl}
          startTime={handoff!.time}
          startMuted={handoff!.muted}
          handleRef={resumeHandleRef}
          onEnded={() => { setHandoff(null); }}
          hideMutedBadge
          onMutedFallbackChange={onCardFallbackChange}
        />
      ) : (
        <VideoHoverPreviewSurface
          key={`preview-${embedUrlKey}`}
          url={video.mainVideoUrl || video.youtubeUrl || ''}
          posterUrl={video.posterUrl}
          active={cardActive}
          isClone={false}
          badge="play"
          fit="cover"
          posterSizes="320px"
          preload="none"
          hideMutedBadge
          onMutedFallbackChange={onCardFallbackChange}
          previewHandleRef={previewHandleRef}
        />
      )}

      {/* full-card activation overlay (lowest of the sibling controls) */}
      <button
        type="button"
        aria-label={video.title ? `${label}: ${video.title}` : label}
        onPointerDown={pausePreviewNow}
        onClick={openTheater}
        className="absolute inset-0 z-20 flex items-end p-3 text-left"
      >
        <span className="pointer-events-none flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-h6 text-ods-text-primary">
          <VideoPlayBadge size="sm" />
          {label}
        </span>
      </button>

      {/* presenter bubble (decorative) */}
      {presenterAvatarSrc && (
        <img
          src={presenterAvatarSrc}
          alt=""
          aria-hidden
          className="absolute bottom-2 right-2 z-20 h-12 w-12 rounded-full border-2 border-ods-border object-cover"
        />
      )}

      {/* card-level unmute/play control (above the overlay) */}
      {showCardControl && (
        <button
          type="button"
          aria-label={cardFallback.blocked ? 'Play' : 'Unmute'}
          title={cardFallback.blocked ? 'Play' : 'Unmute'}
          onPointerDown={e => e.stopPropagation()}
          onClick={onUnmuteOrPlay}
          className="absolute inset-0 z-30 m-auto flex h-12 w-12 items-center justify-center text-ods-text-primary transition-colors hover:text-ods-accent"
        >
          {cardFallback.blocked ? <VideoPlayBadge /> : <VideoUnmuteGlyph />}
        </button>
      )}

      {/* dismiss (highest) */}
      {dismissEnabled && (
        <button
          type="button"
          aria-label="Dismiss video"
          onPointerDown={pausePreviewNow}
          onClick={dismiss}
          className="absolute right-1 top-1 z-40 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-ods-text-primary transition-colors hover:text-ods-accent"
        >
          <XmarkIcon size={16} />
        </button>
      )}
    </div>
  );

  return (
    <>
      {showCard && (
        <div className={cn('pointer-events-none fixed bottom-0 left-0 p-4', WALKTHROUGH_Z)} style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {collapsed}
        </div>
      )}

      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            onOpenAutoFocus={e => {
              // Prevent Radix's default (first focusable) and move focus to the
              // close button so keyboard/AT users land inside the dialog.
              e.preventDefault();
              closeButtonRef.current?.focus();
            }}
            className={cn(
              'fixed z-[9999] bg-ods-card shadow-2xl focus:outline-none',
              // Mobile: full-height sheet (svh, never dvh/lvh).
              'inset-x-0 bottom-0 h-[100svh] overflow-y-auto',
              // Desktop: centered theater lightbox.
              'sm:inset-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[85vh] sm:w-[min(80vw,1200px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:overflow-y-auto sm:rounded-lg sm:border sm:border-ods-border',
            )}
          >
            <DialogPrimitive.Title className="sr-only">{summaryTitle || 'Walkthrough video'}</DialogPrimitive.Title>
            <div className="p-4 sm:p-6">
              <EntityVideoSection
                mainVideoUrl={video.mainVideoUrl}
                youtubeUrl={video.youtubeUrl}
                mainVideoPoster={video.posterUrl}
                title={summaryTitle}
                videoSummary={video.summary}
                captionsUrl={video.captionsUrl}
                MarkdownRenderer={MarkdownRenderer}
                fullVideoLayout="wide"
                stickyVideo
                startTime={theaterStart.time}
                playerHandleRef={theaterHandleRef}
                autoPlayUnmuted={!theaterStart.muted}
                startMuted={theaterStart.muted}
                suspended={suspended}
                onEnded={() => { endedLatchRef.current = true; }}
                priority={false}
              />
            </div>
            <DialogPrimitive.Close
              ref={closeButtonRef}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-ods-text-primary transition-colors hover:text-ods-accent"
            >
              <XmarkIcon size={20} />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>
    </>
  );
}

/** Resume-mode card player — a chromeless <Video> continuing at the handoff
 *  timestamp, honoring the snapshot mute. Rendered via EntityVideoSection's
 *  sibling primitive would over-carry AI UI, so we mount <Video> directly here
 *  through the shared surface's player path is not needed — a plain file player
 *  is enough for continuation. */
function EmbeddedResumePlayer(props: {
  url: string;
  poster?: string | null;
  startTime: number;
  startMuted: boolean;
  handleRef: React.Ref<VideoPlayerHandle>;
  onEnded: () => void;
  hideMutedBadge?: boolean;
  onMutedFallbackChange?: (s: VideoMutedFallbackState) => void;
}): React.ReactElement {
  return (
    <div className="absolute inset-0">
      <Video
        kind="file"
        url={props.url}
        poster={props.poster}
        startTime={props.startTime}
        autoPlay={props.startMuted}
        startMuted={props.startMuted}
        autoPlayUnmuted={!props.startMuted}
        chromeless
        layout="fill"
        fit="cover"
        playerHandleRef={props.handleRef}
        onEnded={props.onEnded}
        hideMutedBadge={props.hideMutedBadge}
        onMutedFallbackChange={props.onMutedFallbackChange}
      />
    </div>
  );
}
