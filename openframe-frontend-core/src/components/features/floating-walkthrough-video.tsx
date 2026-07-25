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
 *   - close: snapshot then pause the theater player (file) / suspend (YouTube).
 *     NOTE: this theater's Content carries no exit animation, so Radix unmounts
 *     it in the same commit and the iframe dies before the suspend postMessage
 *     can run. The suspend path exists for hosts that DO animate the exit; here
 *     the unmount itself is what stops the audio.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '../../utils/cn';
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
  className?: string;
}

/** "Paused at the end" — used by BOTH the close snapshot and the reopen seed,
 *  which must agree or a finished video reopens at its own last frame. */
const isAtEnd = (duration: number, time: number) => duration > 0 && duration - time < 1;

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
    // Wait for the data: on the embedder path `video` starts null, so the
    // dismissal id was 'dismissed' on the first pass and a dismissed card
    // flashed for the length of a second appear-delay before hiding.
    if (!video) return;   // wait for data — see the id-based dep below
    const timer = setTimeout(() => {
      const reveal = () => {
        if (dismissEnabled && isWalkthroughDismissed(storageKey, dismissalId)) {
          setDismissed(true);
          return;
        }
        // Cleared on the way through: a client-only embedder can swap to a NEW
        // video id in-session (the cookie is id-matched, so the new one isn't
        // dismissed), and a sticky `dismissed` kept the card hidden until a
        // full reload — contradicting the id-match behaviour documented above.
        setDismissed(false);
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
    // `video?.id`, not the object: a new identity (embedder refetch, re-seeded
    // RSC payload) would otherwise restart the appear delay.
  }, [appearDelayMs, dismissEnabled, storageKey, dismissalId, video?.id]);

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
  // Why the theater reports its fallback state even though it renders no card
  // control: `blocked`/`muted` distinguish "the user muted this" from "the
  // browser refused sound". Only the former may become standing intent.
  const theaterForcedMuteRef = useRef(false);
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
  // Depends on cardMode too: a player that MOUNTS while the card is already
  // hidden (e.g. the footer scrolled into view during the theater) would
  // otherwise autoplay behind an invisible, pointer-inert card.
  useEffect(() => {
    if (!footerHidden) return;
    const h = resumeHandleRef.current ?? previewHandleRef.current;
    try { h?.pause(); } catch { /* ignore */ }
    setCardPaused(true);
    setHovered(false);
    // `resumeMode`/`hovered` (not the derived cardMode, declared below) are the
    // inputs that decide whether a player is mounted.
  }, [footerHidden, resumeMode, hovered]);

  // Render-synced mirror of the derived `cardMode`, which is declared BELOW
  // the callbacks that need it. Reading state declared later from a memoized
  // callback is the exact trap that made every hover-preview open restart at
  // 0:00 (the closure kept its render-0 value), so this is a ref, not a dep.
  const cardModeRef = useRef<'resume' | 'preview' | 'poster'>('poster');

  // Set by the card's OWN handlers, consumed by the controlled-mode sync
  // below. Without it, a controlled host flipping `open` in response to
  // `onOpenChange` looks identical to a genuinely host-originated open, and
  // the sync clobbers the seed/snapshot the handler just computed.
  const selfDrivenForRef = useRef<boolean | null>(null);

  // Set on every close so the focus Radix restores to the hit layer can't be
  // mistaken for the user tabbing to the card. CONSUMED BY THE FOCUS HANDLER
  // (see commitOpen) — the timer beside it is only a safety valve.
  const justClosedRef = useRef(false);
  const justClosedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitOpen = useCallback((next: boolean) => {
    if (!next) {
      // CONSUMED BY THE FOCUS HANDLER, not by a timer racing Radix.
      // Radix's FocusScope restores focus from its OWN `setTimeout(…, 0)`,
      // registered during cleanup — i.e. AFTER any timer we schedule here.
      // A timer-cleared latch was therefore always false by the time the
      // restore landed, and Escape-close still restarted preview audio.
      // The timer below is only a safety valve for the case where no focus
      // restoration arrives at all (host-driven close, no focus to return).
      justClosedRef.current = true;
      if (justClosedTimerRef.current) clearTimeout(justClosedTimerRef.current);
      justClosedTimerRef.current = setTimeout(() => {
        justClosedTimerRef.current = null;
        justClosedRef.current = false;
      }, 400);
    }
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
    // Captured BEFORE `pausePreviewNow()` below. NOTE this only helps keyboard
    // activation: a mouse click already ran the hit layer's `onPointerDown`
    // pause, so on that path the element IS paused here and the test below
    // still reduces to `liveTime > 0.5`. Kept because Enter/Space dispatches
    // no pointerdown, and there the live playing state is real.
    const handleBeforePause = resumeHandleRef.current ?? previewHandleRef.current;
    const liveWasPlaying = handleBeforePause?.getPaused() === false;
    // Idempotent: keyboard activation (Enter/Space) dispatches no pointerdown,
    // so the synchronous audio-stop guard would otherwise be skipped.
    pausePreviewNow();
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
    // Mode-gated: the card is `position: fixed`, so its preview player is
    // permanently in-viewport and is NEVER unmounted — it keeps currentTime
    // from a hover abandoned minutes ago. Reading it unconditionally made
    // "Play Demo Video" silently start 10s in. Only a LIVE mode may seed.
    const liveHandle =
      resumeHandleRef.current ?? (cardModeRef.current === 'preview' ? previewHandleRef.current : null);
    const liveTime = liveHandle?.getCurrentTime() ?? 0;
    // A preview that ran to completion keeps its currentTime, so without the
    // same at-end guard the close path uses, clicking the card would open the
    // theater seeked to the final frame and it would instantly re-end.
    const liveDuration = liveHandle?.getDuration() ?? 0;
    const liveAtEnd = isAtEnd(liveDuration, liveTime);
    const start = {
      // At end -> start over. Falling back to `handoff.time` here would rewind
      // to an unrelated older anchor (e.g. 3:20) instead of restarting.
      time: liveAtEnd ? 0 : (liveTime > 0.5 ? liveTime : (handoff?.time ?? 0)),
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
        : ((liveHandle && (liveTime > 0.5 || liveWasPlaying))
            ? liveHandle.getMuted()
            : userMutedRef.current),
    };
    setTheaterStart(start);
    setHovered(false);          // force preview inactive
    setSuspended(false);        // reset YouTube suspend for this open
    endedLatchRef.current = false;
    setHandoff(null);           // resume player unmounts
    selfDrivenForRef.current = true;
    commitOpen(true);
  }, [handoff, cardFallback.muted, commitOpen]);

  // Sync for open/close transitions the card did NOT originate — a host
  // driving the controlled `open` prop from its own UI. Card-originated
  // transitions are latched by `selfDrivenRef` and skipped here, because the
  // handler already did the seeding (and a controlled host flips `open` in
  // RESPONSE to that handler, which is indistinguishable from a host-driven
  // change without the latch). `defaultOpen` is NOT covered: it is the
  // uncontrolled initial value, and the initial `theaterStart` already equals
  // what this seed would compute. This MUST run during the
  // render that flips `open` — not in an effect: the Dialog's Content (and
  // therefore MuxPlayer) mounts in that same render, and `startTime` /
  // `autoPlay` / `startMuted` are LOAD-TIME props read once at construction.
  // An effect commits one render too late, so the player would already have
  // been built from the previous `theaterStart` and a stale `suspended`
  // would post `pauseVideo` at mount. This is React's documented
  // "adjust state while rendering" pattern; the extra render is discarded
  // before children are committed.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    // Compared, not cleared: React can discard and re-run a render attempt
    // (concurrent interruption, error retry, a host wrapping setOpen in
    // startTransition). A read-and-clear would decide differently on the
    // retry; an equality test gives the same answer every time.
    const selfDriven = selfDrivenForRef.current === open;
    if (openProp !== undefined && !selfDriven) {
      if (open) {
        // A host open has no originating gesture, but resume mode DOES have a
        // live element — reading only `handoff` discarded however long the mini
        // player had been running since the close. Mirrors openTheater's seed.
        const liveResume = resumeHandleRef.current;
        const liveTime = liveResume?.getCurrentTime() ?? 0;
        const liveAtEnd = isAtEnd(liveResume?.getDuration() ?? 0, liveTime);
        setTheaterStart({
          time: liveAtEnd ? 0 : (liveTime > 0.5 ? liveTime : (handoff?.time ?? 0)),
          muted: liveResume && liveTime > 0.5 ? liveResume.getMuted() : userMutedRef.current,
        });
        setHovered(false);
        setSuspended(false);
        endedLatchRef.current = false;
        setHandoff(null);
      } else {
        // Falling edge: the host bypassed handleOpenChange, so without this the
        // position, the mute intent and the ended state are all simply lost.
        const h = theaterHandleRef.current;
        if (h && !isYouTube) {
          const time = h.getCurrentTime();
          const muted = h.getMuted();
          const paused = h.getPaused();
          const atEnd = isAtEnd(h.getDuration(), time);
          try { h.pause(); } catch { /* already gone */ }
          if (!(muted && theaterForcedMuteRef.current && !userMutedRef.current)) {
            userMutedRef.current = muted;
            setUserMuted(muted);
          }
          setHandoff(
            (endedLatchRef.current && paused && atEnd) || time < 1
              ? null
              : { time, muted, playing: !paused },
          );
        } else if (isYouTube) {
          setSuspended(true);
        }
      }
    }
  }

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) { openTheater(); return; }
    // This close IS the card's own — a controlled host will flip `open` in
    // response, and the sync above must not re-snapshot the player we are
    // about to pause (it would read paused=true and downgrade a playing
    // handoff to paused).
    selfDrivenForRef.current = false;
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
      // EXCEPT when the element is muted only because unmuted autoplay was
      // rejected: promoting that into intent silently muted every later hover
      // preview and every later theater open, for the whole session, with no
      // gesture from the user. Mirrors the same test `openTheater` already
      // applies in the opposite direction.
      const policyForcedMute = muted && theaterForcedMuteRef.current && !userMutedRef.current;
      if (!policyForcedMute) {
        userMutedRef.current = muted;
        setUserMuted(muted);
      }
      const paused = h.getPaused();
      const duration = h.getDuration();
      const atEnd = isAtEnd(duration, time);
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
  }, [isYouTube, commitOpen, openTheater]);

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
    // Read the LIVE element, never `cardMuted`: the two diverge whenever the
    // player's own chrome changed mute without telling us. (`getMuted()`
    // returns `false` rather than nullish on a torn-down element, so a `??`
    // fallback here would silently invert the button — hence the null guard
    // above rather than a default.)
    const next = !h.getMuted();
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
      // Same predicate the label renders from (`controlIsPlay`). Branching on
      // raw `cardPaused` meant that in the blocked state the button read "Play"
      // but took the pause branch, so the first press did nothing.
      if (cardFallback.blocked || cardPaused) { void h.play(); setCardPaused(false); }
      else { h.pause(); setCardPaused(true); }
    } catch { /* ignore */ }
  }, [resumeMode, cardFallback.blocked, cardPaused]);

  const summaryTitle = video?.title || undefined;

  // Already proxied by the host (the hub's DAL applies the prefix AND its
  // skip-list). Threading a prefix through the widget meant each host restated
  // it and silently dropped the skip-list.
  const presenterAvatarSrc = video?.presenterAvatarUrl ?? null;

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
  cardModeRef.current = cardMode;

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
      // Keyboard intent only. Chrome focuses buttons on click, so a raw focus
      // mirror autostarted an unmuted preview with the pointer nowhere near
      // the card. `:focus-visible` alone is NOT enough: Radix restores focus
      // to the hit layer on close, and after an Escape-close that restored
      // focus IS :focus-visible — the guard admitted precisely the case it was
      // written to block, so closing with Escape restarted audio in the
      // corner. Hence the explicit just-closed latch.
      onFocusCapture={e => {
        const el = e.target as HTMLElement;
        // `matches` THROWS SyntaxError on engines that don't know
        // :focus-visible (Safari < 15.4) — that would escape a React handler.
        let keyboard = false;
        try { keyboard = el.matches?.(':focus-visible') ?? false; } catch { keyboard = false; }
        // Consume the latch: the FIRST focus after a close is Radix returning
        // focus to this element, never the user arriving at it.
        if (justClosedRef.current) {
          justClosedRef.current = false;
          if (justClosedTimerRef.current) {
            clearTimeout(justClosedTimerRef.current);
            justClosedTimerRef.current = null;
          }
          return;
        }
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
          // `!footerHidden`: mounting with autoplay and pausing in an effect
          // loses to MuxPlayer re-issuing play when media is ready, which left
          // audio running behind an invisible, pointer-inert card.
          autoPlay={cardMode === 'resume' && handoff?.playing !== false && !footerHidden}
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
      <span className="pointer-events-none absolute bottom-[var(--spacing-system-xsf)] left-[var(--spacing-system-xsf)] z-20 flex max-w-[calc(100%-2*var(--spacing-system-xsf))] items-center gap-[var(--spacing-system-xsf)] rounded-full bg-ods-overlay py-[var(--spacing-system-xxs)] pl-[var(--spacing-system-xxs)] pr-[var(--spacing-system-sf)] text-h6 text-ods-text-primary">
        {presenterAvatarSrc ? (
          <SquareAvatar src={presenterAvatarSrc} alt="" sizePx={20} variant="round" className="shrink-0 border-0" />
        ) : (
          <VideoPlayBadge size="sm" className="h-5 w-5 shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </span>

      {/* BIG centred glyph — the muted-fallback prompt (bite grammar). It IS
          interactive, but ONLY exists while the card is muted, so the two
          intents never compete: muted → this button unmutes; once unmuted it
          unmounts and the same click lands on the hit layer and opens the
          theater. `size="icon-glyph"` keeps the glyph at its own 56px instead
          of the DS default `[&_svg]:h-5`; `variant="glyph"` means no button
          surface paints behind a glyph that already carries its own scrim. */}
      {showBigUnmute && (
        <Button
          variant="glyph"
          size="icon-glyph"
          aria-label={controlIsPlay ? 'Play' : 'Unmute'}
          title={controlIsPlay ? 'Play' : 'Unmute'}
          onPointerDown={e => e.stopPropagation()}
          onClick={onUnmuteOrPlay}
          className="absolute inset-0 z-30 m-auto"
        >
          {controlIsPlay ? <VideoPlayBadge /> : <VideoUnmuteGlyph />}
        </Button>
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
            className={cn(showBigUnmute && !controlIsPlay && 'hidden')}
          >
            {cardMuted ? <VolumeXmarkIcon /> : <VolumeUpIcon />}
          </Button>
          <Button
            variant="overlay"
            size="icon-sm"
            aria-label={controlIsPlay ? 'Play' : 'Pause'}
            title={controlIsPlay ? 'Play' : 'Pause'}
            onPointerDown={e => e.stopPropagation()}
            onClick={onTogglePlay}
          >
            {controlIsPlay ? <PlayIcon /> : <PauseIcon />}
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
          className="absolute right-[var(--spacing-system-xsf)] top-[var(--spacing-system-xsf)] z-40"
        >
          <XmarkIcon />
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
              // `158svh` is the width at which a 16:9 stage is exactly 89svh
              // tall, so the height bound is expressed as a WIDTH cap — the
              // stage keeps its aspect ratio and simply gets narrower on short
              // viewports, instead of overflowing a fixed centred box that
              // clips equally off the top and bottom (which put the close
              // button off-screen on 1366x768 laptops and landscape phones).
              // Two declarations on purpose: an engine without `svh` (Safari
              // < 15.4) treats the whole min() as invalid, and on a `fixed`
              // element that falls back to width:auto and the stage collapses.
              // The first rule is the safe floor; the second wins where svh
              // parses.
              'fixed left-1/2 top-1/2 z-[9999] max-w-none -translate-x-1/2 -translate-y-1/2',
              'w-[min(92vw,1400px)] w-[min(92vw,1400px,158svh)]',
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
              onMutedFallbackChange={st => { theaterForcedMuteRef.current = st.muted; }}
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
                className="absolute right-[var(--spacing-system-sf)] top-[var(--spacing-system-sf)] z-10"
              >
                <XmarkIcon />
              </Button>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>
    </>
  );
}
