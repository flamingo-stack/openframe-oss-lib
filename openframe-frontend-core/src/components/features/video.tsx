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

import React, { useRef, useState } from 'react';
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
      return (
        <div className="flex justify-center w-full">
          <div className="w-full max-w-3xl">{inner}</div>
        </div>
      );
    case 'fill':
      return <div className="absolute inset-0 w-full h-full">{inner}</div>;
    case 'native':
    default:
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
  // `iframeSlotRef` is a JSX-empty div React owns but never reconciles
  // children into; the `<button>` overlay is a SIBLING of that slot, not
  // a child. Without that split, React would yank the button on re-render
  // and trip `removeChild ... is not a child of this node`.
  const iframeSlotRef = useRef<HTMLDivElement | null>(null);

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

  // Imperative createElement preserves the user-activation chain on
  // Chrome/Safari/Firefox so `autoplay=1` plays on click.
  const handleActivate = () => {
    const slot = iframeSlotRef.current;
    if (!slot || activated) return;
    const iframe = document.createElement('iframe');
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    );
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('title', title);
    iframe.className = 'absolute inset-0 w-full h-full border-0';
    iframe.src = embedUrl;
    slot.appendChild(iframe);
    setActivated(true);
  };

  return (
    <div className={`relative w-full ${className ?? ''}`} style={{ paddingBottom: '56.25%' }}>
      <div className="absolute inset-0 rounded-lg overflow-hidden border border-ods-border bg-ods-card">
        <div ref={iframeSlotRef} className="absolute inset-0" aria-hidden={!activated} />
        {!activated && (
          <button
            type="button"
            aria-label={`Play: ${title}`}
            onClick={handleActivate}
            className="group absolute inset-0 p-0 m-0 border-0 cursor-pointer bg-transparent"
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
        )}
      </div>
    </div>
  );
}
