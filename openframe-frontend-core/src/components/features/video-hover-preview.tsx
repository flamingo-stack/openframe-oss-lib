"use client";

/**
 * <VideoHoverPreviewSurface> — THE shared hover-preview media zone.
 *
 * Extracted verbatim from <VideoBiteCard>'s media stack so the bite strip and
 * the floating walkthrough card share ONE implementation of: poster layer
 * (cover-fallback chain) → first-frame facade fallback → center play badge →
 * controlled muted/sound hover playback, plus the two-way near-viewport player
 * mount gate. The <Video> Mux SSoT is the only player primitive used.
 *
 * Ownership split (do not regress):
 *   - This surface renders `absolute inset-0` content only. The HOST keeps the
 *     sized wrapper (aspect-ratio / height / max-width) so strip geometry can't
 *     regress, and keeps its own card-root concerns (data-strip-card-key,
 *     engine rootRef registration, hover/touch handlers, the bottom overlay).
 *   - Hover activation is CONTROLLED via `active` (the host owns hover state).
 *   - Player mount is controlled via `playerMounted` (the strip's shared gate)
 *     OR self-managed here via a two-way near-viewport observer (standalone
 *     editor cards). Exactly one path is ever active.
 */

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../utils/cn';
import { Video, type VideoPlayerHandle, type VideoMutedFallbackState } from './video';
import { toMuxPreviewUrl } from './mux-origins';
import { NEAR_VIEWPORT_ROOT_MARGIN } from '../../hooks/use-near-viewport';
import Image from '../../embed-shims/next-image';
import { useCoverImageFallback } from '../chat/entity-cards/use-cover-image-fallback';
import { VideoPlayBadge } from './video-center-badge';

export interface VideoHoverPreviewSurfaceProps {
  /** Source URL (Mux HLS / Supabase mp4). Rendition-capped internally. */
  url: string;
  /** Poster / thumbnail; resolved through the shared cover-fallback chain. */
  posterUrl?: string | null;
  /** CONTROLLED hover activation — the ONLY playback driver (maps to
   *  <Video playWhenHovered={active}>). The host owns hover state. */
  active: boolean;
  /** Controlled player mount (strip budget gate). Omit → surface runs its own
   *  two-way near-viewport observer. */
  playerMounted?: boolean;
  /** Marquee clone: applies `inert` to the media subtree (axe aria-hidden-focus). */
  isClone?: boolean;
  /** Center play badge when inactive. Default 'play'. */
  badge?: 'play' | 'none';
  /** Object-fit for the hover player. */
  fit?: 'contain' | 'cover';
  /** next/image sizes for the poster. Default '234px' (strip cell). */
  posterSizes?: string;
  /** Preview-player preload override. When 'none' AND the poster resolves null,
   *  the network-fetching first-frame facade is SKIPPED (flat surface + badge)
   *  so a fixed always-near widget card fetches nothing until first hover. */
  preload?: 'none' | 'metadata' | 'auto';
  /** Suppress the hover player's internal unmute glyph (host renders its own). */
  hideMutedBadge?: boolean;
  /** Muted-fallback state reporter, forwarded to the hover player. */
  onMutedFallbackChange?: (state: VideoMutedFallbackState) => void;
  /** Imperative handle for the hover player (host-driven unmute/pause). */
  previewHandleRef?: React.Ref<VideoPlayerHandle>;
  /** Standing mute intent from the host, applied when hover playback starts.
   *  Without it an explicit mute was audibly undone by the next hover. */
  mutedIntent?: boolean;
  /** CONTINUATION mode (mini-player resume): mount the player immediately and
   *  play from `startTime`, independent of `active`/hover. Exists so hosts do
   *  NOT hand-roll a second player component — one surface, one behaviour. */
  continuation?: boolean;
  startTime?: number;
  /** Play on mount. False resumes PAUSED at `startTime` (theater closed while
   *  paused) — kept separate from `continuation` so a paused resume still
   *  mounts and seeks instead of falling back to a poster. */
  autoPlay?: boolean;
  startMuted?: boolean;
  onEnded?: () => void;
  className?: string;
}

