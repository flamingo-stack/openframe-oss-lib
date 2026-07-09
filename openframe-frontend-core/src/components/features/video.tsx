"use client";

/**
 * <Video> — single source of truth for every public video surface
 * across every Flamingo platform consumer of this lib.
 *
 * One component, three sources, three layouts. Replaces and deletes
 * the previous lib primitives:
 *
 *   - `<VideoPlayer>`  (react-player wrapper, ~900 LOC custom controls)
 *   - `<YouTubeEmbed>` (separate lite-youtube facade)
 *
 * Routing (`kind` discriminant, default `'auto'`):
 *
 *   kind="youtube"  → inline lite-youtube facade (poster + click→iframe)
 *   kind="file"     → <MuxPlayer> (HLS + MP4 + Mux Data + CMCD all in one)
 *   kind="auto"     → strict URL parse:
 *                        bare 11-char id   → youtube
 *                        YouTube hostname  → youtube
 *                        anything else     → file
 *
 * `<MuxPlayer>` handles both `.m3u8` (HLS via hls.js, native on Safari)
 * AND plain `.mp4` (uses the underlying `<video>` element). One component,
 * both paths — no internal "HLS vs MP4" branch needed. Captions are
 * rendered as native `<track>` children when `captionsUrl` is passed.
 *
 * Layouts:
 *   layout="centered" → max-w-3xl centered wrapper. Detail-page surface.
 *   layout="fill"     → absolute inset-0 w-full h-full. Carousel slides.
 *   layout="native"   → intrinsic aspect ratio. Bites grid, blog cards.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MuxPlayer from '@mux/mux-player-react';
import { PlayIcon } from '../icons-v2-generated/media-playback/play-icon';
import { fetchPriorityProp } from '../../utils/fetch-priority';

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

// =============================================================================
// User-activation tracker (module scope) — Chrome's autoplay policy rejects
// UNMUTED play() until the user has interacted with the page (click/keydown;
// pointer MOVEMENT does not count). Hover-preview surfaces use this to pick
// the right first move (sound vs muted) WITHOUT a rejection round-trip, and
// to unmute a live muted preview the instant the first gesture lands.
// =============================================================================

let userHasInteracted = false;
const activationWaiters = new Set<() => void>();
if (typeof window !== 'undefined') {
  const w = window as unknown as { __VIDEO_ACTIVATION_TRACKED__?: boolean };
  if (!w.__VIDEO_ACTIVATION_TRACKED__) {
    w.__VIDEO_ACTIVATION_TRACKED__ = true;
    const markActivated = () => {
      userHasInteracted = true;
      activationWaiters.forEach(fn => { try { fn(); } catch { /* ignore */ } });
      activationWaiters.clear();
      window.removeEventListener('pointerdown', markActivated, true);
      window.removeEventListener('keydown', markActivated, true);
    };
    window.addEventListener('pointerdown', markActivated, true);
    window.addEventListener('keydown', markActivated, true);
  }
}

// =============================================================================
// URL classifiers (private — `<Video>` is the only consumer)
// =============================================================================

const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);

/** Strict YouTube URL detection — parses the URL and checks the hostname. */
function isYouTubeUrl(url: string): boolean {
  try {
    return YT_HOSTS.has(new URL(url, 'http://placeholder.local').hostname.toLowerCase());
  } catch {
    return false;
  }
}

// `youtube.com/(embed|v|shorts)/<id>` — anchored, no `.*`, ReDoS-safe.
const YT_PATH_RE = /^\/(?:embed|v|shorts)\/([^/]+)\/?$/;

