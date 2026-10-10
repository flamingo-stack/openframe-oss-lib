'use client';

/**
 * What both halves of `<Video>` share: the public prop types, the playback
 * failure report and its overlay, and the page's user-activation tracker.
 *
 * `video.tsx` (the entry, the YouTube facade) and `video-file-player.tsx` (the
 * Mux player, loaded on demand) both import from here, so neither imports the
 * other statically. The tracker lives HERE, in the half every page loads: it
 * has to hear the page's first click, which can come before the player's
 * module has been fetched.
 */

import type React from 'react';
import { Button } from '../ui/button';

// =============================================================================
// User-activation tracker (module scope) — Chrome's autoplay policy rejects
// UNMUTED play() until the user has interacted with the page (click/keydown;
// pointer MOVEMENT does not count). Hover-preview surfaces use this to pick
// the right first move (sound vs muted) WITHOUT a rejection round-trip, and
// to unmute a live muted preview the instant the first gesture lands.
// =============================================================================

let userHasInteracted = false;
/** True once the user has clicked or pressed a key on this page (unmuted playback is then allowed). */
export function hasUserInteracted(): boolean {
  return userHasInteracted;
}
/** Callbacks run once, on the page's first click or key press. */
export const activationWaiters = new Set<() => void>();
if (typeof window !== 'undefined') {
  const w = window as unknown as { __VIDEO_ACTIVATION_TRACKED__?: boolean };
  if (!w.__VIDEO_ACTIVATION_TRACKED__) {
    w.__VIDEO_ACTIVATION_TRACKED__ = true;
    const markActivated = () => {
      userHasInteracted = true;
      activationWaiters.forEach(fn => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      activationWaiters.clear();
      window.removeEventListener('pointerdown', markActivated, true);
      window.removeEventListener('keydown', markActivated, true);
    };
    window.addEventListener('pointerdown', markActivated, true);
    window.addEventListener('keydown', markActivated, true);
  }
}

// =============================================================================
// Playback-failure handling
// =============================================================================
//
// A stalled or errored player leaves the user on an endless spinner with no way
// out. Every failure surfaces a retry (`VideoErrorOverlay`) and is reported on
// a `window` CustomEvent the host subscribes to — no vendor analytics global is
// touched from here; this package ships to consumers that load different (or
// no) analytics.

export type VideoFailureKind = 'file' | 'youtube';
/** `stall`: buffering that never cleared while playback was expected. */
export type VideoFailureReason = 'error' | 'stall';

export interface VideoPlaybackFailureDetail {
  kind: VideoFailureKind;
  /** File URL or YouTube video id — enough to group failures by source. */
  src: string;
  reason: VideoFailureReason;
  /** YouTube IFrame API error code, when the embed reported one. */
  errorCode?: number;
}

export const VIDEO_PLAYBACK_FAILED_EVENT = 'flamingo:video-playback-failed';

export function reportPlaybackFailure(detail: VideoPlaybackFailureDetail): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(VIDEO_PLAYBACK_FAILED_EVENT, { detail }));
  } catch {
    // Analytics must never break playback recovery.
  }
}

// Buffering longer than this while playback is expected reads as "broken", not
// "loading" — surface a retry instead of spinning forever. This is what an
// `error` callback alone misses: a video that played, then stalled mid-way.
export const VIDEO_STALL_TIMEOUT_MS = 15_000;

/** `watchOnYouTubeId` adds the one recovery that survives an embed the owner
 *  disabled: opening the video on YouTube itself. */
export function VideoErrorOverlay({
  onRetry,
  watchOnYouTubeId,
}: {
  onRetry: () => void;
  watchOnYouTubeId?: string;
}): React.ReactElement {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[var(--spacing-system-sf)] bg-ods-overlay p-[var(--spacing-system-lf)] text-center">
      <p className="text-ods-text-secondary text-h6">This video failed to play.</p>
      <div className="flex items-center gap-[var(--spacing-system-sf)]">
        <Button variant="outline" size="small" onClick={onRetry}>
          Try again
        </Button>
        {watchOnYouTubeId ? (
          <Button
            variant="transparent"
            size="small"
            href={`https://www.youtube.com/watch?v=${watchOnYouTubeId}`}
            openInNewTab
          >
            Watch on YouTube
          </Button>
        ) : null}
      </div>
    </div>
  );
}

