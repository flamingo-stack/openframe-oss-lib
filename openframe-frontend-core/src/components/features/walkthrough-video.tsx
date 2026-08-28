'use client';

/**
 * THE generic, embeddable per-platform demo-video widget, in the two placements
 * hosts actually mount: <FloatingWalkthroughVideo> and <InlineWalkthroughVideo>.
 *
 * SHARED GRAMMAR. A collapsed card (bite-identical hover grammar via
 * <VideoHoverPreviewSurface>) that opens a large in-page theater (Radix Dialog
 * primitives, NOT native fullscreen) showing ONLY the video: a bare 16:9 stage
 * with the player's own controls + captions. No card chrome, no summary.
 *   - FLOATING pins that card to a bottom corner over the page — left unless
 *     the video data says `position: 'right'`.
 *   - INLINE lays it out in the host's own flow, filling its container at 16:9.
 *     Every overlay-only behaviour drops out with the pinning: no fixed
 *     positioning, no z-layer, no shadow, no appear delay (nothing to stagger
 *     against an already-painted page), no footer fade (no footer to collide
 *     with) and no dismissal (an X is an overlay's "get out of my way"; in a
 *     host's own layout it just leaves a hole, and the cookie is per-platform,
 *     so one dismissal in the corner would silently empty the in-page block).
 *
 * ONE ENGINE, TWO PRESETS. <WalkthroughVideo> below takes `placement` and is
 * deliberately NOT exported: placement is a constant at every call site, so the
 * public API is two components that say what they are instead of one that takes
 * a mode — a <FloatingWalkthroughVideo placement="inline"> reads as a
 * contradiction, and naming a family after one of its variants is what produced
 * it. The presets are one line each; everything below the wrapper — the player
 * mode machine, the audio invariant, the corner map, dismissal — stays shared,
 * because forking THAT is how the two placements would drift.
 *
 * The split pays off in the types: the overlay-only knobs are absent from
 * `InlineWalkthroughVideoProps` outright, so "floating only" is a compile error
 * rather than a line of prose each caller has to read.
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
 *     NOTE: Radix wraps Portal and Content in `Presence`, which dispatches
 *     UNMOUNT from its OWN layout effect — so the Content survives one extra
 *     render after `open` flips false, even with no exit animation. That extra
 *     render is what makes the falling-edge `useLayoutEffect` below safe: the
 *     theater player is still mounted when it runs. (An earlier version of this
 *     note claimed the unmount happens in the same commit; it does not, and
 *     that mistake is what produced a since-deleted 37-finding lint exemption.)
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import type React from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useIsHydrated } from '../../hooks/ui/use-is-hydrated';
import { cn } from '../../utils/cn';
import {
  WALKTHROUGH_VIDEO_DISMISS_KEY,
  isWalkthroughDismissed,
  dismissWalkthrough,
} from '../../utils/dismissal-storage';
import { WALKTHROUGH_OPEN_QUERY_PARAM } from '../../utils/walkthrough-deep-link';
import { VolumeUpIcon } from '../icons-v2-generated/audio-and-visual/volume-up-icon';
import { VolumeXmarkIcon } from '../icons-v2-generated/audio-and-visual/volume-xmark-icon';
import { PauseIcon } from '../icons-v2-generated/media-playback/pause-icon';
import { PlayIcon } from '../icons-v2-generated/media-playback/play-icon';
import { XmarkIcon } from '../icons-v2-generated/signs-and-symbols/xmark-icon';
import { Button } from '../ui/button';
import { DialogPortal, DialogOverlay } from '../ui/dialog';
import { SquareAvatar } from '../ui/square-avatar';
import { CardHitLayer } from './card-hit-layer';
import { Video, type VideoPlayerHandle, type VideoMutedFallbackState } from './video';
import { VideoPlayBadge, VideoUnmuteGlyph } from './video-center-badge';
import { VideoHoverPreviewSurface } from './video-hover-preview';

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
  /** Which bottom corner the collapsed card pins to. Admin-controlled per
   *  video; anything other than 'right' (including absent) means left. */
  position?: 'left' | 'right' | null;
}