// Bare 11-char YouTube id — base62 alphabet `[A-Za-z0-9_-]`.
// Anchored, no `.*`, ReDoS-safe; rejects anything that contains `/` or `:`.
const BARE_YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extract the YouTube video id from any common URL shape OR from a
 * bare 11-char id (carousels and some admin shapes pass that form
 * directly).
 *
 * Uses strict `URL` parsing + an anchored pathname regex — NOT the
 * legacy `.*v=` pattern that CodeQL flagged for polynomial-time
 * backtracking on adversarial input like `youtube.com/watch?`
 * repeated N times. Bare-id fallback uses an anchored character-class
 * regex so it can never ReDoS either.
 *
 * Exported so admin tooling and carousel thumbnail logic can validate
 * a URL without rendering the full `<Video>` component.
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  // Bare-id form first — `new URL('dQw4w9WgXcQ')` throws, so this MUST
  // run before the URL parse. The 11-char anchored regex rejects URLs
  // (which always contain `:` or `/`).
  if (BARE_YT_ID_RE.test(url)) return url;
  let u: URL;
  // Match `isYouTubeUrl`'s relative-safe parsing — a base URL with a
  // placeholder origin lets us handle protocol-relative inputs (`//youtube.com/...`)
  // and protocol-less inputs (`youtube.com/...`) without throwing.
  try { u = new URL(url, 'http://placeholder.local'); } catch { return null; }
  if (!YT_HOSTS.has(u.hostname.toLowerCase())) return null;
  // `youtu.be/<id>` — id is the first non-empty path segment.
  if (u.hostname.toLowerCase().endsWith('youtu.be')) {
    return u.pathname.split('/').filter(Boolean)[0] ?? null;
  }
  // `youtube.com/watch?v=<id>` — query parameter.
  const v = u.searchParams.get('v');
  if (v) return v;
  // `youtube.com/(embed|v|shorts)/<id>` — anchored pathname match.
  const m = u.pathname.match(YT_PATH_RE);
  return m ? m[1] : null;
}

// =============================================================================
// Props
// =============================================================================

export type VideoLayout = 'centered' | 'fill' | 'native';

interface VideoCommonProps {
  /** Layout wrapper. Detail pages pass `"centered"`. Default `"native"`. */
  layout?: VideoLayout;
  /** Poster / thumbnail. */
  poster?: string | null;
  /** Mute by default — for autoplay carousels. */
  muted?: boolean;
  /** LCP hint — YouTube facade poster gets `fetchpriority="high"`. */
  priority?: boolean;
  /** Tailwind classes applied to the underlying player root. */
  className?: string;
  /** Accessible label (used as YT facade title; ignored for file branch). */
  title?: string;
  /**
   * YouTube-only: hide YT player chrome (controls, info, fullscreen, related
   * videos, keyboard shortcuts). Used for marketing/landing-page embeds that
   * want a minimal look. No-op for file (MP4/HLS) branches.
   */
  minimalControls?: boolean;
}

interface VideoFileProps extends VideoCommonProps {
  kind: 'file';
  url: string;
  /**
   * SRT raw content. Deprecated: pass `captionsUrl` (VTT) instead.
   * Native `<track>` requires a URL; raw SRT can't be rendered without
   * a custom overlay. Setting this without `captionsUrl` is a no-op
   * with a dev warning.
   */
  srtContent?: string | null;
  /** HTTPS URL to a VTT captions file. Rendered as a native `<track>`. */
  captionsUrl?: string | null;
  /** Autoplay muted on mount (forwarded as MuxPlayer `autoPlay="muted"`) — hover-preview surfaces. */
  autoPlay?: boolean;
  /** Loop playback — short bite previews. */
  loop?: boolean;
  /** Hide all player chrome (MuxPlayer `--controls: none`) — chromeless preview mode. */
  chromeless?: boolean;
  /** Play while the pointer hovers the player, pause on leave. Tries WITH
   *  sound at 50% volume first (bite-strip behavior); falls back to muted when
   *  the browser's autoplay policy rejects unmuted hover playback. */
  playOnHover?: boolean;
  /** CONTROLLED variant of playOnHover: the host owns the hover state (e.g.
   *  the bite-strip card, whose overlay also counts as "hovering the card").
   *  true → start hover playback, false → pause. When provided, the internal
   *  pointer handlers are disabled. */
  playWhenHovered?: boolean;
  /** Hide the bottom control bar, keep only the CENTER play/pause control
   *  (bite-strip cards per Figma). */
  centerControlsOnly?: boolean;
}

