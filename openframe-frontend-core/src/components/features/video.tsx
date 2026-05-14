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
      // harmlessly inside an already-16:9 box).
      return (
        <div className="flex justify-center w-full">
          <div className="w-full max-w-3xl aspect-video">{inner}</div>
        </div>
      );
    case 'fill':
      return <div className="absolute inset-0 w-full h-full">{inner}</div>;
    case 'native':
    default:
      // `native` callers (LazyBite in `<VideoBitesDisplay>`, blog cards) are
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
  className?: string;
}

function FilePlayer({
  url,
  poster,
  muted,
  srtContent,
  captionsUrl,
  className,
}: FilePlayerProps): React.ReactElement {
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

  return (
    <MuxPlayer
      src={url}
      poster={poster || undefined}
      streamType="on-demand"
      playsInline
      muted={muted}
      preferCmcd="header"
      accentColor="var(--ods-accent)"
      className={className}
      // Fill the wrapping aspect-ratio container instead of MuxPlayer's
      // intrinsic size. Without this, MuxPlayer renders at its default
      // dimensions before video metadata loads, then grows to its
      // metadata-derived size — that's the "starts super small and
      // flickers and grows" CLS we're killing. With `aspect-video` on
      // the centered wrapper and `width/height: 100%` here, the box is
      // 16:9 from first paint and stays put.
      style={{ width: '100%', height: '100%' }}
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

function YouTubeFacadeInner({
  videoId,
  title,
  priority,
  className,
  minimalControls,
}: YouTubeFacadeInnerProps): React.ReactElement {
  const [activated, setActivated] = useState(false);
  // Wrapper hosts BOTH the play button (pre-activation) and the iframe
  // (post-activation). `tabIndex={-1}` is critical: it makes the wrapper
  // programmatically focusable so we can park focus there on outside
  // click, defeating YouTube's "keep controls visible while iframe is
  // focused" behavior. Without that, blurring the iframe just sends
  // focus to <body> and iOS Safari sometimes treats it as if focus
  // never left.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Embed URL + poster URLs only change when `videoId` or `minimalControls`
  // do — memoize so we don't rebuild URLSearchParams on every render.
  const { embedUrl, posterJpg, posterWebp } = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '1',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
    });
    if (minimalControls) {
      params.set('controls', '0');
      params.set('showinfo', '0');
      params.set('fs', '0');
      params.set('iv_load_policy', '3');
      params.set('cc_load_policy', '0');
      params.set('disablekb', '1');
    }
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`,
      posterJpg: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      posterWebp: `https://i.ytimg.com/vi_webp/${videoId}/mqdefault.webp`,
    };
  }, [videoId, minimalControls]);

  // ---------------------------------------------------------------------------
  // Hide YouTube's persistent controls without pausing the video.
  //
  // Why this works (researched against the YouTube IFrame Player API + Media
  // Chrome conventions used by Mux Player):
  //
  //   YouTube's iframe player keeps the bottom control bar visible as long
  //   as the iframe holds DOM focus (`document.activeElement === iframe`).
  //   That's why clicking elsewhere on the page doesn't auto-hide them — the
  //   pointer leaves, but focus stays, so YouTube treats the player as
  //   "still being interacted with."
  //
  //   The YouTube postMessage API has NO `hideControls`/`blur` command — we
  //   verified the full `func` list (playVideo, pauseVideo, seekTo,
  //   getCurrentTime, addEventListener, …, none expose control visibility).
  //   But blurring the iframe via the standard DOM `blur()` triggers
  //   YouTube's internal idle timer (~3s) and the bar fades out — same
  //   feel as Mux Player's Media Chrome `autohide="2"`.
  //
  //   We park focus on the wrapper (`tabIndex={-1}`) rather than letting it
  //   fall through to <body> — iOS Safari is finicky about reading
  //   `document.activeElement` after a bare `blur()`, and the explicit
  //   focus parent is the documented workaround.
  //
  //   The video is NEVER paused (we don't call the `pauseVideo` postMessage
  //   command). Outside-click = "remove the visual overlay", not "stop
  //   playing".
  //
  //   Pointer events INSIDE the iframe never fire on `document` (separate
  //   browsing context, cross-origin policy) — so YouTube's own interactions
  //   pass through cleanly. Only genuine outside clicks trigger the blur.
  // ---------------------------------------------------------------------------
  const hideYouTubeControls = useCallback(() => {
    const iframe = iframeRef.current;
    const wrapper = wrapperRef.current;
    if (!iframe || !wrapper) return;
    // Only do the focus shuffle when the iframe actually holds focus.
    // Otherwise YouTube's controls are already in their idle / mouse-leave
    // state and this call would just steal focus from whatever else has
    // it (e.g. an unrelated modal whose Escape just closed it). The guard
    // makes all three triggers (outside pointerdown / Escape / tab-restore)
    // no-ops when there's nothing to fix.
    if (document.activeElement !== iframe) return;
    iframe.blur();
    // Defensive: if browser has a stale activeElement (iOS Safari quirk),
    // explicitly park focus on the tabIndex=-1 wrapper so YouTube's
    // post-blur state is unambiguous.
    wrapper.focus({ preventScroll: true });
  }, []);

  // Outside-pointerdown — pointer surface for the auto-hide gesture. Capture
  // phase so we react BEFORE any consumer's click handlers; the blur happens
  // in the same tick as the gesture that triggered it, so there's no
  // perceptible delay between clicking outside and the fade starting.
  useEffect(() => {
    if (!activated) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      // `instanceof Node` narrows EventTarget cleanly — no `as` cast needed,
      // and skips the case where target is null or a non-DOM type (rare but
      // possible for synthetic events / browser test harnesses).
      const target = event.target;
      if (!(target instanceof Node)) return;
      const wrapper = wrapperRef.current;
      if (!wrapper || wrapper.contains(target)) return;
      hideYouTubeControls();
    }

    document.addEventListener('pointerdown', handleOutsidePointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
  }, [activated, hideYouTubeControls]);

  // Escape-key parity — keyboard surface for the same auto-hide gesture.
  // Capture phase matches the pointerdown handler so a parent modal /
  // dropdown that swallows Escape on bubble doesn't starve us.
  //
  // Scope note: Escape pressed INSIDE the cross-origin iframe does NOT
  // bubble up to our document — browser security isolates keyboard events
  // to the iframe's own document when focus is inside it. This handler
  // covers the case where the user has already moved focus OUT of the
  // iframe (e.g. by clicking elsewhere) and then presses Escape; YouTube's
  // native Escape-to-exit-fullscreen handles the in-iframe case.
  useEffect(() => {
    if (!activated) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') hideYouTubeControls();
    }

    document.addEventListener('keydown', handleEscape, true);
    return () => document.removeEventListener('keydown', handleEscape, true);
  }, [activated, hideYouTubeControls]);

  // Tab-visibility — when the user backgrounds the tab and returns, browsers
  // can leave the iframe in an inconsistent focus state and YouTube may
  // re-show its bar. Re-running the focus shuffle on visibility-restore
  // keeps parity with Mux Player's autohide behavior across tab cycles.
  //
  // `requestAnimationFrame` defers the shuffle past YouTube's own
  // post-visibility-change re-focus tick — without it, our blur runs first,
  // YouTube re-focuses on the next microtask, and the bar reappears.
  useEffect(() => {
    if (!activated) return;

    let frameId: number | null = null;

    function handleVisibility() {
      if (document.visibilityState !== 'visible') return;
      if (frameId !== null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => {
        frameId = null;
        hideYouTubeControls();
      });
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [activated, hideYouTubeControls]);

  // Early-return rendering. The previous imperative implementation
  // (`document.createElement('iframe')` + state flip) had a subtle bug
  // where the play-button overlay could linger past activation because
  // React's commit phase and the imperative DOM mutation raced. Two
  // mutually-exclusive return paths eliminate that race entirely — when
  // `activated` flips, React unmounts the button branch and mounts the
  // iframe branch in a single commit.
  //
  // Autoplay on iOS Safari: the user gesture (the button's onClick) and
  // the iframe mount happen in the SAME React commit, which flushes
  // synchronously inside event handlers. iOS treats the iframe insertion
  // as still being inside the user-activation tick, so `autoplay=1` plays.
  // (Verified empirically; lite-youtube-embed uses imperative DOM for
  // legacy-React compatibility — modern React's sync-commit-on-event
  // makes the JSX path equivalent.)
  const wrapperClass = `relative w-full ${className ?? ''}`;
  const wrapperStyle = { paddingBottom: '56.25%' as const };

  if (activated) {
    // `[&:focus-visible]:outline-none` is scoped to the wrapper element
    // itself (via the `&:` attribute selector) — descendants keep their
    // own focus rings. The wrapper is a presentational programmatic focus
    // target (we park focus here after `iframe.blur()` to defeat
    // YouTube's "keep controls visible while iframe is focused"
    // behavior), so its ring would be visual noise; the iframe, on the
    // other hand, is the real focus surface for keyboard play/pause
    // hotkeys and gets its native ring untouched. The pre-activation
    // branch below doesn't need this class because the <button> child
    // owns its own focus ring there.
    return (
      <div
        ref={wrapperRef}
        className={`${wrapperClass} [&:focus-visible]:outline-none`}
        style={wrapperStyle}
        tabIndex={-1}
      >
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
    <div ref={wrapperRef} className={wrapperClass} style={wrapperStyle} tabIndex={-1}>
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
            fetchPriority={priority ? 'high' : 'low'}
            decoding={priority ? 'sync' : 'async'}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 flex items-center justify-center bg-ods-bg-inverse bg-opacity-20 transition-opacity duration-200 group-hover:bg-opacity-30">
          <span className="flex items-center justify-center w-16 h-16 rounded-full bg-ods-accent text-ods-text-on-accent shadow-lg transition-transform duration-200 group-hover:scale-110">
            <svg width={24} height={24} fill="currentColor" viewBox="0 0 24 24" className="ml-1">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </span>
        </div>
      </button>
    </div>
  );
}