// =============================================================================
// Props
// =============================================================================

export type VideoLayout = 'centered' | 'fill' | 'native' | 'wide';

/**
 * Imperative snapshot/control handle for playback-handoff surfaces (the
 * floating walkthrough widget's mini-player continuation). Getters power
 * close-time snapshots; the mutators let a close/reopen gesture drive the
 * player without remounting. `getDuration` exists so an "ended" predicate
 * (`duration - time < 1s`) is evaluable at close time.
 */
export interface VideoPlayerHandle {
  getCurrentTime(): number;
  getDuration(): number;
  getPaused(): boolean;
  getMuted(): boolean;
  play(): Promise<void>;
  pause(): void;
  setMuted(muted: boolean): void;
}

/** Muted-fallback state reported to hosts that own their own unmute control
 *  (`onMutedFallbackChange`). `blocked` is true when even the muted play()
 *  retry was rejected (iOS Low Power Mode) — the host's control is really
 *  a "play" affordance in that state, not an "unmute" one. */
export interface VideoMutedFallbackState {
  muted: boolean;
  blocked: boolean;
}

export interface VideoCommonProps {
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
   * Mount the player only once its box comes near the viewport (shared
   * fire-once IntersectionObserver, `NEAR_VIEWPORT_ROOT_MARGIN` lookahead).
   * Until then the box shows the poster (or nothing) — the caller's container
   * still owns the size, so nothing shifts when the player mounts. For grids
   * of players: a library of 20 clips costs 20 posters, not 20 players.
   */
  lazy?: boolean;
  /**
   * YouTube-only: hide YT player chrome (controls, info, fullscreen, related
   * videos, keyboard shortcuts). Used for marketing/landing-page embeds that
   * want a minimal look. No-op for file (MP4/HLS) branches.
   */
  minimalControls?: boolean;
}

/**
 * File-playback options. Declared ONCE and mixed into the public prop unions
 * AND the internal player, because these were hand-copied into four places and
 * every new prop had to be added to all of them (18 props x 4 sites before this
 * collapse). The dispatcher forwards them with a spread, so a prop added here
 * reaches FilePlayer for free.
 */
export interface VideoFilePlaybackProps {
  /**
   * SRT raw content. Deprecated: pass `captionsUrl` (VTT) instead.
   * Native `<track>` requires a URL; raw SRT can't be rendered without
   * a custom overlay. Setting this without `captionsUrl` is a no-op
   * with a dev warning.
   */
  srtContent?: string | null;
  /** HTTPS URL to a VTT captions file. Rendered as a native `<track>`. */
  captionsUrl?: string | null;
  /** Autoplay muted on mount (forwarded as MuxPlayer `autoPlay="muted"`). */
  autoPlay?: boolean;
  /** Loop playback — short bite previews. */
  loop?: boolean;
  /** Hide all player chrome (MuxPlayer `--controls: none`). */
  chromeless?: boolean;
  /** Play while the pointer hovers, pause on leave. Tries WITH sound at 50%
   *  first; falls back to muted when autoplay policy rejects unmuted. */
  playOnHover?: boolean;
  /** CONTROLLED variant of playOnHover: the host owns the hover state. */
  playWhenHovered?: boolean;
  /** Media preload hint. When omitted the SSOT default applies. */
  preload?: 'none' | 'metadata' | 'auto';
  /** object-fit for the media element. */
  fit?: 'contain' | 'cover';
  /** Start position in seconds (applied at LOAD time). */
  startTime?: number;
  /** Imperative handle for snapshot/control (mini-player continuation). */
  playerHandleRef?: React.Ref<VideoPlayerHandle>;
  /** Attempt UNMUTED autoplay on mount; falls back to muted on rejection. */
  autoPlayUnmuted?: boolean;
  /** Arm the muted-fallback state (host renders its own unmute affordance). */
  startMuted?: boolean;
  /** Host's standing mute intent — hover playback must not override it. */
  mutedIntent?: boolean;
  /** Suppress the INTERNAL center unmute glyph. Hosts whose own overlay
   *  button sits above the media render their own reachable control. */
  hideMutedBadge?: boolean;
  /** Reports muted-fallback state changes — see `VideoMutedFallbackState`. */
  onMutedFallbackChange?: (state: VideoMutedFallbackState) => void;
  /** Fired on the media element's `ended` event. */
  onEnded?: () => void;
}

