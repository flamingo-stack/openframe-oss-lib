'use client';

/**
 * The file half of `<Video>`: `<MuxPlayer>` (HLS and plain MP4) with hover
 * playback, the muted fallback, health monitoring and captions.
 *
 * Its own module so the player and hls.js are fetched only by a page that
 * draws a file video: `video.tsx` loads it on demand. Never import it
 * directly; `<Video>` is the only entry.
 */

import MuxPlayer from '@mux/mux-player-react';
import type React from 'react';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useAuthedAssetSrc } from '../../hooks/use-authed-asset-src';
import { useIosNativeVideoFullscreen } from './use-ios-native-video-fullscreen';
import { saveDataEnabled } from './use-video-warmup';
import { VideoUnmuteGlyph } from './video-center-badge';
import {
  activationWaiters,
  hasUserInteracted,
  reportPlaybackFailure,
  VIDEO_STALL_TIMEOUT_MS,
  VideoErrorOverlay,
  type VideoFailureReason,
  type VideoFilePlaybackProps,
  type VideoPlayerHandle,
} from './video-shared';

// =============================================================================
// Dev-only hover→playing latency instrumentation gate. Always on in dev
// builds; opt-in in production via `localStorage.VIDEO_PERF_DEBUG` so an
// "instant hover" regression can be measured on a live deployment.
// =============================================================================
function videoPerfDebugEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('VIDEO_PERF_DEBUG') !== null;
  } catch {
    return false;
  }
}

// =============================================================================
// Mux viewer identity without a cookie
// =============================================================================
//
// Mux Data keeps `mux_viewer_id` (stable viewer) and a rolling session id in a
// `muxData` cookie, 365-day expiry. That cookie rides on EVERY request to the
// origin, and its punctuation trips Cloud Armor's restricted-SQL-character
// cookie counters (CRS 942420/942421) — 245 preview-DENY events in a 6-hour
// census. `disableCookies` alone stops the beacons carrying any viewer id at
// all (`viewerData = disableCookies ? {} : Ae()` in mux-embed), which would
// turn every page load into a new "unique viewer".
//
// So we keep the identity and drop the cookie: the id lives in localStorage and
// is handed to Mux as `metadata.viewer_user_id`. No coverage is lost — Mux's
// cookie is host-only (`Cookies.set` with `{path:'/'}` and no `domain`), and
// localStorage is origin-scoped, so the two cover exactly the same surface.
//
// What does NOT come back: `session_id`/`session_start`, which group views into
// a 25-minute session — mux-embed derives those internally and exposes no way
// to supply them. Per-view metrics, QoE and viewer counts are unaffected.
// `mux_sample_number` is also dropped, which is harmless at the default
// `sampleRate: 1` (the beacon check is `(sample ?? 0) >= sampleRate`).
const MUX_VIEWER_ID_KEY = 'mux:viewer_id';

function muxViewerId(): string | undefined {
  try {
    if (typeof localStorage === 'undefined') return undefined;
    const existing = localStorage.getItem(MUX_VIEWER_ID_KEY);
    if (existing) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(MUX_VIEWER_ID_KEY, generated);
    return generated;
  } catch {
    // Private mode / storage disabled — Mux falls back to per-view identity.
    return undefined;
  }
}

// One-time removal of the legacy `muxData` cookie. `disableCookies` stops NEW
// writes but never clears what was already issued, and at 365 days those
// browsers would keep tripping 942420/942421 for a year. Module-level so it runs
// on import, before any player mounts. Host-only, so no `domain` attribute —
// that is what Mux set. Remove this once the census reads zero.
if (typeof document !== 'undefined') {
  try {
    document.cookie = 'muxData=; path=/; max-age=0';
  } catch {
    // Non-blocking: a failed cleanup only means the census decays slower.
  }
}

