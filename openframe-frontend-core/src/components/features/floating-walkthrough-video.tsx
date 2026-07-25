"use client";

/**
 * <FloatingWalkthroughVideo> — THE generic, embeddable per-platform demo-video
 * widget. A collapsed card pinned bottom-left (bite-identical hover grammar via
 * <VideoHoverPreviewSurface>) that opens a large in-page theater (Radix Dialog
 * primitives, NOT native fullscreen) showing ONLY the video: a bare 16:9 stage
 * with the player's own controls + captions. No card chrome, no summary.
 *
 * All UI lives here in the lib so every platform site AND the react-embedding
 * example mount the same component; the host supplies only the video data.
 *
 * STATE MODEL (read before adding a boolean — the recurring bugs in this file
 * all came from ad-hoc flags contradicting each other):
 *   `cardMode`  — ONE discriminant: 'resume' | 'preview' | 'poster'. Derived,
 *                 never stored, so the two players can't both be mounted.
 *   `cardMuted` / `cardPaused` — transport state for whichever card player is
 *                 live. Both toggles ALWAYS render in both states; a control
 *                 that hides itself on use is a dead end (that bug shipped
 *                 twice). Never gate a control's visibility on its own value.
 *   `cardFallback` — autoplay-BLOCKED prompt only. Distinct from `cardMuted`
 *                 (user intent); conflating them is what made unmute vanish.
 *   `handoff`   — theater→card continuation snapshot. Clearing it UNMOUNTS the
 *                 mini player, so never clear it to express "paused".
 * Layering: the media layer is `pointer-events-none` so a paused/idle player
 * can never swallow a click; every non-control click reaches the activation
 * overlay. Corners are exclusive: transport TL, dismiss TR, title+presenter BL.
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
import { Button } from '../ui/button';
import { SquareAvatar } from '../ui/square-avatar';
import { DialogPortal, DialogOverlay } from '../ui/dialog';
import { VideoHoverPreviewSurface } from './video-hover-preview';
import { CardHitLayer } from './card-hit-layer';
import { VideoPlayBadge, VideoUnmuteGlyph } from './video-center-badge';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { VolumeUpIcon } from '../icons-v2-generated/audio-and-visual/volume-up-icon';
import { PauseIcon } from '../icons-v2-generated/media-playback/pause-icon';
import { PlayIcon } from '../icons-v2-generated/media-playback/play-icon';
import { VolumeXmarkIcon } from '../icons-v2-generated/audio-and-visual/volume-xmark-icon';
import { Video, type VideoPlayerHandle, type VideoMutedFallbackState } from './video';
import {
  WALKTHROUGH_VIDEO_DISMISS_KEY,
  isWalkthroughDismissed,
  dismissWalkthrough,
} from '../../utils/dismissal-storage';

/** Wire-shape data for the widget. Kept as the shared contract the hub DAL
 *  re-exports as `PublicWalkthroughVideo & { id }`. `mainVideoUrl`/`youtubeUrl`
 *  stay SEPARATE — YouTube wins when both are set (card matches theater). */
export interface WalkthroughVideoData {
  /** Row id — used for id-match cookie dismissal (a new video re-shows the
   *  card even after an old one was dismissed). */
  id?: string | number;
  mainVideoUrl?: string | null;
  youtubeUrl?: string | null;
  posterUrl?: string | null;
  /** RELATIVE VTT path (/api/captions/...); embedders prefix their proxy base. */
  captionsUrl?: string | null;
  title?: string | null;
  presenterAvatarUrl?: string | null;
}

export interface FloatingWalkthroughVideoProps {
  video: WalkthroughVideoData | null | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  label?: string;
  appearDelayMs?: number;
  /** Cookie-based dismissal (id-match, mirrors the announcement bar). `false`
   *  disables the X entirely. `storageKey` is the per-platform cookie name. */
  dismissal?: { storageKey?: string } | false;
  hideNearSelector?: string;
  /** Route identity from the host (the lib can't observe navigation). Changing
   *  it re-queries the footer IO target. */
  pathname?: string;
  /** Image-proxy prefix for the presenter avatar (external URL). When unset the
   *  raw URL is used (proxy is opt-in — the hub threads `/api/image-proxy`). */
  imageProxyPrefix?: string;
  className?: string;
}