interface VideoYouTubeProps extends VideoCommonProps {
  kind: 'youtube';
  /** Either a full YT URL or just the video id. */
  url: string;
}

interface VideoAutoProps extends VideoCommonProps {
  kind?: 'auto';
  url: string;
  srtContent?: string | null;
  captionsUrl?: string | null;
  /** See VideoFileProps — no-ops when the URL resolves to the YouTube branch. */
  autoPlay?: boolean;
  loop?: boolean;
  chromeless?: boolean;
  playOnHover?: boolean;
  playWhenHovered?: boolean;
  centerControlsOnly?: boolean;
}

export type VideoProps = VideoFileProps | VideoYouTubeProps | VideoAutoProps;

// =============================================================================
// Component
// =============================================================================

export function Video(props: VideoProps): React.ReactElement | null {
  const url = props.url;
  if (!url) return null;

  const effectiveKind = resolveKind(props, url);
  const layout = props.layout ?? 'native';

  const inner =
    effectiveKind === 'youtube' ? (
      <YouTubeFacade
        url={url}
        title={props.title}
        priority={props.priority}
        className={props.className}
        minimalControls={props.minimalControls}
      />
    ) : (
      <FilePlayer
        url={url}
        poster={props.poster}
        muted={props.muted}
        srtContent={'srtContent' in props ? props.srtContent : null}
        captionsUrl={'captionsUrl' in props ? props.captionsUrl : null}
        autoPlay={'autoPlay' in props ? props.autoPlay : undefined}
        loop={'loop' in props ? props.loop : undefined}
        chromeless={'chromeless' in props ? props.chromeless : undefined}
        playOnHover={'playOnHover' in props ? props.playOnHover : undefined}
        playWhenHovered={'playWhenHovered' in props ? props.playWhenHovered : undefined}
        centerControlsOnly={'centerControlsOnly' in props ? props.centerControlsOnly : undefined}
        className={props.className}
      />
    );

  return wrapWithLayout(inner, layout);
}

// =============================================================================
// Internals — never imported by call sites; `<Video>` is the only entry.
// =============================================================================

/**
 * Resolve the rendering branch. `'auto'` (or no `kind`) inspects the URL:
 * YouTube host (or a bare 11-char video id) → 'youtube', anything else →
 * 'file' (HLS / MP4 both handled by MuxPlayer). Type-safe — no `as` casts.
 */
function resolveKind(props: VideoProps, url: string): 'youtube' | 'file' {
  if ('kind' in props) {
    if (props.kind === 'youtube') return 'youtube';
    if (props.kind === 'file') return 'file';
    // kind === 'auto' falls through to URL-based detection
  }
  // Bare 11-char YouTube id — use the same anchored regex as
  // `extractYouTubeId` so both code paths agree on which strings are
  // bare ids vs. URLs (avoids the regression where `videos/clip`
  // length-11 strings were mis-routed to YouTube).
  if (BARE_YT_ID_RE.test(url)) return 'youtube';
  return isYouTubeUrl(url) ? 'youtube' : 'file';
}

