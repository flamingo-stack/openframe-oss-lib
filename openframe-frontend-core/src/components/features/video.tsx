'use client';

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
import type React from 'react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from '../../embed-shims/next-dynamic';
import { useNearViewport } from '../../hooks/use-near-viewport';
import { fetchPriorityProp } from '../../utils/fetch-priority';
import { VideoPlayBadge } from './video-center-badge';
import type { FilePlayerProps } from './video-file-player';
import {
  pickFilePlayback,
  pickYouTube,
  reportPlaybackFailure,
  VideoErrorOverlay,
  type VideoLayout,
  type VideoProps,
  type VideoYouTubeFacadeProps,
} from './video-shared';

export {
  VIDEO_PLAYBACK_FAILED_EVENT,
  type VideoFailureKind,
  type VideoFailureReason,
  type VideoLayout,
  type VideoMutedFallbackState,
  type VideoPlaybackFailureDetail,
  type VideoPlayerHandle,
  type VideoProps,
} from './video-shared';

/**
 * The Mux player, fetched when a file video is drawn and not before: the
 * player and hls.js are the largest script a page can load, and most pages
 * draw no file video.
 */
const loadFilePlayer = () => import('./video-file-player');
const LazyFilePlayer = dynamic<FilePlayerProps>(loadFilePlayer);