// =============================================================================
// Suppress Google Cast SDK loading (CSP-friendly)
// =============================================================================
//
// Why: MuxPlayer is built on `media-chrome`, which is built on `castable-video`.
// `castable-video`'s `loadCastFramework()` UNCONDITIONALLY injects a
// `<script src="https://www.gstatic.com/cv/.../cast_sender.js?loadCastFramework=1">`
// whenever Chrome is detected. That script then internally loads further
// scripts from `http://www.gstatic.com/eureka/clank/...` and
// `http://www.gstatic.com/cast/sdk/libs/...` — over **HTTP, not HTTPS** —
// which can never pass any reasonable CSP. Result: every video render
// emits 3+ "Loading the script ... violates CSP" errors in the browser
// console.
//
// The loader has a single early-exit: `if (globalThis.chrome?.cast)
// return;`. So we make `chrome.cast` truthy (with `isAvailable: false`
// so existing apps that consult that flag still see "no cast") BEFORE
// MuxPlayer's `castable-mixin` runs. Module-level code in this file
// executes during the import that brings `MuxPlayer` into the bundle —
// safely before any instance mounts.
//
// We don't use Chromecast anywhere in the hub. If we ever do, replace
// this block with explicit cast initialization at the call site.
if (typeof window !== 'undefined') {
  const w = window as unknown as { chrome?: { cast?: unknown } };
  if (!w.chrome?.cast) {
    w.chrome = { ...(w.chrome ?? {}), cast: { isAvailable: false } };
  }
}

// =============================================================================
// Suppress benign "Media Chrome: No style sheet found ..." warning.
// =============================================================================
//
// Why: MuxPlayer's UI is built on `media-chrome`, which uses custom
// elements with shadow-DOM `<style>` tags. `media-chrome`'s internal
// `insertCSSRule()` helper queries `style.sheet` during the element's
// `connectedCallback`. When the player mounts inside a React portal
// (the chat panel renders `<Video>` inside Radix's `<Dialog.Portal>`),
// the element is moved across DOM trees BEFORE the browser hydrates
// the shadow `<style>`'s `.sheet`. The helper then logs:
//   "Media Chrome: No style sheet found on style tag of #shadow-root (open)"
// and returns a no-op style shim. The warning is purely cosmetic —
// playback, controls, and theming all render correctly because the
// shadow stylesheet does hydrate on the next paint.
//
// Until upstream `media-chrome` either retries on the next microtask
// or downgrades the warning (tracked in their issue tracker), patch
// `console.warn` once at module load to drop only THIS exact string.
// All other `console.warn` calls pass through unchanged.
//
// Why patch instead of opting out: `@mux/mux-player-react` exposes no
// prop to disable internal style queries, importing CSS explicitly
// doesn't seed the shadow-root stylesheets (they're per-element), and
// the warning fires before any consumer can intercept the element.
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  const w = window as unknown as { __MEDIA_CHROME_WARN_PATCHED__?: boolean };
  if (!w.__MEDIA_CHROME_WARN_PATCHED__) {
    w.__MEDIA_CHROME_WARN_PATCHED__ = true;
    const MEDIA_CHROME_NO_STYLESHEET_PREFIX = 'Media Chrome: No style sheet found on style tag of';
    const originalWarn = console.warn.bind(console);
    console.warn = (...args: unknown[]): void => {
      if (typeof args[0] === 'string' && args[0].startsWith(MEDIA_CHROME_NO_STYLESHEET_PREFIX)) {
        return;
      }
      originalWarn(...args);
    };
  }
}

// -----------------------------------------------------------------------------
// File branch — MuxPlayer (handles both .m3u8 HLS and plain .mp4)
// -----------------------------------------------------------------------------

export interface FilePlayerProps extends VideoFilePlaybackProps {
  url: string;
  poster?: string | null;
  muted?: boolean;
  className?: string;
}