const WALKTHROUGH_Z = 'z-[9980]'; // one layer BELOW the chat dock (z-[9990]).

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
  className,
}: FloatingWalkthroughVideoProps): React.ReactElement | null {
  const dismissEnabled = dismissal !== false;
  const storageKey = (dismissEnabled && dismissal.storageKey) || WALKTHROUGH_VIDEO_DISMISS_KEY;
  // id-match dismissal key: a new video (new id) re-shows the card. No id
  // (embedder) → a stable presence marker so dismissal still works.
  const dismissalId = video?.id != null ? String(video.id) : 'dismissed';

  // --- mount gate (never LCP; cookie read happens post-delay, no hydration mismatch) ---
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let idleHandle: number | null = null;
    const timer = setTimeout(() => {
      const reveal = () => {
        if (dismissEnabled && isWalkthroughDismissed(storageKey, dismissalId)) {
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
  }, [appearDelayMs, dismissEnabled, storageKey, dismissalId]);

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
  // TRUE only when the user pressed Mute. An autoplay-forced mute (cardFallback)
  // is NOT intent, so the theater must not inherit it — conflating the two is
  // what made the theater open silently after a blocked hover preview.
  const userMutedRef = useRef(false);
  const endedLatchRef = useRef(false);

  const [hovered, setHovered] = useState(false);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [suspended, setSuspended] = useState(false);
  const [theaterStart, setTheaterStart] = useState<{ time: number; muted: boolean }>({ time: 0, muted: false });
  const [footerHidden, setFooterHidden] = useState(false);
  const [cardFallback, setCardFallback] = useState<VideoMutedFallbackState>({ muted: false, blocked: false });
  // Card-player transport state, driving the persistent mute/play TOGGLES.
  // Separate from `cardFallback` (which is the autoplay-blocked prompt).
  const [cardMuted, setCardMuted] = useState(false);
  const [cardPaused, setCardPaused] = useState(false);
  // Renderable mirror of `userMutedRef` — the ref is for synchronous reads in
  // callbacks, this is what the player subtree observes. Deliberately NOT
  // `cardMuted`: that also tracks policy-forced mutes.
  const [userMuted, setUserMuted] = useState(false);

  const isYouTube = Boolean(video?.youtubeUrl);
  // PRESENCE-based: any handoff means "the card owns this video at this
  // timestamp"; `playing` only seeds the pause toggle. Keying it on `playing`
  // made a paused close (or a tab-switch) a one-way door — the card lost its
  // transport AND its hover preview with no way back. `!open` keeps a
  // host-controlled `open` from running the card and theater at once.
  const resumeMode = !open && handoff !== null && !isYouTube;
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
          // Pause in place. Rewriting the handoff here used to unmount the
          // mini player, so a background tab-switch silently destroyed it.
          h.pause();
          setCardPaused(true);
        }
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [resumeMode]);

  // Faded out behind the footer: stop audio. The card is `pointer-events-none`
  // while hidden, so a still-playing player would be unreachable — the same
  // reason the tab-hidden handler exists.
  useEffect(() => {
    if (!footerHidden) return;
    const h = resumeHandleRef.current ?? previewHandleRef.current;
    try { h?.pause(); } catch { /* ignore */ }
    setCardPaused(true);
    setHovered(false);
  }, [footerHidden]);

  const commitOpen = useCallback((next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  }, [openProp, onOpenChange]);

  // Synchronous preview pause on pointerdown — the window-capture activation
  // waiter unmutes a pre-activation preview on the first pointerdown; without
  // this the opening/dismissing press itself blips at 50% volume.
  const pausePreviewNow = useCallback(() => {
    // Whichever player is live — in resume mode that is the continuation
    // player, so pausing only the preview left a playing card audible through
    // the whole pointerdown -> click -> commit window.
    const h = resumeHandleRef.current ?? previewHandleRef.current;
    try { h?.pause(); } catch { /* ignore */ }
    // Keep the toggle honest: an aborted press (pointerdown then drag away)
    // otherwise left it reading "Pause" over a paused video.
    setCardPaused(true);
  }, []);

  const openTheater = useCallback(() => {
    // Seed the theater from whatever the card was ACTUALLY playing, so the
    // theater continues at the same second in every direction:
    //   resume player (live) > hover preview (live) > paused handoff snapshot.
    // Reading the preview handle is what makes "hover-preview → click → theater"
    // continue mid-video instead of restarting at 0. Pausing on pointerdown does
    // not reset currentTime, so the value is still accurate here.
    // Source chosen by MODE. Picking "whichever handle reports > 0.5s" let a
    // stale hover-preview position (0:05) shadow a stored handoff (3:20) on
    // desktop while mobile — which never hovers — resumed correctly: the same
    // gesture gave different results per platform.
    // Read the refs directly — no render-scoped state. The previous version
    // consulted `cardActive`, which is declared BELOW this callback and is not
    // a dependency, so the memoized closure always saw its render-0 value
    // (false) and every hover-preview -> theater open restarted at 0:00.
    // A poster-mode preview player reports 0, so it falls through to `handoff`.
    const liveHandle = resumeHandleRef.current ?? previewHandleRef.current;
    const liveTime = liveHandle?.getCurrentTime() ?? 0;
    const start = {
      time: liveTime > 0.5 ? liveTime : (handoff?.time ?? 0),
      // Live element wins over remembered intent (the theater's own chrome may
      // have changed it) — EXCEPT when the element is muted only because
      // autoplay policy forced it, which is not intent.
      // `cardFallback.muted` is armed BOTH by autoplay policy and by our own
      // `startMuted` (i.e. by the user's mute), so it alone cannot mean
      // "forced". Only a fallback the user never asked for is policy-forced;
      // otherwise an explicitly muted video reopened at full volume.
      // Trust the live element only when it has actually been playing; a
      // freshly remounted poster-mode player always reports muted=false and
      // would silently discard the user's last explicit mute.
      muted: (cardFallback.muted && !userMutedRef.current)
        ? false
        : ((liveHandle && (liveTime > 0.5 || liveHandle.getPaused() === false))
            ? liveHandle.getMuted()
            : userMutedRef.current),
    };
    setTheaterStart(start);
    setHovered(false);          // force preview inactive
    setSuspended(false);        // reset YouTube suspend for this open
    endedLatchRef.current = false;
    setHandoff(null);           // resume player unmounts
    commitOpen(true);
  }, [handoff, cardFallback.muted, commitOpen]);

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
      // The theater's own chrome can mute/unmute; that IS user intent, so it
      // must flow back or reopening would contradict what they just did.
      userMutedRef.current = muted;
      setUserMuted(muted);
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

  const onCardFallbackChange = useCallback((s: VideoMutedFallbackState) => {
    setCardFallback(s);
    setCardMuted(s.muted);   // sync the toggle with fallback / chrome unmutes
  }, []);

  // Seed transport state whenever a card player (re)starts.
  useEffect(() => {
    if (resumeMode) { setCardMuted(handoff?.muted ?? false); setCardPaused(handoff?.playing === false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeMode]);
  // A fresh hover starts a fresh preview — clear the paused flag, and re-seed
  // the mute toggle from the user's standing intent so an explicit mute is not
  // silently undone by the hover-start path (which unmutes the element).
  useEffect(() => {
    if (hovered) { setCardPaused(false); setCardMuted(userMutedRef.current); }
  }, [hovered]);

  const dismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    pausePreviewNow();
    if (dismissEnabled) dismissWalkthrough(storageKey, dismissalId);
    setDismissed(true);
  }, [dismissEnabled, storageKey, dismissalId, pausePreviewNow]);

  // Card controls act on whichever player is live (resume continuation or the
  // hover preview). The internal glyph is unreachable under the activation
  // overlay (hideMutedBadge), so these are the only affordances.
  const activeHandle = () => (resumeMode ? resumeHandleRef.current : previewHandleRef.current);

  /** Big centered glyph — the muted-fallback prompt (unmute, or play when even
   *  muted autoplay was blocked). Unchanged bite grammar. */
  const onUnmuteOrPlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const h = activeHandle();
    if (!h) return;
    try {
      // Branch on the LABEL this button is currently rendering, so the action
      // always matches the words. Guarding the unmute on `!userMutedRef.current`
      // (the previous attempt) turned the "Unmute" case into a no-op — and
      // because the corner mute toggle hides while this glyph is up, that left
      // the card with NO way to restore sound. A control that hides itself on
      // use is a dead end; see the state-model note at the top of this file.
      // Recomputed here, NOT read from the render-scoped `controlIsPlay`
      // (declared below this callback — reading it would repeat the stale
      // closure bug that silently restarted the theater at 0:00).
      const actionIsPlay = cardFallback.blocked || cardPaused;
      if (actionIsPlay) {
        void h.play();
        setCardPaused(false);
      } else {
        h.setMuted(false);
        setCardMuted(false);
        userMutedRef.current = false;
        setUserMuted(false);
        void h.play();
        setCardPaused(false);
      }
    } catch { /* ignore */ }
  }, [resumeMode, cardFallback.blocked, cardPaused]);

  /** Mute TOGGLE — stays on screen in both states so the user can come back. */
  const onToggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const h = activeHandle();
    if (!h) return;
    // Live element, not the `cardMuted` snapshot: the module-level activation
    // waiter can unmute between this button's pointerdown and its click, which
    // made the first press of a button labelled "Unmute" mute instead.
    const next = !(h.getMuted() ?? cardMuted);
    try {
      h.setMuted(next);
      if (!next && !cardPaused) void h.play();   // never override an explicit pause
      setCardMuted(next);
      userMutedRef.current = next;
      setUserMuted(next);
    } catch { /* ignore */ }
  }, [resumeMode, cardMuted, cardPaused]);

  /** Play/pause TOGGLE. Deliberately does NOT tear down the resume player
   *  (an earlier version cleared the handoff, which unmounted the mini player
   *  and made the controls vanish with no way back). */
  const onTogglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const h = activeHandle();
    if (!h) return;
    try {
      if (cardPaused) { void h.play(); setCardPaused(false); }
      else { h.pause(); setCardPaused(true); }
    } catch { /* ignore */ }
  }, [resumeMode, cardPaused]);

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

  // Gate on `!resumeMode`, NOT `!handoff`: a non-playing handoff is only a
  // remembered timestamp. Gating on `handoff` froze the card as an inert poster
  // after closing a paused theater (no hover preview, no transport, no way back
  // except reopening) for the rest of the session.
  const cardActive = !open && previewAllowed && hovered && !resumeMode;

  // ONE derived mode drives every branch below. Deriving a single discriminant
  // (instead of testing raw booleans at each call site) is what keeps the card
  // consistent: 'resume' and 'preview' are mutually exclusive by construction,
  // so a player can never be half-mounted or a control half-shown.
  const cardMode: 'resume' | 'preview' | 'poster' =
    resumeMode ? 'resume' : cardActive ? 'preview' : 'poster';

  // Big centered glyph = the muted-fallback prompt (bite grammar), nothing else.
  // Gated on an actual player: `cardFallback` is only ever rewritten by a
  // mounted one, so after it unmounts (e.g. the resume clip ended) a stale
  // `muted:true` left an orphan glyph that played from 0 with sound and no
  // transport controls.
  const showBigUnmute = cardFallback.muted && cardMode !== 'poster';
  // "Play" whenever the action will start playback: autoplay was blocked, or
  // the user paused. Otherwise the label understated what the button does.
  const controlIsPlay = cardFallback.blocked || cardPaused;
  // Transport toggles stay visible for as long as a card player is mounted —
  // in BOTH states of each toggle, so muting/pausing is always reversible.
  const showPlaybackControls = cardMode !== 'poster';

  // --- collapsed card (div root + overlay button + sibling X/unmute controls) ---
  const collapsed = (
    <div
      className={cn(
        // `group/card` is the SHARED hover contract: VideoHoverPreviewSurface's
        // badge accents off it. It must live on an element that actually
        // receives pointer events — the media layer is pointer-events-none, so
        // a group inside it can never match :hover.
        'group/card pointer-events-auto relative overflow-hidden rounded-lg border border-ods-border bg-ods-card shadow-2xl',
        'aspect-video w-60 sm:w-80 transition-opacity duration-200',
        footerHidden ? 'opacity-0 pointer-events-none' : 'opacity-100',
        className,
      )}
      // `mouse` only: pointerenter also fires for touch, which started a
      // preview on every tap. Focus mirrors hover so keyboard users can reach
      // the transport controls at all.
      onPointerEnter={e => { if (e.pointerType === 'mouse' && previewAllowed && !resumeMode) setHovered(true); }}
      onPointerLeave={e => { if (e.pointerType === 'mouse') setHovered(false); }}
      // Re-arm hover after a close that left the pointer parked on the card.
      onPointerMove={e => { if (e.pointerType === 'mouse' && previewAllowed && !resumeMode && !hovered) setHovered(true); }}
      // Keyboard intent only. Chrome focuses buttons on click and Radix
      // restores focus to the hit layer when the theater closes, so a raw
      // focus mirror autostarted an unmuted preview with the pointer nowhere
      // near the card.
      onFocusCapture={e => {
        const el = e.target as HTMLElement;
        // `matches` THROWS SyntaxError on engines that don't know
        // :focus-visible (Safari < 15.4) — that would escape a React handler.
        let keyboard = false;
        try { keyboard = el.matches?.(':focus-visible') ?? false; } catch { keyboard = false; }
        if (previewAllowed && !resumeMode && keyboard) setHovered(true);
      }}
      onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHovered(false); }}
    >
      {/* Media layer is CLICK-TRANSPARENT: a paused/idle player must never
          swallow the click. Every click that isn't on a control falls through
          to the activation overlay below and opens the theater. */}
      <div className="pointer-events-none absolute inset-0">
        {/* ONE player component for BOTH modes. The card used to render a
            bespoke resume player next to the shared preview surface, and that
            duplication is exactly why desktop (preview) and mobile (poster/
            resume) diverged. Same component, same props, one behaviour. */}
        <VideoHoverPreviewSurface
          key={`card-${embedUrlKey}`}
          // File player only. The theater resolves YouTube-wins; the card must
          // not mount MuxPlayer on a youtube.com URL (it renders the poster).
          url={video.mainVideoUrl || ''}
          posterUrl={video.posterUrl}
          active={cardActive}
          isClone={false}
          badge="play"
          fit="cover"
          posterSizes="320px"
          preload="none"
          hideMutedBadge
          onMutedFallbackChange={onCardFallbackChange}
          previewHandleRef={cardMode === 'resume' ? resumeHandleRef : previewHandleRef}
          mutedIntent={userMuted}
          continuation={cardMode === 'resume'}
          autoPlay={cardMode === 'resume' && handoff?.playing !== false}
          startTime={cardMode === 'resume' ? handoff!.time : undefined}
          startMuted={cardMode === 'resume' ? handoff!.muted : false}
          onEnded={cardMode === 'resume' ? () => setHandoff(null) : () => setCardPaused(true)}
        />
      </div>

      {/* CONTENTLESS full-card hit layer. Deliberately a bare <button>, NOT the
          DS <Button>: that component is an inline-flex, content-sized,
          centre-aligned control, so as a full-bleed layer it collapsed around
          its child — which dragged the title pill to the top-left (overlapping
          the transport) and left most of the card unclickable. A hit layer has
          no content and no typography; separating it from the label is what
          makes both positions deterministic. */}
      <CardHitLayer
        label={video.title ? `${label}: ${video.title}` : label}
        onPointerDown={pausePreviewNow}
        onClick={openTheater}
        className="z-20"
      />

      {/* Title pill — its own positioned element (bottom-left), never a child
          of the hit layer. pointer-events-none so clicks fall through to it. */}
      <span className="pointer-events-none absolute bottom-[var(--spacing-system-xsf)] left-[var(--spacing-system-xsf)] z-20 flex max-w-[calc(100%-1rem)] items-center gap-[var(--spacing-system-xsf)] rounded-full bg-ods-overlay py-[var(--spacing-system-xxs)] pl-[var(--spacing-system-xxs)] pr-[var(--spacing-system-sf)] text-h6 text-ods-text-primary">
        {presenterAvatarSrc ? (
          <SquareAvatar src={presenterAvatarSrc} alt="" sizePx={20} variant="round" className="shrink-0 border-0" />
        ) : (
          <VideoPlayBadge size="sm" className="h-5 w-5 shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </span>

      {/* BIG centred glyph — the muted-fallback prompt (bite grammar, 56px bare
          glyph). It IS interactive, but ONLY exists while the card is muted, so
          the two intents never compete: muted → this button unmutes; once
          unmuted it unmounts and the same click lands on the hit layer and
          opens the theater. A bare <button> (not the DS Button, whose base
          forces `[&_svg]:h-5`) so the glyph keeps its 56px size. */}
      {showBigUnmute && (
        <button
          type="button"
          aria-label={controlIsPlay ? 'Play' : 'Unmute'}
          title={controlIsPlay ? 'Play' : 'Unmute'}
          onPointerDown={e => e.stopPropagation()}
          onClick={onUnmuteOrPlay}
          className="absolute inset-0 z-30 m-auto flex h-14 w-14 appearance-none items-center justify-center border-0 bg-transparent p-0 text-ods-text-primary transition-colors hover:text-ods-accent"
        >
          {controlIsPlay ? <VideoPlayBadge /> : <VideoUnmuteGlyph />}
        </button>
      )}

      {/* Transport toggles — mute/unmute + play/pause. Rendered in BOTH states
          (never self-hiding) so every action is reversible.
          CORNER MAP (each control owns exactly one corner, nothing overlaps):
            top-left = transport   top-right = dismiss
            bottom-left = title pill (presenter avatar lives INSIDE it) */}
      {showPlaybackControls && (
        <div className="absolute left-[var(--spacing-system-xsf)] top-[var(--spacing-system-xsf)] z-30 flex items-center gap-[var(--spacing-system-xxs)]">
          {/* Hidden while the big centre glyph owns unmuting, so the two are
              never on screen with the same label and different behaviour. */}
          <Button
            variant="overlay"
            size="icon-sm"
            aria-label={cardMuted ? 'Unmute' : 'Mute'}
            title={cardMuted ? 'Unmute' : 'Mute'}
            onPointerDown={e => e.stopPropagation()}
            onClick={onToggleMute}
            className={cn('h-8 w-8 rounded-full border-0', showBigUnmute && !controlIsPlay && 'hidden')}
          >
            {cardMuted ? <VolumeXmarkIcon /> : <VolumeUpIcon />}
          </Button>
          <Button
            variant="overlay"
            size="icon-sm"
            aria-label={cardPaused ? 'Play' : 'Pause'}
            title={cardPaused ? 'Play' : 'Pause'}
            onPointerDown={e => e.stopPropagation()}
            onClick={onTogglePlay}
            className="h-8 w-8 rounded-full border-0"
          >
            {cardPaused ? <PlayIcon /> : <PauseIcon />}
          </Button>
        </div>
      )}

      {/* dismiss (highest) */}
      {dismissEnabled && (
        <Button
          variant="overlay"
          size="icon-sm"
          aria-label="Dismiss video"
          onPointerDown={pausePreviewNow}
          onClick={dismiss}
          className="absolute right-[var(--spacing-system-xsf)] top-[var(--spacing-system-xsf)] z-40 h-8 w-8 rounded-full border-0"
        >
          <XmarkIcon size={18} />
        </Button>
      )}
    </div>
  );

  return (
    <>
      {showCard && (
        <div className={cn('pointer-events-none fixed bottom-0 left-0 p-[var(--spacing-system-mf)]', WALKTHROUGH_Z)} style={{ paddingBottom: 'max(var(--spacing-system-mf), env(safe-area-inset-bottom))' }}>
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
              // PURE theater: just the video, centered on a dimmed backdrop.
              // No card chrome, no padding, no summary — the 16:9 stage IS the
              // dialog, so nothing competes with the video at any breakpoint.
              'fixed left-1/2 top-1/2 z-[9999] w-[min(92vw,1400px)] max-w-none -translate-x-1/2 -translate-y-1/2',
              'focus:outline-none',
            )}
          >
            <DialogPrimitive.Title className="sr-only">{summaryTitle || 'Walkthrough video'}</DialogPrimitive.Title>
            <Video
              kind={video.youtubeUrl ? 'youtube' : 'file'}
              url={(video.youtubeUrl || video.mainVideoUrl) as string}
              poster={video.posterUrl}
              captionsUrl={video.captionsUrl}
              title={summaryTitle}
              layout="wide"
              startTime={theaterStart.time}
              playerHandleRef={theaterHandleRef}
              // Muted still means PLAYING: without this a deliberately muted
              // card opened a paused theater, breaking parity with the
              // unmuted path.
              autoPlay={theaterStart.muted}
              autoPlayUnmuted={!theaterStart.muted}
              startMuted={theaterStart.muted}
              autoActivate
              suspended={suspended}
              onEnded={() => { endedLatchRef.current = true; }}
            />
            {/* Radix `asChild` so the shared Button IS the close trigger (same
                pattern as every other dialog close in the lib). */}
            <DialogPrimitive.Close asChild>
              <Button
                ref={closeButtonRef}
                variant="overlay"
                size="icon-sm"
                aria-label="Close"
                className="absolute right-[var(--spacing-system-sf)] top-[var(--spacing-system-sf)] z-10 h-9 w-9 rounded-full border-0"
              >
                <XmarkIcon size={20} />
              </Button>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>
    </>
  );
}