function wrapWithLayout(
  inner: React.ReactElement,
  layout: VideoLayout,
): React.ReactElement {
  switch (layout) {
    case 'centered':
      // `aspect-video` (16:9) reserves the box from first paint so MuxPlayer
      // doesn't flicker tiny→full while video metadata loads. Both branches
      // are sized to fill 100% of this container (MuxPlayer via `style`,
      // YouTube facade via internal `paddingBottom: 56.25%` which compounds
      // harmlessly inside an already-16:9 box). `rounded-lg overflow-hidden
      // border border-ods-border` is on the wrapper (not the inner) so BOTH
      // branches end up with the same rounded card look — YouTube's facade
      // also paints its own internal rounded-lg on the button + iframe,
      // matching the outer radius (so the corners stay sharp through the
      // poster → iframe transition); MuxPlayer renders flat and inherits
      // the wrapper's rounded corners via `overflow-hidden` clipping.
      return (
        <div className="flex justify-center w-full">
          <div className="w-full max-w-3xl aspect-video rounded-lg overflow-hidden border border-ods-border">{inner}</div>
        </div>
      );
    case 'fill':
      return <div className="absolute inset-0 w-full h-full">{inner}</div>;
    case 'native':
    default:
      // `native` callers (blog cards etc.) are
      // expected to provide their own aspect-ratio container so the layout
      // primitive doesn't override portrait/square/landscape bites with 16:9.
      return inner;
  }
}

// -----------------------------------------------------------------------------
// File branch — MuxPlayer (handles both .m3u8 HLS and plain .mp4)
// -----------------------------------------------------------------------------

interface FilePlayerProps {
  url: string;
  poster?: string | null;
  muted?: boolean;
  srtContent?: string | null;
  captionsUrl?: string | null;
  autoPlay?: boolean;
  loop?: boolean;
  chromeless?: boolean;
  playOnHover?: boolean;
  playWhenHovered?: boolean;
  centerControlsOnly?: boolean;
  className?: string;
}

