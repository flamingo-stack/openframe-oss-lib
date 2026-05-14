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

import React, { useEffect, useRef, useState } from 'react';
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
  // Wrapper ref used by the outside-click dismissal — clicks inside this
  // box keep the iframe mounted; clicks anywhere else tear the iframe
  // down so YouTube's persistent native controls go with it.
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const embedParams = new URLSearchParams({
    autoplay: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  if (minimalControls) {
    embedParams.set('controls', '0');
    embedParams.set('showinfo', '0');
    embedParams.set('fs', '0');
    embedParams.set('iv_load_policy', '3');
    embedParams.set('cc_load_policy', '0');
    embedParams.set('disablekb', '1');
  }
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${embedParams.toString()}`;
  const posterJpg = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  const posterWebp = `https://i.ytimg.com/vi_webp/${videoId}/mqdefault.webp`;

  // Outside-click dismissal — when the iframe is mounted, listen for any
  // pointerdown on the document. Clicks INSIDE the wrapper bubble through
  // the iframe DOM element but never reach our handler when they occur on
  // YouTube's own UI (the iframe is a separate browsing context, so
  // pointer events fired inside it don't propagate to our document).
  // Clicks OUTSIDE the wrapper fire here normally — we tear down the
  // iframe by flipping `activated` to false. The iframe unmounts, taking
  // YouTube's persistent native controls with it. A second click on the
  // play poster re-mounts the iframe with `autoplay=1` (a user gesture,
  // so iOS Safari + Chrome autoplay restrictions are satisfied).
  //
  // We hook `pointerdown` (not `click`) so the dismissal feels instant —
  // by the time `click` fires the user has already seen the controls
  // overlay another beat.
  useEffect(() => {
    if (!activated) return;

    function handleOutsideClick(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;
      setActivated(false);
    }

    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [activated]);

  // Escape-key dismissal — keyboard users should have parity with the
  // pointer outside-click. Same tear-down semantics.
  useEffect(() => {
    if (!activated) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setActivated(false);
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activated]);

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
    return (
      <div ref={wrapperRef} className={wrapperClass} style={wrapperStyle}>
        <iframe
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
    <div ref={wrapperRef} className={wrapperClass} style={wrapperStyle}>
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
