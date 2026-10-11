'use client';

/**
 * The file half of `<Video>`: `<MuxPlayer>` (HLS and plain MP4) with hover
 * playback, the muted fallback, health monitoring and captions.
 *
 * Its own module so the player and hls.js are fetched only by a page that
 * draws a file video: `video.tsx` loads it on demand. Never import it
 * directly; `<Video>` is the only entry.
 *
 * This file DRAWS. How the video plays (sound, hover, health) is
 * `use-file-playback.ts`; what the page needs before a player mounts is
 * `mux-player-environment.ts`, which prepares the page when this module loads
 * (before any player can mount).
 */

import MuxPlayer from '@mux/mux-player-react';
import type React from 'react';
import { useRef } from 'react';
import { useAuthedAssetSrc } from '../../hooks/use-authed-asset-src';
import { muxViewerId } from './mux-player-environment';
import { useHoverPlayback, usePlaybackHealth, usePlaybackSound, type MediaElement } from './use-file-playback';
import { useIosNativeVideoFullscreen } from './use-ios-native-video-fullscreen';
import { saveDataEnabled } from './use-video-warmup';
import { VideoUnmuteGlyph } from './video-center-badge';
import { VideoErrorOverlay, type VideoFilePlaybackProps } from './video-shared';

export interface FilePlayerProps extends VideoFilePlaybackProps {
  url: string;
  poster?: string | null;
  muted?: boolean;
  className?: string;
}

/**
 * The player's own colour. Its built-in default is Mux's brand pink, which it
 * falls back to whenever its accent resolves to nothing, so the platform's ODS
 * accent is named first and the semantic accent behind it.
 */
const PLAYER_ACCENT = 'var(--ods-accent, var(--color-accent-primary))';

/**
 * The player fills the box its caller reserved (an aspect-ratio container), so
 * it is the right size from the first paint instead of growing once the video's
 * metadata arrives. `--controls: none` is media-chrome's switch for ALL player
 * chrome (the chromeless preview); `--media-object-fit` its object-fit.
 */
function playerStyle(chromeless: boolean | undefined, fit: FilePlayerProps['fit']) {
  return {
    width: '100%',
    height: '100%',
    ...(chromeless ? { '--controls': 'none' } : {}),
    ...(fit === 'cover' ? { '--media-object-fit': 'cover' } : {}),
  };
}

export default function FilePlayer({
  url,
  poster,
  muted,
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
  mutedIntent,
  hideMutedBadge,
  onMutedFallbackChange,
  onEnded,
  className,
}: FilePlayerProps): React.ReactElement {
  const mediaRef = useRef<MediaElement | null>(null);
  const sound = usePlaybackSound(mediaRef, {
    autoPlay,
    autoPlayUnmuted,
    startMuted,
    onMutedFallbackChange,
    playerHandleRef,
    onEnded,
  });
  const hover = useHoverPlayback(mediaRef, sound, { playOnHover, playWhenHovered, mutedIntent });
  // Only a player a user is watching reports its health: a decorative first frame or hover preview stays silent.
  const health = usePlaybackHealth(mediaRef, url, !chromeless);
  // In the iOS shell the fullscreen control goes to Apple's video player rather
  // than to element fullscreen, which WebKit exits by breaking the safe areas.
  useIosNativeVideoFullscreen(mediaRef);
  // `<track src>` is a browser subresource and carries no custom headers, so on
  // a host that authenticates by header the captions go through the same single
  // auth knob as every embedded request. A cookie-auth host gets the URL back.
  const captions = useAuthedAssetSrc(captionsUrl, 'text/vtt, */*');

  const player = (
    <MuxPlayer
      ref={mediaRef as React.Ref<never>}
      {...health.playerEvents}
      src={url}
      poster={poster || undefined}
      streamType="on-demand"
      // Stated, never left to the player: `metadata` loads the manifest and about
      // one segment, then idles, which is what makes a hover or a click start at
      // once. A Save-Data connection loads nothing until it plays.
      preload={preload ?? (saveDataEnabled() ? 'none' : 'metadata')}
      playsInline
      muted={muted}
      preferCmcd="header"
      // No `muxData` cookie: the viewer id is kept in localStorage and sent as metadata.
      disableCookies
      metadata={{ viewer_user_id: muxViewerId() }}
      accentColor={PLAYER_ACCENT}
      // `startMuted` alone does not autoplay: a video resumed while paused stays paused.
      autoPlay={autoPlay ? 'muted' : autoPlayUnmuted ? 'any' : undefined}
      startTime={typeof startTime === 'number' ? startTime : undefined}
      loop={loop}
      className={className}
      style={playerStyle(chromeless, fit)}
    >
      {captions ? <track kind="captions" src={captions} srcLang="en" label="English" default /> : null}
    </MuxPlayer>
  );

  // What sits over the player: the unmute control while playback runs muted
  // because the browser refused sound (muted autoplay with an explicit unmute,
  // never forced sound), and the retry when playback failed. The unmute is a
  // plain glyph in the centre slot, like the player's own centre controls.
  const unmute =
    sound.mutedFallback && !hideMutedBadge ? (
      <button
        type="button"
        aria-label="Unmute"
        title="Unmute"
        onClick={sound.unmute}
        className="absolute inset-0 z-10 m-auto flex h-14 w-14 items-center justify-center text-ods-text-primary transition-colors hover:text-ods-accent"
      >
        <VideoUnmuteGlyph />
      </button>
    ) : null;
  const failure = health.failed ? <VideoErrorOverlay onRetry={health.retry} /> : null;

  // A player with nothing to put over it and no pointer of its own is drawn bare
  // (a chromeless preview). Every other one gets a box its overlays dock to; the
  // player takes no pointer handlers, so its hover is the box's.
  const boxed =
    Boolean(playOnHover) || hover.controlled || Boolean(autoPlayUnmuted) || Boolean(startMuted) || !chromeless;
  if (!boxed) return player;
  return (
    <div className="relative h-full w-full" {...hover.pointerHandlers}>
      {player}
      {unmute}
      {failure}
    </div>
  );
}