function FilePlayer({
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
  centerControlsOnly,
  className,
}: FilePlayerProps): React.ReactElement {
  // centerControlsOnly: the center play button shows at REST only — while
  // playing, ALL chrome hides (no pause sign over the hover-preview).
  const [isPlaying, setIsPlaying] = useState(false);
  // playOnHover drives the underlying mux-player element imperatively — the
  // element exposes native play()/pause()/muted/volume; the chrome stays as
  // configured. Sound-first: volume 0.5 unmuted, muted fallback when the
  // browser's autoplay policy rejects unmuted hover playback (hover is not a
  // user gesture in Chrome's activation model).
  const hoverPlayerRef = useRef<{
    play?: () => Promise<void> | void;
    pause?: () => void;
    muted?: boolean;
    volume?: number;
  } | null>(null);
  // Tracks whether the pointer is STILL over the player. A fast hover-out
  // pauses the in-flight play(), which rejects it with AbortError — that must
  // NOT trigger the muted retry (it would restart playback after the pointer
  // left, with no visible control to stop it). Only a genuine autoplay-policy
  // rejection (NotAllowedError) while still hovered retries muted.
  const hoverActiveRef = useRef(false);
  // Per-enter generation token: a LATE NotAllowedError from a previous enter
  // must not fire the muted fallback into a newer (intended-sound) session.
  const hoverGenerationRef = useRef(0);
  const startHoverPlayback = useCallback(() => {
    hoverActiveRef.current = true;
    const generation = ++hoverGenerationRef.current;
    const el = hoverPlayerRef.current;
    if (!el) return;
    try {
      el.volume = 0.5;
      if (userHasInteracted) {
        // Post-activation: unmuted playback is allowed — play with sound.
        // The NotAllowedError guard stays as a belt-and-suspenders fallback;
        // a fast hover-out's pause() rejects with AbortError and must not
        // restart playback (name mismatch + cleared hoverActiveRef).
        el.muted = false;
        (el.play?.() as Promise<void> | undefined)?.catch?.((err: unknown) => {
          const name = (err as { name?: string } | null)?.name;
          if (
            name === 'NotAllowedError' &&
            hoverActiveRef.current &&
            generation === hoverGenerationRef.current
          ) {
            try {
              el.muted = true;
              (el.play?.() as Promise<void> | undefined)?.catch?.(() => {});
            } catch { /* give up silently */ }
          }
        });
      } else {
        // Pre-activation: unmuted WOULD be rejected (hover isn't a gesture in
        // Chrome's activation model) — start muted immediately with no
        // rejection round-trip, and UNMUTE LIVE the instant the user's first
        // click/keydown lands anywhere while this hover is still active.
        el.muted = true;
        (el.play?.() as Promise<void> | undefined)?.catch?.(() => {});
        activationWaiters.add(() => {
          if (hoverActiveRef.current && generation === hoverGenerationRef.current) {
            try { el.muted = false; el.volume = 0.5; } catch { /* ignore */ }
          }
        });
      }
    } catch { /* ignore */ }
  }, []);
  const stopHoverPlayback = useCallback(() => {
    hoverActiveRef.current = false;
    try { hoverPlayerRef.current?.pause?.(); } catch { /* already torn down */ }
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
  // Raw SRT text is unusable without a custom overlay — and we just deleted
  // the 900-LOC custom-controls layer that owned that overlay. Consumers
  // pass `captionsUrl` (the API-side VTT conversion) alongside `srtContent`
  // anyway. Warn in dev if the deprecated prop is the only one supplied
  // so a single-prop call site doesn't silently lose captions.
  if (process.env.NODE_ENV !== 'production' && srtContent && !captionsUrl) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Video] srtContent supplied without captionsUrl — captions will not render. ' +
      'Pass captionsUrl (the VTT URL) instead; raw SRT text overlays are no longer supported.',
    );
  }

  const player = (
    <MuxPlayer
      ref={hoverPlayerRef as React.Ref<never>}
      onPlay={centerControlsOnly ? () => setIsPlaying(true) : undefined}
      onPause={centerControlsOnly ? () => setIsPlaying(false) : undefined}
      src={url}
      poster={poster || undefined}
      streamType="on-demand"
      playsInline
      muted={muted}
      preferCmcd="header"
      // MuxPlayer's built-in default is `#fa50b5` (Mux brand pink) — when
      // its `--media-accent-color` resolves to nothing the player falls
      // through to that hardcoded pink. The `var(--ods-accent,
      // var(--color-accent-primary))` chain hits the platform-aware
      // ODS token first, then the semantic accent alias if `--ods-accent`
      // is ever undefined on a `data-app-type` we haven't themed yet.
      // NEVER let Mux pink leak onto a non-Flamingo platform.
      accentColor="var(--ods-accent, var(--color-accent-primary))"
      autoPlay={autoPlay ? 'muted' : undefined}
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
      style={{
        width: '100%',
        height: '100%',
        ...(chromeless ? ({ '--controls': 'none' } as React.CSSProperties) : {}),
        ...(centerControlsOnly && !chromeless
          ? ({
              '--bottom-controls': 'none',
              '--top-controls': 'none',
              // While playing, hide the center control too — no pause sign
              // over the hover-preview; it reappears when playback pauses.
              ...(isPlaying ? { '--center-controls': 'none' } : {}),
            } as React.CSSProperties)
          : {}),
      }}
    >
      {captionsUrl ? (
        <track
          kind="captions"
          src={captionsUrl}
          srcLang="en"
          label="English"
          default
        />
      ) : null}
    </MuxPlayer>
  );

  // MuxPlayerProps has no pointer-event props — the hover-play handlers live
  // on a full-size wrapper instead (only in UNCONTROLLED playOnHover mode;
  // controlled playWhenHovered hosts own their hover detection).
  if (playOnHover && !hoverControlled) {
    return (
      <div
        className="w-full h-full"
        onPointerEnter={handleHoverEnter}
        onPointerLeave={handleHoverLeave}
      >
        {player}
      </div>
    );
  }
  return player;
}

// -----------------------------------------------------------------------------
// YouTube facade — inlined lite-youtube-embed pattern
// -----------------------------------------------------------------------------

interface YouTubeFacadeProps {
  url: string;
  title?: string;
  priority?: boolean;
  className?: string;
  minimalControls?: boolean;
}