/** The player's box while its module loads: the poster at the player's own size, so nothing moves. */
function FilePlayerFallback({ poster, className }: { poster?: string | null; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: '100%',
        height: '100%',
        ...(poster ? { backgroundImage: `url(${poster})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
      }}
    />
  );
}

function FilePlayer(props: FilePlayerProps): React.ReactElement {
  return (
    <Suspense fallback={<FilePlayerFallback poster={props.poster} className={props.className} />}>
      <LazyFilePlayer {...props} />
    </Suspense>
  );
}

// =============================================================================
// URL classifiers (private — `<Video>` is the only consumer)
// =============================================================================

const YT_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
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
  try {
    u = new URL(url, 'http://placeholder.local');
  } catch {
    return null;
  }
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
// Component
// =============================================================================

export function Video(props: VideoProps): React.ReactElement | null {
  // Hooks run unconditionally; the gate only applies when `lazy` is set.
  const { ref: nearRef, isNear } = useNearViewport<HTMLDivElement>();
  const url = props.url;
  if (!url) return null;

  const effectiveKind = resolveKind(props, url);
  const layout = props.layout ?? 'native';

  if (props.lazy && !isNear) {
    // Same box, poster only: the observer target IS the reserved space.
    return wrapWithLayout(
      <div
        ref={nearRef}
        className={props.className}
        style={
          props.poster
            ? { backgroundImage: `url(${props.poster})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
        aria-hidden="true"
      />,
      layout,
    );
  }

  const inner =
    effectiveKind === 'youtube' ? (
      <YouTubeFacade
        url={url}
        title={props.title}
        priority={props.priority}
        className={props.className}
        minimalControls={props.minimalControls}
        muted={props.muted}
        {...pickYouTube(props)}
      />
    ) : 'firstFrameOnly' in props && props.firstFrameOnly ? (
      <FirstFramePreview
        url={url}
        poster={props.poster}
        fit={'fit' in props ? props.fit : undefined}
        className={props.className}
      />
    ) : (
      <FilePlayer
        url={url}
        poster={props.poster}
        muted={props.muted}
        {...pickFilePlayback(props)}
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

function wrapWithLayout(inner: React.ReactElement, layout: VideoLayout): React.ReactElement {
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
        <div className="flex w-full justify-center">
          <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-lg border border-ods-border">
            {inner}
          </div>
        </div>
      );
    case 'fill':
      return <div className="absolute inset-0 h-full w-full">{inner}</div>;
    case 'wide':
      // In-flow 16:9 at full width, no max-width cap. The theater surface:
      // the video sizes the box (contributes height, unlike `fill`), and any
      // following siblings (the AI summary in EntityVideoSection) flow beneath
      // it. `max-w-3xl` (centered) would strand a small video in a wide dialog.
      // `bg-ods-bg` (the darkest neutral surface) gives the theater a proper
      // near-black video stage — letterbox bars and the pre-play frame read as
      // a video player, not a gray card. Border dropped: a stage has no chrome.
      return <div className="aspect-video w-full overflow-hidden rounded-lg bg-ods-bg">{inner}</div>;
    case 'native':
    default:
      // `native` callers (blog cards etc.) are
      // expected to provide their own aspect-ratio container so the layout
      // primitive doesn't override portrait/square/landscape bites with 16:9.
      return inner;
  }
}

// -----------------------------------------------------------------------------
// First-frame preview — the `firstFrameOnly` facade branch
// -----------------------------------------------------------------------------

/** First-frame paint through the SAME FilePlayer/MuxPlayer pipeline as
 *  playback (one rendering path for every file source — HLS included, which a
 *  plain `<video>` couldn't decode in Chromium): a chromeless, muted,
 *  metadata-only instance whose `#t=0.1` media fragment seeks-and-paints the
 *  first frame (also fixes iOS Safari, which stays blank on a fragmentless
 *  metadata load). The transparent media background keeps the box showing the
 *  card surface (never black) until the frame decodes. */
function FirstFramePreview({
  url,
  poster,
  fit,
  className,
}: {
  url: string;
  poster?: string | null;
  fit?: 'contain' | 'cover';
  className?: string;
}): React.ReactElement {
  return (
    <div
      aria-hidden
      className="h-full w-full"
      style={{ '--media-background-color': 'transparent' } as React.CSSProperties}
    >
      {/* No explicit `preload` — inherits the SSOT default ('metadata',
          'none' under Save-Data) so posterless facade cards honor the
          Save-Data policy like every other surface. */}
      <FilePlayer url={`${url}#t=0.1`} poster={poster} fit={fit} muted chromeless className={className} />
    </div>
  );
}

// -----------------------------------------------------------------------------
// YouTube facade — inlined lite-youtube-embed pattern
// -----------------------------------------------------------------------------

interface YouTubeFacadeProps extends VideoYouTubeFacadeProps {
  url: string;
  title?: string;
  priority?: boolean;
  className?: string;
  minimalControls?: boolean;
  muted?: boolean;
}

function YouTubeFacade({
  url,
  title = 'YouTube Video',
  priority,
  className,
  minimalControls,
  muted,
  // `...facade` rather than naming each one: this hop is invisible to the
  // build-time forwarding proof, so a prop added to VideoYouTubeFacadeProps
  // would reach here and silently stop before Inner.
  ...facade
}: YouTubeFacadeProps): React.ReactElement | null {
  // `extractYouTubeId` handles both bare 11-char ids AND full URLs in a
  // single call site, so the resolution logic lives in exactly one place.
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return (
    <YouTubeFacadeInner
      videoId={videoId}
      title={title}
      priority={priority}
      className={className}
      minimalControls={minimalControls}
      muted={muted}
      {...facade}
    />
  );
}

interface YouTubeFacadeInnerProps extends VideoYouTubeFacadeProps {
  videoId: string;
  title: string;
  priority?: boolean;
  className?: string;
  minimalControls?: boolean;
  /** `mute=1` on the embed — what lets `autoActivate` start playback with no
   *  user gesture (browsers only allow muted autoplay; YouTube's own control
   *  unmutes). */
  muted?: boolean;
}

const YT_NOCOOKIE_ORIGIN = 'https://www.youtube-nocookie.com';

// Poster thumbnail tiers, best → always-present. YouTube serves each size at a
// fixed path on i.ytimg.com. `maxresdefault` is 1280×720 (crisp) but is only
// generated for uploads whose source was ≥720p, so it can 404; `mqdefault` is
// 320×180 and ALWAYS exists. BOTH are 16:9 — unlike the letterboxed 4:3 `hq`/`sd`
// sizes — so an `object-cover` frame never shows black bars regardless of tier.
// The facade starts at `maxresdefault` and drops to `mqdefault` on load error,
// so low-res-only videos render exactly as they did before this change.
const YT_POSTER_TIERS = ['maxresdefault', 'mqdefault'] as const;

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
  /** `onError` carries its code as a bare number in `info`, not an object:
   *  `{"event":"onError","info":150}` (101/150 = embedding disabled). */
  errorCode?: number;
}