export function VideoHoverPreviewSurface({
  url,
  posterUrl = null,
  active,
  playerMounted,
  isClone = false,
  badge = 'play',
  fit,
  posterSizes = '234px',
  preload,
  hideMutedBadge,
  onMutedFallbackChange,
  previewHandleRef,
  mutedIntent = false,
  continuation = false,
  startTime,
  autoPlay = false,
  startMuted = false,
  onEnded,
  className,
}: VideoHoverPreviewSurfaceProps): React.ReactElement {
  // Rendition-capped playback URL: public Mux HLS manifests get
  // `?max_resolution=720p` (non-Mux URLs pass through). Shared by the facade
  // and the hover player so both layers reuse the same manifest fetch.
  const previewUrl = toMuxPreviewUrl(url);

  // Player mount: controlled (strip gate) or a self-managed TWO-WAY
  // near-viewport observer (standalone). Two-way — players unmount again
  // >500px away so live MuxPlayer instances stay bounded.
  const gateControlled = playerMounted !== undefined;
  const rootElRef = useRef<HTMLDivElement | null>(null);
  const [isNear, setIsNear] = useState(false);
  useEffect(() => {
    if (gateControlled) return;
    const el = rootElRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      entries => setIsNear(entries[0]?.isIntersecting ?? false),
      { rootMargin: NEAR_VIEWPORT_ROOT_MARGIN },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gateControlled]);
  // Continuation forces the media + player on regardless of hover/viewport gate.
  const showMedia = continuation || (gateControlled ? playerMounted : isNear);

  // Poster resolution — the shared entity-card cover fallback chain: the real
  // thumbnail, dropped on load error. Null → first-frame facade (unless the
  // preload-none skip rule applies).
  const { src: posterSrc, onError: onPosterError } = useCoverImageFallback(posterUrl);

  // Zero-network cost rule: a widget card that passes preload="none" and has no
  // poster renders a flat card surface + badge, NEVER the metadata-fetching
  // facade (which would defeat the "no fetch until hover" cost decision).
  const facadeSkipped = preload === 'none' && !posterSrc;

  return (
    <div ref={rootElRef} className={cn('absolute inset-0', className)} inert={isClone || undefined}>
      {showMedia ? (
        <>
          {posterSrc ? (
            <Image
              src={posterSrc}
              alt=""
              fill
              sizes={posterSizes}
              unoptimized
              onError={onPosterError}
              className="object-cover"
            />
          ) : facadeSkipped ? (
            <div className="absolute inset-0 bg-ods-card" />
          ) : (
            <Video kind="file" url={previewUrl} firstFrameOnly layout="fill" fit={fit} />
          )}

          {badge === 'play' && !active && !continuation && (
            <VideoPlayBadge className="absolute inset-0 z-10 m-auto" />
          )}

          {(
            <div
              className="absolute inset-0"
              style={{ '--media-background-color': 'transparent' } as React.CSSProperties}
            >
              <Video
                // Remount between modes: `startTime` + autoplay are LOAD-TIME
                // props (playback-core binds them to one-shot durationchange /
                // loadstart handlers), so re-propping an already-loaded element
                // silently drops the seek. Only a Mux preview rewrite changed
                // `src` before, which is why HLS resumed and plain MP4 did not.
                key={continuation ? 'continuation' : 'preview'}
                kind="file"
                // Rendition-capped in BOTH modes: the cap was only skipped
                // because changing `src` used to be the sole trigger for the
                // seek; the explicit key handles that now, and a 320px mini
                // player should never pull the uncapped manifest.
                url={previewUrl}
                poster={posterUrl}
                {...(continuation
                  ? {
                      startTime,
                      autoPlay: autoPlay && startMuted,
                      startMuted,
                      autoPlayUnmuted: autoPlay && !startMuted,
                    }
                  : { playWhenHovered: active })}
                chromeless
                layout="fill"
                fit={fit}
                preload={preload}
                mutedIntent={mutedIntent}
                hideMutedBadge={hideMutedBadge}
                onMutedFallbackChange={onMutedFallbackChange}
                onEnded={onEnded}
                playerHandleRef={previewHandleRef}
              />
            </div>
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-ods-card" />
      )}
    </div>
  );
}