function YouTubeFacade({
  url,
  title = 'YouTube Video',
  priority,
  className,
  minimalControls,
}: YouTubeFacadeProps): React.ReactElement | null {
  // `extractYouTubeId` handles both bare 11-char ids AND full URLs in a
  // single call site, so the resolution logic lives in exactly one place.
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return <YouTubeFacadeInner videoId={videoId} title={title} priority={priority} className={className} minimalControls={minimalControls} />;
}

interface YouTubeFacadeInnerProps {
  videoId: string;
  title: string;
  priority?: boolean;
  className?: string;
  minimalControls?: boolean;
}

const YT_NOCOOKIE_ORIGIN = 'https://www.youtube-nocookie.com';

// YouTube IFrame Player API state codes — documented integers.
// https://developers.google.com/youtube/iframe_api_reference#Playback_status
const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;

// Sub-second delay before we blur the iframe after PLAYING. Zero would
// cancel YouTube's mount-time "controls visible" intro flash entirely
// (jarring); ~1s lets the user briefly see playback started, then we
// kick YouTube's internal idle timer by removing DOM focus from the
// iframe. Net result: controls fade ~1s after playback begins,
// matching the user-locked target.
const YT_PLAYING_BLUR_DELAY_MS = 1000;

interface YouTubeInfoDeliveryMessage {
  event?: string;
  info?: { playerState?: number };
}