/** The keys above, for the dispatcher's spread. `satisfies` rejects an EXTRA
 *  or misspelled key; the assertion below rejects a MISSING one (which would
 *  otherwise compile fine and silently stop forwarding that prop). */
const VIDEO_FILE_PLAYBACK_KEYS = [
  'srtContent',
  'captionsUrl',
  'autoPlay',
  'loop',
  'chromeless',
  'playOnHover',
  'playWhenHovered',
  'preload',
  'fit',
  'startTime',
  'playerHandleRef',
  'autoPlayUnmuted',
  'startMuted',
  'mutedIntent',
  'hideMutedBadge',
  'onMutedFallbackChange',
  'onEnded',
] as const satisfies readonly (keyof VideoFilePlaybackProps)[];

/** Build-time proof that a key list covers EVERY key of its interface — the
 *  `satisfies` on the list itself only rejects extra/misspelled keys, so
 *  without this a newly added prop compiles fine and silently stops being
 *  forwarded. Instantiate once per (interface, key-list) pair. */
type AllKeysForwarded<TProps, TKeys extends readonly (keyof TProps)[]> =
  Exclude<keyof TProps, TKeys[number]> extends never ? true : never;

/** Copy only the declared keys that are actually PRESENT on the union member,
 *  so an absent optional prop stays absent rather than becoming `undefined`. */
function pickForwardedKeys<TProps>(props: VideoProps, keys: readonly (keyof TProps)[]): TProps {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if ((k as string) in props) out[k as string] = (props as unknown as Record<string, unknown>)[k as string];
  }
  return out as TProps;
}

const _filePlaybackForwarded: AllKeysForwarded<VideoFilePlaybackProps, typeof VIDEO_FILE_PLAYBACK_KEYS> = true;
void _filePlaybackForwarded;

export const pickFilePlayback = (props: VideoProps): VideoFilePlaybackProps =>
  pickForwardedKeys<VideoFilePlaybackProps>(props, VIDEO_FILE_PLAYBACK_KEYS);

export interface VideoFileProps extends VideoCommonProps, VideoFilePlaybackProps {
  kind: 'file';
  url: string;
  firstFrameOnly?: boolean;
}

/** YouTube-facade behavior props, declared ONCE and reused by every layer that
 *  forwards them (the two union members, the facade, its inner). Same reason as
 *  `VideoFilePlaybackProps`: four hand-kept copies drift silently. */
export interface VideoYouTubeFacadeProps {
  /** Activate the facade (mount the iframe) immediately — for surfaces whose
   *  opening interaction IS the play gesture (the walkthrough theater). The
   *  embed URL already carries `autoplay=1`. */
  autoActivate?: boolean;
  /** Edge-triggered pause signal: when this flips false→true while activated,
   *  the facade posts a `pauseVideo` command over its existing
   *  `enablejsapi=1` postMessage channel. Lets a closing dialog stop iframe
   *  audio BEFORE the exit animation finishes unmounting it. */
  suspended?: boolean;
}

const VIDEO_YOUTUBE_FACADE_KEYS = [
  'autoActivate',
  'suspended',
] as const satisfies readonly (keyof VideoYouTubeFacadeProps)[];

const _youTubeForwarded: AllKeysForwarded<VideoYouTubeFacadeProps, typeof VIDEO_YOUTUBE_FACADE_KEYS> = true;
void _youTubeForwarded;

export const pickYouTube = (props: VideoProps): VideoYouTubeFacadeProps =>
  pickForwardedKeys<VideoYouTubeFacadeProps>(props, VIDEO_YOUTUBE_FACADE_KEYS);

export interface VideoYouTubeProps extends VideoCommonProps, VideoYouTubeFacadeProps {
  kind: 'youtube';
  /** Either a full YT URL or just the video id. */
  url: string;
}

export interface VideoAutoProps extends VideoCommonProps, VideoFilePlaybackProps, VideoYouTubeFacadeProps {
  kind?: 'auto';
  url: string;
  firstFrameOnly?: boolean;
}

export type VideoProps = VideoFileProps | VideoYouTubeProps | VideoAutoProps;