export default function FilePlayer({
  url,
  poster,
  muted,
  srtContent,
  captionsUrl,
  autoPlay,
  loop,
  chromeless,
  playOnHover,
  playWhenHovered,
  preload,
  fit,
  startTime,
  playerHandleRef,
  autoPlayUnmuted,
  startMuted,
  mutedIntent = false,
  hideMutedBadge,
  onMutedFallbackChange,
  onEnded,
  className,
}: FilePlayerProps): React.ReactElement {
  // Explicit preload policy — never rely on the browser/MuxPlayer implicit
  // default. 'metadata' makes playback-core load the manifest immediately
  // and clamp buffering to maxBufferLength=1/maxBufferSize=1 (manifest +
  // ~1 segment, then idle); play() restores full buffering automatically.
  // That bounded prefetch is what makes hover/click start instant. Save-Data
  // connections get 'none' (nothing until play()). SSR note: the server pass
  // always emits 'metadata' (saveDataEnabled() is false server-side); for
  // Save-Data users React reconciles the property to 'none' during hydration.
  // The mux-player custom element upgrades from client JS, so the window for
  // an early manifest fetch is at most one bounded manifest+segment — the
  // Save-Data verification gate covers it (see plan A2.4).
  const effectivePreload = preload ?? (saveDataEnabled() ? 'none' : 'metadata');
  // THE captions seam. `<track src>` is a browser subresource: it carries no
  // custom headers, so it authenticates by cookie only. Fine on the cookie-auth
  // web, a guaranteed 401 on every HEADER-auth host — native shells and
  // dev-ticket web — whose caption route sits behind the same proxied
  // `/content/api/captions` path as every other embedded endpoint. Resolving it
  // through `useAuthedAssetSrc` puts the track on the SAME single auth knob as
  // every embedded `fetch` (adapter bearer + 401-refresh-retry), so a host
  // configures `endpoints.captionsUrlPrefix` and nothing else — no per-surface,
  // per-host caption plumbing. Cookie-auth hosts get the URL back untouched.
  const resolvedCaptionsUrl = useAuthedAssetSrc(captionsUrl, 'text/vtt, */*');
  // True while hover playback is running MUTED because the browser's autoplay
  // policy blocked sound (no user activation yet). Drives the center unmute
  // control — the industry pattern (muted autoplay + explicit unmute button)
  // instead of silently waiting for a click somewhere.
  // Seeded from `startMuted`: a surface that declares itself muted is muted from
  // its FIRST paint, so the badge does not have to be announced by the autoplay
  // kick effect below (a setState in an effect body, and a wasted render pass
  // that flashed an unmuted-looking control over a video that was always muted).
  const [hoverMutedFallback, setHoverMutedFallback] = useState<boolean>(() => Boolean(startMuted));
  // playOnHover drives the underlying mux-player element imperatively — the
  // element exposes native play()/pause()/muted/volume; the chrome stays as
  // configured. Sound-first: volume 0.5 unmuted, muted fallback when the
  // browser's autoplay policy rejects unmuted hover playback (hover is not a
  // user gesture in Chrome's activation model).
  const hoverPlayerRef = useRef<{
    play?: () => Promise<void> | void;
    pause?: () => void;
    load?: () => void;
    muted?: boolean;
    volume?: number;
    currentTime?: number;
    duration?: number;
    paused?: boolean;
    ended?: boolean;
    addEventListener?: (type: string, listener: () => void) => void;
    removeEventListener?: (type: string, listener: () => void) => void;
  } | null>(null);
  // True while the muted fallback is ALSO a blocked-autoplay state (even muted
  // play() was rejected — iOS Low Power). Lets the host label its control
  // "play" vs "unmute". MUST be state, not a ref: the blocked transition often
  // lands while `hoverMutedFallback` is already true (a ref write wouldn't
  // re-run the reporting effect, so hosts would never see blocked: true).
  const [mutedFallbackBlocked, setMutedFallbackBlocked] = useState(false);
  // Dev/opt-in hover→'playing' latency metric (see videoPerfDebugEnabled).
  // One listener at a time — re-entering hover replaces it; hover-leave and
  // unmount clear it so no stale listener survives across generations.
  const perfListenerRef = useRef<(() => void) | null>(null);
  const clearPerfListener = useCallback(() => {
    if (perfListenerRef.current) {
      try {
        hoverPlayerRef.current?.removeEventListener?.('playing', perfListenerRef.current);
      } catch {
        /* element already torn down */
      }
      perfListenerRef.current = null;
    }
  }, []);
  useEffect(() => clearPerfListener, [clearPerfListener]);
  // Tracks whether the pointer is STILL over the player. A fast hover-out
  // pauses the in-flight play(), which rejects it with AbortError — that must
  // NOT trigger the muted retry (it would restart playback after the pointer
  // left, with no visible control to stop it). Only a genuine autoplay-policy
  // rejection (NotAllowedError) while still hovered retries muted.
  const hoverActiveRef = useRef(false);
  // Per-enter generation token: a LATE NotAllowedError from a previous enter
  // must not fire the muted fallback into a newer (intended-sound) session.
  const hoverGenerationRef = useRef(0);
  // This instance's pending activation waiter — pruned on hover-leave,
  // re-enter, and unmount so pre-activation hovers don't accumulate stale
  // closures in the module-level set (they'd otherwise setState against
  // unmounted instances when the first user gesture finally lands).
  const activationWaiterRef = useRef<(() => void) | null>(null);
  const clearActivationWaiter = useCallback(() => {
    if (activationWaiterRef.current) {
      activationWaiters.delete(activationWaiterRef.current);
      activationWaiterRef.current = null;
    }
  }, []);
  useEffect(() => clearActivationWaiter, [clearActivationWaiter]);

  // Read through a ref, NOT the closure: startHoverPlayback is memoized on
  // empty-dep callbacks, so it would capture render-0's value forever (that is
  // why threading the prop through three layers still did nothing). Adding it
  // to the deps instead would re-run hover playback on every mute toggle and
  // play() over an explicit pause.
  // Filled in an unconditional effect rather than in the render body: a render
  // attempt React discards must not install an intent that never committed,
  // and the only reader is a hover handler, which cannot fire before a commit.
  const mutedIntentRef = useRef(mutedIntent);
  useEffect(() => {
    mutedIntentRef.current = mutedIntent;
  });
  const startHoverPlayback = useCallback(() => {
    hoverActiveRef.current = true;
    const generation = ++hoverGenerationRef.current;
    const el = hoverPlayerRef.current;
    if (!el) return;
    if (videoPerfDebugEnabled()) {
      clearPerfListener();
      const startedAt = performance.now();
      const onPlaying = () => {
        clearPerfListener();
        console.debug('[Video] hover→playing %dms', Math.round(performance.now() - startedAt));
      };
      perfListenerRef.current = onPlaying;
      try {
        el.addEventListener?.('playing', onPlaying);
      } catch {
        /* ignore */
      }
    }
    try {
      el.volume = 0.5;
      if (hasUserInteracted()) {
        // Post-activation: unmuted playback is allowed — play with sound,
        // UNLESS the host holds a standing mute intent. Force-unmuting here
        // audibly undid an explicit mute on the next hover, while the host's
        // toggle still rendered "muted".
        // The NotAllowedError guard stays as a belt-and-suspenders fallback;
        // a fast hover-out's pause() rejects with AbortError and must not
        // restart playback (name mismatch + cleared hoverActiveRef).
        el.muted = mutedIntentRef.current;
        (el.play?.() as Promise<void> | undefined)?.catch?.((err: unknown) => {
          const name = (err as { name?: string } | null)?.name;
          if (name === 'NotAllowedError' && hoverActiveRef.current && generation === hoverGenerationRef.current) {
            try {
              el.muted = true;
              (el.play?.() as Promise<void> | undefined)?.catch?.(() => {
                // Even MUTED playback was rejected (iOS Low Power, Firefox
                // media.autoplay.default=5, enterprise policy). Report it, or
                // the host renders a "Pause"/"Unmute" control over a video
                // that never started and the first press is a no-op.
                if (hoverActiveRef.current && generation === hoverGenerationRef.current) {
                  setMutedFallbackBlocked(true);
                }
              });
              setHoverMutedFallback(true);
            } catch {
              /* give up silently */
            }
          }
        });
      } else {
        // Pre-activation: unmuted WOULD be rejected (hover isn't a gesture in
        // Chrome's activation model) — start muted immediately with no
        // rejection round-trip, and UNMUTE LIVE the instant the user's first
        // click/keydown lands anywhere while this hover is still active.
        el.muted = true;
        (el.play?.() as Promise<void> | undefined)?.catch?.(() => {
          // Same as the post-activation retry above: a rejected MUTED play is
          // "blocked", not "muted", and the host's control label depends on
          // the difference.
          if (hoverActiveRef.current && generation === hoverGenerationRef.current) {
            setMutedFallbackBlocked(true);
          }
        });
        setHoverMutedFallback(true);
        clearActivationWaiter();
        const waiter = () => {
          activationWaiterRef.current = null;
          if (hoverActiveRef.current && generation === hoverGenerationRef.current) {
            try {
              el.muted = false;
              el.volume = 0.5;
            } catch {
              /* ignore */
            }
            setHoverMutedFallback(false);
          }
        };
        activationWaiterRef.current = waiter;
        activationWaiters.add(waiter);
      }
    } catch {
      /* ignore */
    }
  }, [clearActivationWaiter, clearPerfListener]);
  const stopHoverPlayback = useCallback(() => {
    hoverActiveRef.current = false;
    setHoverMutedFallback(false);
    clearActivationWaiter();
    clearPerfListener();
    try {
      hoverPlayerRef.current?.pause?.();
    } catch {
      /* already torn down */
    }
  }, [clearActivationWaiter, clearPerfListener]);

  // Explicit unmute affordance: the click IS the user activation the autoplay
  // policy wants, so unmuting here always succeeds (and the window-level
  // activation listener flips the module flag for every other player too).
  const unmuteNow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const el = hoverPlayerRef.current;
    try {
      if (el) {
        el.muted = false;
        el.volume = 0.5;
        (el.play?.() as Promise<void> | undefined)?.catch?.(() => {});
      }
    } catch {
      /* ignore */
    }
    setHoverMutedFallback(false);
  }, []);

  // Controlled hover mode (playWhenHovered): the HOST owns hover detection —
  // e.g. the bite-strip card, where the detail overlay is part of the card and
  // must NOT pause playback when the pointer moves onto it.
  const hoverControlled = typeof playWhenHovered === 'boolean';
  useEffect(() => {
    if (!hoverControlled) return;
    if (playWhenHovered) startHoverPlayback();
    else stopHoverPlayback();
  }, [hoverControlled, playWhenHovered, startHoverPlayback, stopHoverPlayback]);

  const handleHoverEnter = playOnHover && !hoverControlled ? startHoverPlayback : undefined;
  const handleHoverLeave = playOnHover && !hoverControlled ? stopHoverPlayback : undefined;

  // Report muted-fallback transitions to hosts that render their own control
  // (hideMutedBadge). Emitted on every change to hoverMutedFallback so the
  // host's card-level unmute/play affordance stays in sync.
  // Republished in its own unconditional effect, declared BEFORE the emitter
  // below so it is refreshed first in the same flush — a render body write
  // would install a callback from a render attempt React may have discarded.
  const onMutedFallbackChangeRef = useRef(onMutedFallbackChange);
  useEffect(() => {
    onMutedFallbackChangeRef.current = onMutedFallbackChange;
  });
  useEffect(() => {
    onMutedFallbackChangeRef.current?.({
      muted: hoverMutedFallback,
      blocked: hoverMutedFallback && mutedFallbackBlocked,
    });
  }, [hoverMutedFallback, mutedFallbackBlocked]);

  // Autoplay-on-mount for handoff surfaces (theater open / resume card). Runs
  // once. `autoPlayUnmuted` tries sound (the mount is gesture-adjacent) and
  // falls back to muted + fallback state on rejection; `startMuted` (used with
  // MuxPlayer's own muted autoPlay) just arms the fallback state so the host's
  // unmute control shows from the first frame.
  const autoPlayKickedRef = useRef(false);
  useEffect(() => {
    if (autoPlayKickedRef.current) return;
    if (startMuted) {
      // Actually mute the element. Previously this only armed the UI state, so
      // a paused+muted resume (no autoPlay to carry `muted`) sat unmuted and
      // the first Play press blasted full volume while every label said muted.
      const mutedEl = hoverPlayerRef.current;
      if (!mutedEl) return; // latch AFTER the ref read — see the branch below
      autoPlayKickedRef.current = true;
      try {
        mutedEl.muted = true;
      } catch {
        /* ignore */
      }
      // No state to publish here: `hoverMutedFallback` is seeded from
      // `startMuted` at its declaration, and `mutedFallbackBlocked` starts
      // false — this branch is latched, so it only ever ran while both already
      // held those values.
      // When this surface is ALSO autoplaying, MuxPlayer issues its own muted
      // play() whose rejection we never see. Issue a parallel one purely to
      // OBSERVE the outcome: a redundant play on an already-playing element is
      // a no-op, but a rejection is the only signal that the host must render
      // "Play" instead of "Pause" over a video that never started.
      if (autoPlay) {
        // One handler for both failure shapes: `play()` reports a blocked
        // autoplay either by rejecting or, on a torn-down element, by throwing
        // synchronously. Same event, same report — and this is genuinely the
        // element telling us something, not a value the render could have
        // derived.
        const reportBlocked = () => setMutedFallbackBlocked(true);
        try {
          (mutedEl.play?.() as Promise<void> | undefined)?.catch?.(reportBlocked);
        } catch {
          reportBlocked();
        }
      }
      return;
    }
    if (!autoPlayUnmuted) return;
    const el = hoverPlayerRef.current;
    // Latch AFTER the ref check: setting it first meant a null player on the
    // first run burned the one-shot kick with no retry (the deps never change).
    if (!el) return;
    autoPlayKickedRef.current = true;
    try {
      el.muted = false;
      el.volume = typeof el.volume === 'number' ? el.volume : 1;
      (el.play?.() as Promise<void> | undefined)?.catch?.((err: unknown) => {
        const name = (err as { name?: string } | null)?.name;
        if (name !== 'NotAllowedError') return;
        // Unmuted rejected — retry muted; if THAT rejects too, mark blocked.
        try {
          el.muted = true;
          (el.play?.() as Promise<void> | undefined)?.catch?.(() => {
            setMutedFallbackBlocked(true);
            setHoverMutedFallback(true);
          });
          setMutedFallbackBlocked(false);
          setHoverMutedFallback(true);
        } catch {
          setMutedFallbackBlocked(true);
          setHoverMutedFallback(true);
        }
      });
    } catch {
      /* ignore */
    }
  }, [autoPlayUnmuted, startMuted, autoPlay]);

  // volumechange listener — clears the muted-fallback state when the media is
  // unmuted by ANY path (MuxPlayer's own chrome in the theater, or the host
  // control). Without this a stale glyph/state can persist after a chrome unmute.
  useEffect(() => {
    const el = hoverPlayerRef.current;
    if (!el?.addEventListener) return undefined;
    const onVolumeChange = () => {
      if (el.muted === false) {
        setMutedFallbackBlocked(false);
        setHoverMutedFallback(false);
      }
    };
    try {
      el.addEventListener('volumechange', onVolumeChange);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        el.removeEventListener?.('volumechange', onVolumeChange);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // `playing` clears the blocked-autoplay flag. Without this, once a muted
  // retry had been rejected (iOS Low Power) the host's centre glyph read "Play"
  // over a playing video forever — the flag was only cleared by an unmute.
  useEffect(() => {
    const el = hoverPlayerRef.current;
    if (!el?.addEventListener) return undefined;
    const onPlaying = () => setMutedFallbackBlocked(false);
    try {
      el.addEventListener('playing', onPlaying);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        el.removeEventListener?.('playing', onPlaying);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // ended listener — host clears its handoff (mini-player continuation).
  // Republished in an unconditional effect rather than in the render body; the
  // only reader is the DOM 'ended' listener installed below, which cannot fire
  // before a commit.
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  });
  useEffect(() => {
    const el = hoverPlayerRef.current;
    if (!el?.addEventListener) return undefined;
    const handler = () => onEndedRef.current?.();
    try {
      el.addEventListener('ended', handler);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        el.removeEventListener?.('ended', handler);
      } catch {
        /* ignore */
      }
    };
  }, []);

  // In the iOS shell the fullscreen control goes to Apple's video player rather
  // than to element fullscreen, which WebKit exits by breaking the safe areas.
  useIosNativeVideoFullscreen(hoverPlayerRef);

  // Imperative handle — snapshot getters + control mutators for handoff.
  useImperativeHandle(
    playerHandleRef,
    (): VideoPlayerHandle => ({
      getCurrentTime: () => hoverPlayerRef.current?.currentTime ?? 0,
      getDuration: () => {
        const d = hoverPlayerRef.current?.duration;
        return typeof d === 'number' && isFinite(d) ? d : 0;
      },
      getPaused: () => hoverPlayerRef.current?.paused ?? true,
      getMuted: () => hoverPlayerRef.current?.muted ?? false,
      play: async () => {
        await hoverPlayerRef.current?.play?.();
      },
      pause: () => {
        try {
          hoverPlayerRef.current?.pause?.();
        } catch {
          /* ignore */
        }
      },
      setMuted: (m: boolean) => {
        const el = hoverPlayerRef.current;
        if (!el) return;
        try {
          el.muted = m;
          if (!m) {
            setMutedFallbackBlocked(false);
            setHoverMutedFallback(false);
          }
        } catch {
          /* ignore */
        }
      },
    }),
    [],
  );
  // Raw SRT text is unusable without a custom overlay — and we just deleted
  // the 900-LOC custom-controls layer that owned that overlay. Consumers
  // pass `captionsUrl` (the API-side VTT conversion) alongside `srtContent`
  // anyway. Warn in dev if the deprecated prop is the only one supplied
  // so a single-prop call site doesn't silently lose captions.
  if (process.env.NODE_ENV !== 'production' && srtContent && !captionsUrl) {
    console.warn(
      '[Video] srtContent supplied without captionsUrl — captions will not render. ' +
        'Pass captionsUrl (the VTT URL) instead; raw SRT text overlays are no longer supported.',
    );
  }

  // Only chrome-bearing surfaces (a user actively watching) monitor health —
  // decorative first-frame and hover previews pass `chromeless` and stay silent.
  const monitorHealth = !chromeless;
  const [playbackFailed, setPlaybackFailed] = useState(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current !== null) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);
  useEffect(() => clearStallTimer, [clearStallTimer]);

  const failPlayback = useCallback(
    (reason: VideoFailureReason) => {
      clearStallTimer();
      setPlaybackFailed(true);
      reportPlaybackFailure({ kind: 'file', src: url, reason });
    },
    [clearStallTimer, url],
  );

  // A manually paused or finished video is never a stall.
  const armStallTimer = useCallback(() => {
    if (!monitorHealth) return;
    const el = hoverPlayerRef.current;
    if (!el || el.paused || el.ended) return;
    if (stallTimerRef.current !== null) return;
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      failPlayback('stall');
    }, VIDEO_STALL_TIMEOUT_MS);
  }, [monitorHealth, failPlayback]);

  // Progress means the player is alive — a stall that self-heals clears its own
  // overlay.
  const handlePlaybackProgress = useCallback(() => {
    clearStallTimer();
    setPlaybackFailed(false);
  }, [clearStallTimer]);

  const handleMediaError = useCallback(() => {
    if (!monitorHealth) return;
    failPlayback('error');
  }, [monitorHealth, failPlayback]);

  // `load()` re-inits the HLS pipeline (`play()` alone can't) but rewinds to
  // zero — stash the position and seek back on `loadedmetadata`, since an
  // earlier assignment is dropped while the fresh source has no seekable range.
  const retryPlayback = useCallback(() => {
    setPlaybackFailed(false);
    clearStallTimer();
    const el = hoverPlayerRef.current;
    if (!el) return;
    const resumeAt = typeof el.currentTime === 'number' ? el.currentTime : 0;
    try {
      el.load?.();
      if (resumeAt > 0 && el.addEventListener && el.removeEventListener) {
        const seekBack = () => {
          el.removeEventListener?.('loadedmetadata', seekBack);
          try {
            el.currentTime = resumeAt;
          } catch {
            /* source shorter than the stashed position — start from the top */
          }
        };
        el.addEventListener('loadedmetadata', seekBack);
      }
      (el.play?.() as Promise<void> | undefined)?.catch?.(() => {
        /* a re-rejected play surfaces again via the error/stall handlers */
      });
    } catch {
      /* element torn down */
    }
  }, [clearStallTimer]);

  const errorOverlay = monitorHealth && playbackFailed ? <VideoErrorOverlay onRetry={retryPlayback} /> : null;

  const player = (
    <MuxPlayer
      ref={hoverPlayerRef as React.Ref<never>}
      onError={handleMediaError}
      onWaiting={armStallTimer}
      onStalled={armStallTimer}
      onPlaying={handlePlaybackProgress}
      onTimeUpdate={handlePlaybackProgress}
      onPause={clearStallTimer}
      src={url}
      poster={poster || undefined}
      streamType="on-demand"
      preload={effectivePreload}
      playsInline
      muted={muted}
      preferCmcd="header"
      // No `muxData` cookie — the viewer id moves to localStorage and rides in
      // `metadata` below instead. See the "Mux viewer identity without a
      // cookie" block at the top of this file.
      disableCookies
      metadata={{ viewer_user_id: muxViewerId() }}
      // MuxPlayer's built-in default is `#fa50b5` (Mux brand pink) — when
      // its `--media-accent-color` resolves to nothing the player falls
      // through to that hardcoded pink. The `var(--ods-accent,
      // var(--color-accent-primary))` chain hits the platform-aware
      // ODS token first, then the semantic accent alias if `--ods-accent`
      // is ever undefined on a `data-app-type` we haven't themed yet.
      // NEVER let Mux pink leak onto a non-Flamingo platform.
      accentColor="var(--ods-accent, var(--color-accent-primary))"
      // `startMuted` only ARMS the muted-fallback state (so a host can render
      // its own unmute control); it must not imply autoplay, or a resume that
      // closed PAUSED would start playing while the toggle still reads "Play".
      autoPlay={autoPlay ? 'muted' : autoPlayUnmuted ? 'any' : undefined}
      startTime={typeof startTime === 'number' ? startTime : undefined}
      loop={loop}
      className={className}
      // Fill the wrapping aspect-ratio container instead of MuxPlayer's
      // intrinsic size. Without this, MuxPlayer renders at its default
      // dimensions before video metadata loads, then grows to its
      // metadata-derived size — that's the "starts super small and
      // flickers and grows" CLS we're killing. With `aspect-video` on
      // the centered wrapper and `width/height: 100%` here, the box is
      // 16:9 from first paint and stays put.
      // `--controls: none` is media-chrome's kill switch for ALL player
      // chrome — the chromeless preview mode. `--bottom-controls: none`
      // hides only the bottom bar (center play/pause stays) — the
      // bite-strip card look per Figma. Merged (never replacing) into the
      // sizing style; custom properties need the CSSProperties cast.
      // `--media-object-fit: cover` is media-chrome's documented object-fit
      // var — the `fit="cover"` crop for grid cells / mockups.
      style={{
        width: '100%',
        height: '100%',
        ...(chromeless ? { '--controls': 'none' } : {}),
        ...(fit === 'cover' ? { '--media-object-fit': 'cover' } : {}),
      }}
    >
      {resolvedCaptionsUrl ? (
        <track kind="captions" src={resolvedCaptionsUrl} srcLang="en" label="English" default />
      ) : null}
    </MuxPlayer>
  );

  // Center unmute control — shown while hover playback runs muted because the
  // autoplay policy blocked sound. Best-practice pattern (Mux / FB / IG):
  // muted autoplay + an explicit unmute affordance, never forced sound.
  // Styled to match media-chrome's center controls exactly (the play glyph in
  // the same slot): plain large white glyph, no circle/border/background,
  // slight dim on hover — so unmute reads as just another center control.
  const unmuteBadge =
    hoverMutedFallback && !hideMutedBadge ? (
      <button
        type="button"
        aria-label="Unmute"
        title="Unmute"
        onClick={unmuteNow}
        // White at rest, ACCENT while the icon itself is hovered — the same
        // hover language as every mux control icon (see app-globals.css).
        className="absolute inset-0 z-10 m-auto flex h-14 w-14 items-center justify-center text-ods-text-primary transition-colors hover:text-ods-accent"
      >
        <VideoUnmuteGlyph />
      </button>
    ) : null;

  // MuxPlayerProps has no pointer-event props — the hover-play handlers live
  // on a full-size wrapper instead (only in UNCONTROLLED playOnHover mode;
  // controlled playWhenHovered hosts own their hover detection). Either
  // hover-capable mode gets a relative wrapper so the unmute badge can dock.
  if (playOnHover && !hoverControlled) {
    return (
      <div className="relative h-full w-full" onPointerEnter={handleHoverEnter} onPointerLeave={handleHoverLeave}>
        {player}
        {unmuteBadge}
        {errorOverlay}
      </div>
    );
  }
  // A relative wrapper so the unmute badge and the error overlay can dock. The
  // bare `player` return is left only for chromeless previews (never monitored).
  if (hoverControlled || autoPlayUnmuted || startMuted || monitorHealth) {
    return (
      <div className="relative h-full w-full">
        {player}
        {unmuteBadge}
        {errorOverlay}
      </div>
    );
  }
  return player;
}