function YouTubeFacadeInner({
  videoId,
  title,
  priority,
  className,
  minimalControls,
}: YouTubeFacadeInnerProps): React.ReactElement {
  const [activated, setActivated] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Embed URL + poster URLs only change when `videoId` or `minimalControls`
  // do — memoize so we don't rebuild URLSearchParams on every render.
  //
  // `enablejsapi=1` opens the postMessage state channel we subscribe to
  // below — without it, YouTube ignores `event:listening` messages and
  // we can't detect PLAYING / ENDED to drive the auto-hide accelerator.
  //
  // `origin=<parent-page-origin>` is REQUIRED when `enablejsapi=1` is set.
  // Without it, the YouTube widget inside the iframe defaults its
  // `postMessage` targetOrigin to its OWN origin (`youtube-nocookie.com`)
  // when emitting state-change events back to the parent. The browser
  // then drops every message and logs:
  //   "Failed to execute 'postMessage' on 'DOMWindow': The target origin
  //   provided ('https://www.youtube-nocookie.com') does not match the
  //   recipient window's origin ('https://www.<our-site>')"
  // Setting `origin` tells the widget the real parent host so it sends
  // with the matching targetOrigin. Documented in YouTube's IFrame Player
  // API reference (developers.google.com/youtube/iframe_api_reference).
  // SSR-safe: the URL is rebuilt client-side in the same useMemo on
  // hydration when `window` becomes available; the first SSR pass emits
  // the URL without `origin` (no jsapi traffic yet — no iframe mounted).
  const { embedUrl, posterJpg, posterWebp } = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '1',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
    });
    if (typeof window !== 'undefined') {
      params.set('origin', window.location.origin);
    }
    if (minimalControls) {
      params.set('controls', '0');
      params.set('fs', '0');
      params.set('iv_load_policy', '3');
      params.set('cc_load_policy', '0');
      params.set('disablekb', '1');
    }
    return {
      embedUrl: `${YT_NOCOOKIE_ORIGIN}/embed/${videoId}?${params.toString()}`,
      posterJpg: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      posterWebp: `https://i.ytimg.com/vi_webp/${videoId}/mqdefault.webp`,
    };
  }, [videoId, minimalControls]);

  // ---------------------------------------------------------------------------
  // YouTube control-fade accelerator (user-locked target: ~1s).
  //
  // YouTube's native idle timer for the bottom control bar is 5–10s when
  // the iframe holds DOM focus. The IFrame Player API has no public
  // `hideControls` command (full `func` list verified — none expose
  // visibility). The one legal lever from outside the iframe is
  // `iframe.blur()`, which kicks YouTube into its post-focus idle path
  // (~2s minimum).
  //
  // Subscribe to YouTube's state channel via the documented lite-mode
  // postMessage handshake — no full `iframe_api.js` library needed:
  // <https://developers.google.com/youtube/iframe_api_reference>.
  //
  //   - PLAYING (1) arrives once autoplay kicks in. Wait ~1s (so the user
  //     briefly sees that the player started), then blur the iframe so
  //     YouTube's idle timer fires immediately.
  //
  //   - ENDED (0) → tear down the iframe. Playback is already over so
  //     there's nothing to interrupt, and removing the iframe kills the
  //     residual "More videos" suggestion grid YouTube leaves on screen.
  //
  // PAUSED (2) is deliberately unhandled — the user paused on purpose,
  // leave YouTube's UI alone so they can resume.
  //
  // Playback is NEVER stopped by anything in this facade. Outside-click,
  // Escape, tab-switch — all no-ops. The only state flip is on natural
  // end-of-video (ENDED).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!activated) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    function subscribe() {
      iframe?.contentWindow?.postMessage(
        '{"event":"listening"}',
        YT_NOCOOKIE_ORIGIN,
      );
    }

    iframe.addEventListener('load', subscribe);
    subscribe();

    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    function handleMessage(event: MessageEvent) {
      if (event.origin !== YT_NOCOOKIE_ORIGIN) return;
      if (typeof event.data !== 'string') return;
      let payload: YouTubeInfoDeliveryMessage | null = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload || payload.event !== 'infoDelivery') return;
      const state = payload.info?.playerState;
      if (typeof state !== 'number') return;

      if (state === YT_STATE_PLAYING) {
        if (blurTimer !== null) return;
        blurTimer = setTimeout(() => {
          blurTimer = null;
          iframeRef.current?.blur();
        }, YT_PLAYING_BLUR_DELAY_MS);
        return;
      }
      if (state === YT_STATE_ENDED) {
        setActivated(false);
      }
    }

    window.addEventListener('message', handleMessage);
    return () => {
      iframe.removeEventListener('load', subscribe);
      window.removeEventListener('message', handleMessage);
      if (blurTimer !== null) clearTimeout(blurTimer);
    };
  }, [activated]);

  const wrapperClass = `relative w-full ${className ?? ''}`;
  const wrapperStyle = { paddingBottom: '56.25%' as const };

  if (activated) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <iframe
          ref={iframeRef}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          title={title}
          className="absolute inset-0 w-full h-full border-0 rounded-lg"
        />
      </div>
    );
  }

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      <button
        type="button"
        aria-label={`Play: ${title}`}
        onClick={() => setActivated(true)}
        className="group absolute inset-0 p-0 m-0 border border-ods-border rounded-lg overflow-hidden bg-ods-card cursor-pointer"
      >
        <picture>
          <source type="image/webp" srcSet={posterWebp} />
          <img
            src={posterJpg}
            alt={title}
            loading="lazy"
            // React 18 wants lowercase (`fetchpriority` DOM attribute);
            // React 19 wants camelCase (`fetchPriority` prop). Detect at
            // module load and spread the right shape so both runtimes
            // render the DOM attribute cleanly with no console warnings.
            {...fetchPriorityProp(priority)}
            decoding={priority ? 'sync' : 'async'}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 flex items-center justify-center bg-ods-bg-inverse bg-opacity-20 transition-opacity duration-200 group-hover:bg-opacity-30">
          <span className="flex items-center justify-center w-16 h-16 rounded-full bg-ods-accent text-ods-text-on-accent shadow-lg transition-transform duration-200 group-hover:scale-110">
            <PlayIcon size={24} color="currentColor" className="ml-1" />
          </span>
        </div>
      </button>
    </div>
  );
}