/** Everything the two placements share — the widget's actual contract. */
interface WalkthroughVideoBaseProps {
  video: WalkthroughVideoData | null | undefined;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  /** With `defaultOpen`: the initial theater starts PAUSED instead of
   *  autoplaying — for deep links (`?walkthrough=1`), where the open has no
   *  user gesture and unrequested audio/motion would be hostile. Applies to
   *  the initial `defaultOpen` session only: it ends when the NEXT open —
   *  gesture-driven (card click) or host-driven (`open` flipping true) —
   *  mounts a fresh theater, which autoplays as usual. */
  defaultOpenPaused?: boolean;
  /** Query-param NAME that deep-links into the theater: when present in
   *  `window.location.search` at first client render, the theater opens
   *  immediately and PAUSED — `defaultOpen + defaultOpenPaused` decided
   *  inside the component, so hosts don't defer their first render to read
   *  the URL. Defaults to `WALKTHROUGH_OPEN_QUERY_PARAM` ('walkthrough');
   *  pass '' to disable. Presence-based (any value counts), read ONCE at
   *  mount (deep links arrive by full page load, not client navigation).
   *  SSR-safe: the server renders closed, and the theater lives in a portal,
   *  so the hydrated (non-portal) markup is identical either way. */
  deepLinkParam?: string;
  label?: string;
  className?: string;
}

/**
 * <FloatingWalkthroughVideo>: the shared contract plus the knobs that only mean
 * something for an OVERLAY. Each of these is inert inline — the appear delay
 * staggers against a page the visitor hasn't seen yet, dismissal is an overlay
 * affordance, and the footer fade (with the `pathname` that re-queries its
 * target) exists to keep a pinned card off the page chrome. So they live here,
 * not in the base.
 */
export interface FloatingWalkthroughVideoProps extends WalkthroughVideoBaseProps {
  appearDelayMs?: number;
  /** Cookie-based dismissal (id-match, mirrors the announcement bar). `false`
   *  disables the X entirely. `storageKey` is the per-platform cookie name. */
  dismissal?: { storageKey?: string } | false;
  /** Fades the card out while `hideNearSelector` is in view. */
  hideNearSelector?: string;
  /** Route identity from the host (the lib can't observe navigation). Changing
   *  it re-queries the footer IO target. */
  pathname?: string;
}

/** <InlineWalkthroughVideo>: the shared contract and nothing else — see above. */
export type InlineWalkthroughVideoProps = WalkthroughVideoBaseProps;

/** Engine props. Internal: `placement` never reaches a call site. */
type WalkthroughVideoProps = FloatingWalkthroughVideoProps & { placement: 'floating' | 'inline' };

/** "Paused at the end" — used by BOTH the close snapshot and the reopen seed,
 *  which must agree or a finished video reopens at its own last frame. */
const isAtEnd = (duration: number, time: number) => duration > 0 && duration - time < 1;

/** The theater's load-time seed, computed from whatever card player is LIVE.
 *  Pure and module-scope on purpose: the only reader is the host-open sync,
 *  which runs during render (see there for why it cannot be an effect), and a
 *  helper keeps that block down to a single ref read instead of six. */
function theaterSeedFromLive(
  live: VideoPlayerHandle | null,
  fallbackTime: number,
  fallbackMuted: boolean,
): { time: number; muted: boolean } {
  const time = live?.getCurrentTime() ?? 0;
  const atEnd = isAtEnd(live?.getDuration() ?? 0, time);
  return {
    // At end -> start over, never rewind to an unrelated older anchor.
    time: atEnd ? 0 : time > 0.5 ? time : fallbackTime,
    // Trust the live element only when it has actually been playing; a
    // freshly remounted poster-mode player reports muted=false and would
    // silently discard the user's last explicit mute.
    muted: live && time > 0.5 ? live.getMuted() : fallbackMuted,
  };
}

const WALKTHROUGH_Z = 'z-[9980]'; // one layer BELOW the chat dock (z-[9990]).

interface Handoff {
  time: number;
  muted: boolean;
  playing: boolean;
}