/**
 * Decode one iframe-API message body.
 *
 * `JSON.parse` returns `any`, so the parsed body used to be stored straight
 * into a `YouTubeInfoDeliveryMessage` — the annotation described the wire
 * rather than checking it. Returns null for anything that is not an object,
 * which the caller already treats as "ignore this message".
 */
function toYouTubeMessage(parsed: unknown): YouTubeInfoDeliveryMessage | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const event = 'event' in parsed ? parsed.event : undefined;
  const info = 'info' in parsed ? parsed.info : undefined;
  const playerState = typeof info === 'object' && info !== null && 'playerState' in info ? info.playerState : undefined;

  return {
    event: typeof event === 'string' ? event : undefined,
    info: { playerState: typeof playerState === 'number' ? playerState : undefined },
    errorCode: typeof info === 'number' ? info : undefined,
  };
}

function YouTubeFacadeInner({
  videoId,
  title,
  priority,
  className,
  minimalControls,
  muted,
  autoActivate,
  suspended,
}: YouTubeFacadeInnerProps): React.ReactElement {
  const [activated, setActivated] = useState(Boolean(autoActivate));
  // A host that flips `autoActivate` on later (an accordion step expanding)
  // activates too. Adjusted during render, like the other prop-driven state
  // here; the guard makes the immediate re-run a no-op. Flipping it off does
  // nothing: `suspended` is the pause signal.
  const [prevAutoActivate, setPrevAutoActivate] = useState(Boolean(autoActivate));
  if (Boolean(autoActivate) !== prevAutoActivate) {
    setPrevAutoActivate(Boolean(autoActivate));
    if (autoActivate) setActivated(true);
  }
  // The embed reported a hard player error (see the `onError` branch below).
  // Retry remounts the iframe via `reloadNonce` — a fresh element, since there
  // is no way to re-init a cross-origin player from outside.
  const [failed, setFailed] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const retry = useCallback(() => {
    setFailed(false);
    setReloadNonce(n => n + 1);
  }, []);

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
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '1',
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      enablejsapi: '1',
    });
    if (muted) params.set('mute', '1');
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
    return `${YT_NOCOOKIE_ORIGIN}/embed/${videoId}?${params.toString()}`;
  }, [videoId, minimalControls, muted]);

  // Poster starts at the highest tier and steps down on load error (see
  // `YT_POSTER_TIERS`). Reset to the top tier whenever the video changes so a
  // new id gets a fresh shot at its `maxresdefault`.
  // Adjusted while rendering — React's documented pattern for a prop-driven
  // reset — rather than from an effect: `posterJpg`/`posterWebp` are built from
  // the tier two lines below, so an effect made the new video's first paint
  // request the PREVIOUS video's degraded tier and only then step back up.
  const [posterTier, setPosterTier] = useState(0);
  const [posterTierFor, setPosterTierFor] = useState(videoId);
  if (posterTierFor !== videoId) {
    setPosterTierFor(videoId);
    setPosterTier(0);
  }
  const posterQuality = YT_POSTER_TIERS[posterTier];
  const posterJpg = `https://i.ytimg.com/vi/${videoId}/${posterQuality}.jpg`;
  const posterWebp = `https://i.ytimg.com/vi_webp/${videoId}/${posterQuality}.webp`;
  // On a 404 (e.g. no `maxresdefault`) drop one tier; clamp at the last so a
  // genuinely missing thumbnail can't loop.
  const handlePosterError = () => setPosterTier(tier => Math.min(tier + 1, YT_POSTER_TIERS.length - 1));

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
    if (!activated || failed) return undefined;
    const iframe = iframeRef.current;
    if (!iframe) return undefined;

    function subscribe() {
      iframe?.contentWindow?.postMessage('{"event":"listening"}', YT_NOCOOKIE_ORIGIN);
    }

    iframe.addEventListener('load', subscribe);
    subscribe();

    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    // No "never reached PLAYING within N seconds" watchdog on purpose: an embed
    // whose unmuted autoplay Safari/iOS blocked, or one whose jsapi channel is
    // dead, is healthy and silent — a timeout would tear those down, and retry
    // would re-arm it. Only an explicit `onError` is a definitive failure.
    function handleMessage(event: MessageEvent) {
      if (event.origin !== YT_NOCOOKIE_ORIGIN) return;
      if (typeof event.data !== 'string') return;
      let payload: YouTubeInfoDeliveryMessage | null = null;
      try {
        payload = toYouTubeMessage(JSON.parse(event.data));
      } catch {
        return;
      }
      if (!payload) return;
      if (payload.event === 'onError') {
        setFailed(true);
        reportPlaybackFailure({ kind: 'youtube', src: videoId, reason: 'error', errorCode: payload.errorCode });
        return;
      }
      if (payload.event !== 'infoDelivery') return;
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
  }, [activated, failed, reloadNonce, videoId]);

  // Close-side pause: a closing dialog flips `suspended` false→true. Post the
  // pauseVideo command over the same enablejsapi channel so the iframe stops
  // BEFORE the Radix exit animation unmounts it (an unmount-cleanup post would
  // fire too late). Edge-triggered: only acts on a transition while activated
  // (prev seeded false, so the initial render never pauses). The way back,
  // true→false, resumes — a collapsed accordion step re-expanding.
  const prevSuspendedRef = useRef(false);
  useEffect(() => {
    const wasSuspended = prevSuspendedRef.current;
    prevSuspendedRef.current = Boolean(suspended);
    if (!activated || Boolean(suspended) === wasSuspended) return;
    iframeRef.current?.contentWindow?.postMessage(
      `{"event":"command","func":"${suspended ? 'pauseVideo' : 'playVideo'}","args":[]}`,
      YT_NOCOOKIE_ORIGIN,
    );
  }, [suspended, activated]);

  const wrapperClass = `relative w-full ${className ?? ''}`;
  const wrapperStyle = { paddingBottom: '56.25%' as const };

  if (activated && failed) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <VideoErrorOverlay onRetry={retry} watchOnYouTubeId={videoId} />
      </div>
    );
  }

  if (activated) {
    return (
      <div className={wrapperClass} style={wrapperStyle}>
        <iframe
          key={reloadNonce}
          ref={iframeRef}
          src={embedUrl}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          // YouTube verifies the embedding domain from the Referer header. When the
          // host page runs under a strict `Referrer-Policy: no-referrer` (common on
          // deployed environments behind a gateway/CDN), the iframe would otherwise
          // inherit it, send no referrer, and YouTube rejects playback with
          // "Error 153 — Video player configuration error". Pin the policy to the
          // value YouTube's own recommended embed code uses so the origin is always
          // sent and embedding is authorized.
          referrerPolicy="strict-origin-when-cross-origin"
          title={title}
          className="absolute inset-0 h-full w-full rounded-lg border-0"
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
        className="group absolute inset-0 m-0 cursor-pointer overflow-hidden rounded-lg border border-ods-border bg-ods-card p-0"
      >
        <picture>
          <source type="image/webp" srcSet={posterWebp} />
          <img
            src={posterJpg}
            alt={title}
            loading="lazy"
            onError={handlePosterError}
            // React 18 wants lowercase (`fetchpriority` DOM attribute);
            // React 19 wants camelCase (`fetchPriority` prop). Detect at
            // module load and spread the right shape so both runtimes
            // render the DOM attribute cleanly with no console warnings.
            {...fetchPriorityProp(priority)}
            decoding={priority ? 'sync' : 'async'}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <div className="absolute inset-0 flex items-center justify-center bg-ods-bg bg-opacity-20 transition-opacity duration-200 group-hover:bg-opacity-30">
          {/* THE shared center play badge (video-center-badge.tsx) — same disc
              as strip cards / carousel thumbs / unmute chip; hero size + the
              facade's hover-scale affordance. */}
          <VideoPlayBadge
            size="lg"
            className="transition-transform duration-200 group-hover:scale-110 group-hover:text-ods-accent"
          />
        </div>
      </button>
    </div>
  );
}