function WalkthroughVideo({
  video,
  open: openProp,
  onOpenChange,
  defaultOpen,
  defaultOpenPaused,
  deepLinkParam = WALKTHROUGH_OPEN_QUERY_PARAM,
  label = 'Play Demo Video',
  placement,
  // Keeps the FLOATING card off the critical path. The inline preset passes 0:
  // an in-page block is part of a page the visitor is already looking at, so
  // staggering it in would only jump the layout.
  appearDelayMs = 3000,
  dismissal = {},
  hideNearSelector = 'footer',
  pathname,
  className,
}: WalkthroughVideoProps): React.ReactElement | null {
  const inline = placement === 'inline';
  const dismissEnabled = dismissal !== false;
  const storageKey = (dismissEnabled && dismissal.storageKey) || WALKTHROUGH_VIDEO_DISMISS_KEY;
  // id-match dismissal key: a new video (new id) re-shows the card. No id
  // (embedder) → a stable presence marker so dismissal still works.
  const dismissalId = video?.id != null ? String(video.id) : 'dismissed';

  // --- mount gate (never LCP; cookie read happens post-delay, no hydration mismatch) ---
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hasVideo = video != null;
  const videoId = video?.id;
  useEffect(() => {
    let idleHandle: number | null = null;
    // Wait for the data: on the embedder path `video` starts null, so the
    // dismissal id was 'dismissed' on the first pass and a dismissed card
    // flashed for the length of a second appear-delay before hiding.
    if (!hasVideo) return undefined; // wait for data — see the id-based dep below
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
    // `videoId`, not the object: a new identity (embedder refetch, re-seeded
    // RSC payload) would otherwise restart the appear delay.
  }, [appearDelayMs, dismissEnabled, storageKey, dismissalId, hasVideo, videoId]);

  // --- environment preferences (read after hydration; no SSR access) ---
  // Derived, not stored: both inputs are plain reads of the environment, and
  // the only reason they could not happen during render was that neither exists
  // on the server. `useIsHydrated` states exactly that gate, so the answer is
  // available in the first render that can act on it instead of arriving a
  // commit later — the commit in which a reduced-motion visitor had already
  // been handed a hoverable preview.
  const hydrated = useIsHydrated();
  const previewSuppressed = useMemo(() => {
    if (!hydrated) return false;
    try {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      const saveData = conn?.saveData === true || conn?.effectiveType === '2g' || conn?.effectiveType === 'slow-2g';
      return Boolean(reducedMotion || saveData);
    } catch {
      return false;
    }
  }, [hydrated]);

  // --- controlled/uncontrolled open ---
  // Deep link: read ONCE, synchronously, on the first client render — the
  // theater's autoplay props are load-time, so the decision must exist before
  // the render that mounts it (an effect would be one commit too late). The
  // lazy initializer never re-runs, so client navigation can't re-trigger it.
  const [deepLinkHit] = useState(() => {
    if (!deepLinkParam || typeof window === 'undefined') return false;
    try {
      return new URLSearchParams(window.location.search).has(deepLinkParam);
    } catch {
      return false;
    }
  });
  const [openState, setOpenState] = useState(Boolean(defaultOpen) || deepLinkHit);
  const open = openProp !== undefined ? openProp : openState;
  // The paused deep-link session — see `defaultOpenPaused`. Load-time-safe:
  // the theater player's autoplay props are read once at construction, and
  // this is set before the first render that mounts it. Cleared on the next
  // OPEN transition only (the prevOpen sync below), right before a fresh
  // theater constructs — never on close, where the closing player is still
  // mounted and a prop flip would restart it (see the sync's comment).
  const [pausedOpenSession, setPausedOpenSession] = useState(Boolean(defaultOpen && defaultOpenPaused) || deepLinkHit);

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
  const [footerObservation, setFooterObservation] = useState<{ key: string; hidden: boolean } | null>(null);
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
  // The observation is TAGGED with the conditions it was made under, and the
  // flag is derived by comparing that tag to the current ones. That is what
  // removes the three `setFooterHidden(false)` resets the effect used to
  // perform — each of them a synchronous setState in an effect body — and it
  // covers a case they did not: an observation left over from a selector that
  // has since stopped matching now expires instead of pinning the card hidden.
  const footerFadeKey = `${mounted ? 1 : 0}|${inline ? 1 : 0}|${hideNearSelector}|${pathname}`;
  const footerHidden = footerObservation?.key === footerFadeKey && footerObservation.hidden;
  useEffect(() => {
    if (!mounted) return undefined;
    // An inline card scrolls WITH the page — fading it out over the footer
    // would blank the very block the visitor scrolled down to.
    if (inline) return undefined;
    const el = typeof document !== 'undefined' ? document.querySelector(hideNearSelector) : null;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      entries => setFooterObservation({ key: footerFadeKey, hidden: entries[0]?.isIntersecting ?? false }),
      { rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mounted, inline, hideNearSelector, pathname, footerFadeKey]);

  // --- tab-hidden: pause resume-mode playback, keep the timestamp ---
  useEffect(() => {
    if (!resumeMode) return undefined;
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
  // The two STATE halves are adjusted while rendering: behind the footer the
  // card is pointer-inert, so "paused" and "not hovered" are simply what being
  // hidden MEANS. Both are guarded on the state they write, so the render pass
  // React schedules for them takes the early exit — and doing it here means the
  // transport toggles never commit a frame reading "playing" over a card the
  // visitor cannot reach.
  if (footerHidden && !cardPaused) setCardPaused(true);
  if (footerHidden && hovered) setHovered(false);

  useEffect(() => {
    if (!footerHidden) return;
    const h = resumeHandleRef.current ?? previewHandleRef.current;
    try {
      h?.pause();
    } catch {
      /* ignore */
    }
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
  //
  // STATE, not a ref: the sync's rising edge has to read it during render, and
  // it is a plain "which transition did I originate" latch, not an imperative
  // handle. Every write is an event handler that flips `open` in the same
  // batch, so the value is always committed by the render that observes it.
  // Compared, never cleared — a discarded render attempt decides identically.
  const [selfDrivenFor, setSelfDrivenFor] = useState<boolean | null>(null);

  // Set on every close so the focus Radix restores to the hit layer can't be
  // mistaken for the user tabbing to the card. CONSUMED BY THE FOCUS HANDLER
  // (see commitOpen) — the timer beside it is only a safety valve.
  const justClosedRef = useRef(false);
  const justClosedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitOpen = useCallback(
    (next: boolean) => {
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
    },
    [openProp, onOpenChange],
  );

  // Synchronous preview pause on pointerdown — the window-capture activation
  // waiter unmutes a pre-activation preview on the first pointerdown; without
  // this the opening/dismissing press itself blips at 50% volume.
  const pausePreviewNow = useCallback(() => {
    // Whichever player is live — in resume mode that is the continuation
    // player, so pausing only the preview left a playing card audible through
    // the whole pointerdown -> click -> commit window.
    const h = resumeHandleRef.current ?? previewHandleRef.current;
    try {
      h?.pause();
    } catch {
      /* ignore */
    }
    // Keep the toggle honest: an aborted press (pointerdown then drag away)
    // otherwise left it reading "Pause" over a paused video.
    setCardPaused(true);
  }, [setCardPaused]);

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
    const liveHandle = resumeHandleRef.current ?? (cardModeRef.current === 'preview' ? previewHandleRef.current : null);
    const liveTime = liveHandle?.getCurrentTime() ?? 0;
    // A preview that ran to completion keeps its currentTime, so without the
    // same at-end guard the close path uses, clicking the card would open the
    // theater seeked to the final frame and it would instantly re-end.
    const liveDuration = liveHandle?.getDuration() ?? 0;
    const liveAtEnd = isAtEnd(liveDuration, liveTime);
    const start = {
      // At end -> start over. Falling back to `handoff.time` here would rewind
      // to an unrelated older anchor (e.g. 3:20) instead of restarting.
      time: liveAtEnd ? 0 : liveTime > 0.5 ? liveTime : (handoff?.time ?? 0),
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
      muted:
        cardFallback.muted && !userMutedRef.current
          ? false
          : liveHandle && (liveTime > 0.5 || liveWasPlaying)
            ? liveHandle.getMuted()
            : userMutedRef.current,
    };
    setTheaterStart(start);
    setHovered(false); // force preview inactive
    setSuspended(false); // reset YouTube suspend for this open
    endedLatchRef.current = false;
    setHandoff(null); // resume player unmounts
    setSelfDrivenFor(true);
    commitOpen(true);
  }, [handoff, cardFallback.muted, commitOpen, pausePreviewNow, setHovered, setSuspended, setHandoff]);

  // Sync for open/close transitions the card did NOT originate — a host
  // driving the controlled `open` prop from its own UI. Card-originated
  // transitions are latched by `selfDrivenFor` and skipped here, because the
  // handler already did the seeding (and a controlled host flips `open` in
  // RESPONSE to that handler, which is indistinguishable from a host-driven
  // change without the latch). `defaultOpen` is NOT covered: it is the
  // uncontrolled initial value, and the initial `theaterStart` already equals
  // what this seed would compute.
  //
  // WHY THE RISING EDGE IS STILL IN RENDER (it is NOT about load-time props —
  // that argument was tested and is false): the theater's Content is behind
  // Radix `Presence`, which starts `unmounted` and only dispatches MOUNT from
  // its own layout effect, so MuxPlayer is constructed one render AFTER the
  // flip either way — a `useLayoutEffect` seeds it just as early (measured).
  // The real constraint is the SOURCE: `resumeMode` collapses in this very
  // render, so `VideoHoverPreviewSurface` re-keys its inner <Video> and the
  // resume player is destroyed in this commit. Its `useImperativeHandle`
  // cleanup nulls `resumeHandleRef` in the mutation phase, i.e. BEFORE any
  // layout effect here can run. Render is the last point at which the live
  // mini-player is readable at all — everything that does NOT read it moved
  // to `useLayoutEffect` below.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    // RISING edge only: the paused deep-link session ends when the NEXT
    // (gesture- or host-driven) open mounts a fresh theater — this re-render
    // commits the cleared flag before that content constructs, so it
    // autoplays as usual. NEVER clear on close: Radix keeps the closing
    // theater mounted through its exit animation, and flipping the flag then
    // flips `autoPlayUnmuted` false→true on the STILL-MOUNTED player, whose
    // autoplay kick effect resurrects playback — audible after close and
    // doubled against the card's resume player. Idempotent, so a
    // discarded-and-retried render attempt decides the same way.
    if (open && pausedOpenSession) setPausedOpenSession(false);
    // Compared, not cleared: React can discard and re-run a render attempt
    // (concurrent interruption, error retry, a host wrapping setOpen in
    // startTransition). A read-and-clear would decide differently on the
    // retry; an equality test gives the same answer every time.
    const selfDriven = selfDrivenFor === open;
    if (openProp !== undefined && !selfDriven) {
      if (open) {
        // A host open has no originating gesture, but resume mode DOES have a
        // live element — reading only `handoff` discarded however long the mini
        // player had been running since the close. Mirrors openTheater's seed.
        // `userMuted` (state), not `userMutedRef`: the two are kept in lockstep
        // and a ref must not be read during render.
        setTheaterStart(theaterSeedFromLive(resumeHandleRef.current, handoff?.time ?? 0, userMuted));
        setHovered(false);
        setSuspended(false);
        setHandoff(null);
      } else if (isYouTube) {
        // The file theater's falling edge needs the live player and lives in
        // the layout effect below; YouTube only flips a flag, so it stays here
        // where the still-mounted iframe sees it in this same commit.
        setSuspended(true);
      }
    }
  }

  // The half of the host-driven sync that does NOT have to be in render.
  // `useLayoutEffect`, not `useEffect`: on the falling edge the theater player
  // is still mounted during this commit (Radix `Presence` only dispatches
  // UNMOUNT from its own layout effect, so the Content is torn down in the
  // NEXT render) — a passive effect would run after that teardown and the
  // snapshot would read a dead handle. Verified, not assumed.
  //
  // Its own ref latch rather than `prevOpen`: that state has already been
  // advanced by the render above by the time this runs. Both latches compare
  // rather than clear, so a discarded render attempt changes nothing.
  const prevOpenCommittedRef = useRef(open);
  useLayoutEffect(() => {
    if (prevOpenCommittedRef.current === open) return;
    prevOpenCommittedRef.current = open;
    if (open) {
      // Cleared before the theater Content is constructed (next render), so
      // `onEnded` from the previous session can never leak into this one.
      // Out of render because a ref write is a side effect: a discarded
      // render attempt used to clear a latch for a session never committed.
      // Unconditional (not gated on `selfDriven` the way the seed is): every
      // other rising edge already cleared it in `openTheater`, so this is a
      // no-op there rather than a second policy.
      endedLatchRef.current = false;
      return;
    }
    if (openProp === undefined || selfDrivenFor === open || isYouTube) return;
    // Falling edge: the host bypassed handleOpenChange, so without this the
    // position, the mute intent and the ended state are all simply lost.
    const h = theaterHandleRef.current;
    if (!h) return;
    const time = h.getCurrentTime();
    const muted = h.getMuted();
    const paused = h.getPaused();
    const atEnd = isAtEnd(h.getDuration(), time);
    try {
      h.pause();
    } catch {
      /* already gone */
    }
    if (!(muted && theaterForcedMuteRef.current && !userMutedRef.current)) {
      userMutedRef.current = muted;
      setUserMuted(muted);
    }
    setHandoff((endedLatchRef.current && paused && atEnd) || time < 1 ? null : { time, muted, playing: !paused });
    // `selfDrivenFor` is a dep only so the closure is current; a change to it
    // alone cannot re-run the body — the latch above takes the early exit.
  }, [open, openProp, isYouTube, selfDrivenFor, setHandoff]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        openTheater();
        return;
      }
      // This close IS the card's own — a controlled host will flip `open` in
      // response, and the sync above must not re-snapshot the player we are
      // about to pause (it would read paused=true and downgrade a playing
      // handoff to paused).
      setSelfDrivenFor(false);
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
          setHandoff(null); // finished — plain poster, no continuation
        } else if (time < 1) {
          setHandoff(null); // degenerate close — keep hover preview enabled
        } else {
          setHandoff({ time, muted, playing: false });
        }
      }
      commitOpen(false);
    },
    [isYouTube, commitOpen, openTheater],
  );

  const onCardFallbackChange = useCallback(
    (s: VideoMutedFallbackState) => {
      setCardFallback(s);
      setCardMuted(s.muted); // sync the toggle with fallback / chrome unmutes
    },
    [setCardFallback, setCardMuted],
  );

  // Seed transport state whenever a card player (re)starts. Reads the handoff
  // through a ref: it is the value AT START, and as a dependency it would
  // re-seed the toggles every time the host refreshed the object mid-playback.
  const handoffRef = useRef(handoff);
  useEffect(() => {
    handoffRef.current = handoff;
  });
  useEffect(() => {
    if (resumeMode) {
      setCardMuted(handoffRef.current?.muted ?? false);
      setCardPaused(handoffRef.current?.playing === false);
    }
  }, [resumeMode]);
  // A fresh hover starts a fresh preview — clear the paused flag, and re-seed
  // the mute toggle from the user's standing intent so an explicit mute is not
  // silently undone by the hover-start path (which unmutes the element).
  //
  // Adjusted while rendering rather than from an effect, so the toggles are
  // already correct in the render that mounts the preview player instead of
  // being corrected on the pass after it. Reads the `userMuted` STATE, not
  // `userMutedRef` — a ref must not be read during render, and the two are kept
  // in lockstep (every write to the ref sets the state on the next line).
  const [hoverSeeded, setHoverSeeded] = useState(hovered);
  if (hoverSeeded !== hovered) {
    setHoverSeeded(hovered);
    if (hovered) {
      setCardPaused(false);
      setCardMuted(userMuted);
    }
  }

  const dismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      pausePreviewNow();
      if (dismissEnabled) dismissWalkthrough(storageKey, dismissalId);
      setDismissed(true);
    },
    [dismissEnabled, storageKey, dismissalId, pausePreviewNow],
  );

  // Card controls act on whichever player is live (resume continuation or the
  // hover preview). The internal glyph is unreachable under the activation
  // overlay (hideMutedBadge), so these are the only affordances.
  const activeHandle = useCallback(
    () => (resumeMode ? resumeHandleRef.current : previewHandleRef.current),
    [resumeMode],
  );

  /** Big centered glyph — the muted-fallback prompt (unmute, or play when even
   *  muted autoplay was blocked). Unchanged bite grammar. */
  const onUnmuteOrPlay = useCallback(
    (e: React.MouseEvent) => {
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
      } catch {
        /* ignore */
      }
    },
    [cardFallback.blocked, cardPaused, activeHandle, setCardPaused, setCardMuted, setUserMuted],
  );

  /** Mute TOGGLE — stays on screen in both states so the user can come back. */
  const onToggleMute = useCallback(
    (e: React.MouseEvent) => {
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
        if (!next && !cardPaused) void h.play(); // never override an explicit pause
        setCardMuted(next);
        userMutedRef.current = next;
        setUserMuted(next);
      } catch {
        /* ignore */
      }
    },
    [cardPaused, activeHandle, setCardMuted, setUserMuted],
  );

  /** Play/pause TOGGLE. Deliberately does NOT tear down the resume player
   *  (an earlier version cleared the handoff, which unmounted the mini player
   *  and made the controls vanish with no way back). */
  const onTogglePlay = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      const h = activeHandle();
      if (!h) return;
      try {
        // Same predicate the label renders from (`controlIsPlay`). Branching on
        // raw `cardPaused` meant that in the blocked state the button read "Play"
        // but took the pause branch, so the first press did nothing.
        if (cardFallback.blocked || cardPaused) {
          void h.play();
          setCardPaused(false);
        } else {
          h.pause();
          setCardPaused(true);
        }
      } catch {
        /* ignore */
      }
    },
    [cardFallback.blocked, cardPaused, activeHandle, setCardPaused],
  );

  const summaryTitle = video?.title || undefined;

  // Already proxied by the host (the hub's DAL applies the prefix AND its
  // skip-list). Threading a prefix through the widget meant each host restated
  // it and silently dropped the skip-list.
  const presenterAvatarSrc = video?.presenterAvatarUrl ?? null;

  const embedUrlKey = useMemo(
    () => `${video?.mainVideoUrl ?? ''}|${video?.youtubeUrl ?? ''}`,
    [video?.mainVideoUrl, video?.youtubeUrl],
  );

  // Gate on `!resumeMode`, NOT `!handoff`: a non-playing handoff is only a
  // remembered timestamp. Gating on `handoff` froze the card as an inert poster
  // after closing a paused theater (no hover preview, no transport, no way back
  // except reopening) for the rest of the session.
  const cardActive = !open && previewAllowed && hovered && !resumeMode;

  // ONE derived mode drives every branch below. Deriving a single discriminant
  // (instead of testing raw booleans at each call site) is what keeps the card
  // consistent: 'resume' and 'preview' are mutually exclusive by construction,
  // so a player can never be half-mounted or a control half-shown. Derived
  // ABOVE the early return so the latest-ref effect below it stays
  // unconditional.
  const cardMode: 'resume' | 'preview' | 'poster' = resumeMode ? 'resume' : cardActive ? 'preview' : 'poster';

  // Latest-ref mirror of `cardMode`, read only by `openTheater` (an event
  // handler) to decide which live player it is handing off from. Refreshed in
  // an unconditional effect rather than assigned during render: a render
  // attempt React discards (concurrent interruption, error retry) must not
  // leave the ref describing a card layout that was never committed, or the
  // next click would hand off from a player that is not on screen.
  useEffect(() => {
    cardModeRef.current = cardMode;
  });

  if (!video || (!video.mainVideoUrl && !video.youtubeUrl)) return null;

  // The collapsed card is suppressed by the appear-delay mount gate and by
  // dismissal — but the THEATER (Dialog) is NOT. A host that controls
  // `open={true}` must be able to force the theater even before the card has
  // appeared or after it was dismissed, so the gate lives on the card only.
  const showCard = mounted && !dismissed;

  // `cardMode === 'resume'` is exactly `resumeMode`, which already required
  // `handoff !== null` — but the derived string discriminant carries none of
  // that for the compiler. Re-derive the handoff once so the resume props
  // below read it directly instead of asserting it back into existence.
  const resumeHandoff = resumeMode ? handoff : null;

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
        'group/card pointer-events-auto relative overflow-hidden rounded-md border border-ods-border bg-ods-card',
        // The lift is what separates a FLOATING card from the page beneath it;
        // an in-flow block sitting inside a host card needs no shadow at all.
        !inline && 'shadow-2xl',
        // MOBILE = PiP dimensions, not a shrunken desktop card. This is an
        // UNINVITED overlay on the smallest screens, so it is sized against
        // the corner-PiP conventions, NOT against system PiP (which is
        // user-invoked content and is allowed ~60% of the shortest edge):
        //   - AOSP's legacy corner spec asks for 23% of screen width, then
        //     clamps up to `default_minimal_size_pip_resizable_task` (108dp in
        //     BOTH dimensions) — at 16:9 that floor IS 192x108, and on any
        //     modern phone the clamp is what actually applies. Hence the cap.
        //   - 192x108 lands at ~6% of a 390x844 screen, inside the "small
        //     player" band (<=20% of screen) rather than the "large" one.
        // 52vw keeps it proportional on narrow devices (320px -> 166x93) and
        // the 192px cap takes over from ~369px up, i.e. on most phones.
        // Do NOT go below ~150px: the corner chrome (32px transport pair +
        // 32px dismiss + the title pill) stops fitting, and the card's own
        // controls — not the poster — are what set the real floor here.
        'aspect-video transition-opacity duration-200',
        // Inline: the HOST owns the width — the card only keeps 16:9 within it.
        inline ? 'w-full' : 'w-[min(52vw,192px)] sm:w-80',
        footerHidden ? 'pointer-events-none opacity-0' : 'opacity-100',
        className,
      )}
      // `mouse` only: pointerenter also fires for touch, which started a
      // preview on every tap. Focus mirrors hover so keyboard users can reach
      // the transport controls at all.
      onPointerEnter={e => {
        if (e.pointerType === 'mouse' && previewAllowed && !resumeMode) setHovered(true);
      }}
      onPointerLeave={e => {
        if (e.pointerType === 'mouse') setHovered(false);
      }}
      // Re-arm hover after a close that left the pointer parked on the card.
      onPointerMove={e => {
        if (e.pointerType === 'mouse' && previewAllowed && !resumeMode && !hovered) setHovered(true);
      }}
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
        try {
          keyboard = el.matches?.(':focus-visible') ?? false;
        } catch {
          keyboard = false;
        }
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
      onBlurCapture={e => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovered(false);
      }}
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
          // Mirrors the card's own responsive width above — a flat 320px hint
          // made every phone fetch a poster ~1.7x wider than the box.
          posterSizes="(max-width: 639px) 192px, 320px"
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
          startTime={resumeHandoff?.time}
          startMuted={resumeHandoff?.muted ?? false}
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
      <span className="pointer-events-none absolute bottom-[var(--spacing-system-xsf)] left-[var(--spacing-system-xsf)] z-20 flex max-w-[calc(100%-2*var(--spacing-system-xsf))] items-center gap-[var(--spacing-system-xsf)] rounded-full bg-ods-overlay py-[var(--spacing-system-xxs)] pl-[var(--spacing-system-xxs)] pr-[var(--spacing-system-sf)] text-ods-text-primary text-h6">
        {presenterAvatarSrc ? (
          <SquareAvatar src={presenterAvatarSrc} alt="" sizePx={20} variant="round" className="shrink-0 border-0" />
        ) : (
          <VideoPlayBadge size="sm" className="h-5 w-5 shrink-0" />
        )}
        {/* The video's OWN title is the point of the pill; `label` is only the
            generic fallback for a video that carries no title. */}
        <span className="truncate">{summaryTitle || label}</span>
      </span>

      {/* BIG centred glyph — the muted-fallback prompt (bite grammar). It IS
          interactive, but ONLY exists while the card is muted, so the two
          intents never compete: muted → this button unmutes; once unmuted it
          unmounts and the same click lands on the hit layer and opens the
          theater. `size="icon-glyph"` keeps the glyph at its own 56px instead
          of the DS default `[&_svg]:h-5`; `variant="glyph"` means no button
          surface paints behind a glyph that already carries its own scrim.

          BELOW `sm` IT IS NOT RENDERED — see the corner mute button's
          mirrored `sm:hidden` below; the two form ONE breakpoint switch and
          must always be edited together. At the mobile PiP height (~108px)
          the 56px glyph physically cannot clear both the 32px transport band
          and the title pill: the three need ~124px of vertical stack, which
          16:9 does not give back until the card is ~224px wide — i.e. barely
          smaller than the oversized card this sizing exists to fix. Nothing
          is lost, because the ONLY state that shows this glyph is resume mode
          (`cardMode !== 'poster'`), and resume mode always mounts the corner
          transport pair, which offers the same play AND unmute actions at
          32px — above the 24px WCAG 2.5.8 (AA) target floor. */}
      {showBigUnmute && (
        <Button
          variant="glyph"
          size="icon-glyph"
          aria-label={controlIsPlay ? 'Play' : 'Unmute'}
          title={controlIsPlay ? 'Play' : 'Unmute'}
          onPointerDown={e => e.stopPropagation()}
          onClick={onUnmuteOrPlay}
          className="absolute inset-0 z-30 m-auto hidden sm:inline-flex"
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
              never on screen with the same label and different behaviour —
              but ONLY from `sm` up, because below `sm` that glyph is not
              rendered at all (see its comment above). `sm:hidden`, not
              `hidden`: a plain `hidden` here would combine with the glyph's
              own `hidden sm:inline-flex` to leave the mobile card with NO
              unmute affordance whatsoever — precisely the self-hiding dead
              end called out in the state-model note at the top of this file.
              These two classNames are ONE switch; never change one alone. */}
          <Button
            variant="overlay"
            size="icon-sm"
            aria-label={cardMuted ? 'Unmute' : 'Mute'}
            title={cardMuted ? 'Unmute' : 'Mute'}
            onPointerDown={e => e.stopPropagation()}
            onClick={onToggleMute}
            className={cn(showBigUnmute && !controlIsPlay && 'sm:hidden')}
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
      {showCard &&
        (inline ? (
          // No wrapper: a positioning / z-index / safe-area shell around an
          // in-flow block is exactly what stops it sizing to its container.
          collapsed
        ) : (
          <div
            className={cn(
              'pointer-events-none fixed bottom-0 p-[var(--spacing-system-mf)]',
              video.position === 'right' ? 'right-0' : 'left-0',
              WALKTHROUGH_Z,
            )}
            style={{ paddingBottom: 'max(var(--spacing-system-mf), env(safe-area-inset-bottom))' }}
          >
            {collapsed}
          </div>
        ))}

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
              // unmuted path. EXCEPT the paused deep-link session, which
              // starts fully stopped: no autoplay flag at all, and for
              // YouTube no autoActivate either — the activated iframe
              // hardcodes `autoplay=1`, so staying on the facade IS the
              // paused presentation (clicking it activates and plays).
              autoPlay={theaterStart.muted && !pausedOpenSession}
              autoPlayUnmuted={!theaterStart.muted && !pausedOpenSession}
              startMuted={theaterStart.muted}
              autoActivate={!pausedOpenSession}
              suspended={suspended}
              onMutedFallbackChange={st => {
                theaterForcedMuteRef.current = st.muted;
              }}
              onEnded={() => {
                endedLatchRef.current = true;
              }}
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

/**
 * The widget pinned into a bottom corner over the page — the app-shell / site
 * placement. Every host that wants "a demo video somewhere on the page, out of
 * the way" mounts this.
 */
export function FloatingWalkthroughVideo(props: FloatingWalkthroughVideoProps): React.ReactElement {
  return <WalkthroughVideo {...props} placement="floating" />;
}

/**
 * The same widget as an in-flow block, sized by whatever the host puts it in —
 * for a page that gives the video a slot of its own rather than a corner.
 *
 * The two overlay defaults are fixed here rather than left to the caller: an
 * in-page block has nothing to stagger against (`appearDelayMs={0}`), and a
 * dismissable one would leave the host's layout with a hole while sharing the
 * floating card's per-platform cookie (`dismissal={false}`). Both are stated
 * once here instead of at every call site, where forgetting either is silent.
 */
export function InlineWalkthroughVideo(props: InlineWalkthroughVideoProps): React.ReactElement {
  return <WalkthroughVideo {...props} placement="inline" appearDelayMs={0} dismissal={false} />;
}
