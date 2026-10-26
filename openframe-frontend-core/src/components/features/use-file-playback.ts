'use client';

/**
 * How a file video PLAYS: the browser's autoplay rules (sound needs a user
 * gesture, so playback falls back to muted and offers an unmute), playback on
 * hover, and noticing a player that stopped working. The file player composes
 * these hooks and draws; nothing here renders.
 */

import type React from 'react';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  activationWaiters,
  hasUserInteracted,
  reportPlaybackFailure,
  VIDEO_STALL_TIMEOUT_MS,
  type VideoFailureReason,
  type VideoFilePlaybackProps,
  type VideoPlayerHandle,
} from './video-shared';

/** The part of the `<mux-player>` element playback is driven through. */
export interface MediaElement {
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
}

export type MediaRef = React.RefObject<MediaElement | null>;

/** The volume playback with sound starts at. */
const SOUND_VOLUME = 0.5;

const always = () => true;

/** Run `action`; an element already torn down throws, and there is nothing left to do for it. */
function onLiveElement(action: () => void): void {
  try {
    action();
  } catch {
    // The element is gone.
  }
}

/**
 * The latest value of a prop or callback, for a handler that outlives the
 * render it was made in. Written in an effect, never in the render body: a
 * render React discards must not install a value that never committed, and the
 * handlers that read it cannot fire before a commit.
 */
function useLatest<T>(value: T): React.RefObject<T> {
  const latestRef = useRef(value);
  useEffect(() => {
    latestRef.current = value;
  });
  return latestRef;
}

/** Listen to a mediaRef event for the player's life. The handler may change every render. */
function useMediaEvent(mediaRef: MediaRef, type: string, handler: () => void): void {
  const handlerRef = useLatest(handler);
  useEffect(() => {
    const element = mediaRef.current;
    if (!element?.addEventListener) return undefined;
    const listener = () => handlerRef.current();
    onLiveElement(() => element.addEventListener?.(type, listener));
    return () => onLiveElement(() => element.removeEventListener?.(type, listener));
  }, [mediaRef, type, handlerRef]);
}

/** How a `play()` ended: it plays, the autoplay policy refused it, or something else stopped it (a pause, a teardown). */
/** How many times a hover asks again after its `play()` was aborted (each attempt waits for the element). */
const INTERRUPTED_PLAY_RETRIES = 2;

export type PlayOutcome = 'playing' | 'refused' | 'interrupted';

async function play(element: MediaElement): Promise<PlayOutcome> {
  try {
    await element.play?.();
    return 'playing';
  } catch (error) {
    return (error as { name?: string } | null)?.name === 'NotAllowedError' ? 'refused' : 'interrupted';
  }
}

// -----------------------------------------------------------------------------
// Sound: play with it when the browser allows, muted with an unmute otherwise
// -----------------------------------------------------------------------------

type SoundOptions = Pick<
  VideoFilePlaybackProps,
  'autoPlay' | 'autoPlayUnmuted' | 'startMuted' | 'onMutedFallbackChange' | 'playerHandleRef' | 'onEnded'
>;

export interface PlaybackSound {
  /** Playback runs muted because the browser refused sound: the unmute control shows. */
  mutedFallback: boolean;
  /** Play with sound (or `muted`, a host's standing choice); refused, play muted. `wanted` says the play is still
   *  asked for. Resolves with how the last `play()` ended. */
  playWithSound: (element: MediaElement, muted: boolean, wanted?: () => boolean) => Promise<PlayOutcome>;
  /** Play muted, and say so. `wanted` says the play is still asked for. Resolves with how the `play()` ended. */
  playMuted: (element: MediaElement, wanted?: () => boolean) => Promise<PlayOutcome>;
  /** The muted fallback is over (sound is on, or playback stopped). */
  endMutedFallback: () => void;
  /** The unmute control's click: it is the gesture the autoplay policy wants, so sound always starts. */
  unmute: (event: React.MouseEvent) => void;
}

export function usePlaybackSound(
  mediaRef: MediaRef,
  { autoPlay, autoPlayUnmuted, startMuted, onMutedFallbackChange, playerHandleRef, onEnded }: SoundOptions,
): PlaybackSound {
  // Seeded from `startMuted`: a surface that declares itself muted is muted from its first paint.
  const [mutedFallback, setMutedFallback] = useState(() => Boolean(startMuted));
  // Even MUTED playback was refused (iOS Low Power, a browser or company
  // policy): the host's control must read "play", not "unmute" or "pause".
  const [blocked, setBlocked] = useState(false);

  const playMuted = useCallback(async (element: MediaElement, wanted: () => boolean = always) => {
    onLiveElement(() => Object.assign(element, { muted: true }));
    const started = play(element);
    setBlocked(false);
    setMutedFallback(true);
    const outcome = await started;
    if (outcome !== 'playing' && wanted()) setBlocked(true);
    return outcome;
  }, []);

  const playWithSound = useCallback(
    async (element: MediaElement, muted: boolean, wanted: () => boolean = always) => {
      onLiveElement(() => Object.assign(element, { muted }));
      // Only a refusal falls back to muted. A pause that interrupts the play (a
      // fast hover-out) must not start playback again behind the pointer.
      const outcome = await play(element);
      if (outcome === 'refused' && wanted()) return playMuted(element, wanted);
      return outcome;
    },
    [playMuted],
  );

  const endMutedFallback = useCallback(() => setMutedFallback(false), []);

  const hearEverything = useCallback(() => {
    setBlocked(false);
    setMutedFallback(false);
  }, []);

  const unmute = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
      const element = mediaRef.current;
      if (element) {
        onLiveElement(() => {
          element.muted = false;
          element.volume = SOUND_VOLUME;
        });
        void play(element);
      }
      setMutedFallback(false);
    },
    [mediaRef],
  );

  // A host that draws its own control (`hideMutedBadge`) follows the state from here.
  const reportRef = useLatest(onMutedFallbackChange);
  useEffect(() => {
    reportRef.current?.({ muted: mutedFallback, blocked: mutedFallback && blocked });
  }, [reportRef, mutedFallback, blocked]);

  // Playback on mount, for a surface that takes over a playing video (the
  // theater, a resumed card). Once: `startMuted` mutes the element (and, when
  // the surface also autoplays, watches whether that play was refused);
  // `autoPlayUnmuted` tries sound, the mount being next to a gesture.
  const startedRef = useRef(false);
  useEffect(() => {
    const element = mediaRef.current;
    // Latched only once the element is there: a player not mounted yet must get its turn.
    if (startedRef.current || !element || !(startMuted || autoPlayUnmuted)) return;
    startedRef.current = true;
    if (!startMuted) {
      void playWithSound(element, false);
    } else if (autoPlay) {
      void playMuted(element);
    } else {
      onLiveElement(() => {
        element.muted = true;
      });
    }
  }, [mediaRef, autoPlay, autoPlayUnmuted, startMuted, playMuted, playWithSound]);

  // Sound turned on by ANY path (the player's own controls, the host's) ends the fallback.
  useMediaEvent(mediaRef, 'volumechange', () => {
    if (mediaRef.current?.muted === false) hearEverything();
  });
  // A video that plays is not blocked, however it got there.
  useMediaEvent(mediaRef, 'playing', () => setBlocked(false));
  // The host hears the end (a mini-player hands the video back).
  useMediaEvent(mediaRef, 'ended', () => onEnded?.());

  // The host's handle: what the player is doing, and its controls.
  useImperativeHandle(
    playerHandleRef,
    (): VideoPlayerHandle => ({
      getCurrentTime: () => mediaRef.current?.currentTime ?? 0,
      getDuration: () => {
        const duration = mediaRef.current?.duration;
        return typeof duration === 'number' && isFinite(duration) ? duration : 0;
      },
      getPaused: () => mediaRef.current?.paused ?? true,
      getMuted: () => mediaRef.current?.muted ?? false,
      play: async () => {
        await mediaRef.current?.play?.();
      },
      pause: () => onLiveElement(() => mediaRef.current?.pause?.()),
      setMuted: (muted: boolean) => {
        const element = mediaRef.current;
        if (!element) return;
        onLiveElement(() => {
          element.muted = muted;
          if (!muted) hearEverything();
        });
      },
    }),
    [mediaRef, hearEverything],
  );

  return { mutedFallback, playWithSound, playMuted, endMutedFallback, unmute };
}

// -----------------------------------------------------------------------------
// Hover: play while the pointer is over the player
// -----------------------------------------------------------------------------

/** How long a hover took to show a playing video: always in development, and on a live site with `localStorage.VIDEO_PERF_DEBUG` set. */
function hoverLatencyMeasured(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  try {
    return localStorage.getItem('VIDEO_PERF_DEBUG') !== null;
  } catch {
    return false;
  }
}

/** Log the time from now to the element's next `playing`. Returns how to stop waiting for it. */
function measureHoverLatency(element: MediaElement): () => void {
  const since = performance.now();
  const stop = () => onLiveElement(() => element.removeEventListener?.('playing', onPlaying));
  function onPlaying() {
    stop();
    console.debug('[Video] hover→playing %dms', Math.round(performance.now() - since));
  }
  onLiveElement(() => element.addEventListener?.('playing', onPlaying));
  return stop;
}

type HoverOptions = Pick<VideoFilePlaybackProps, 'playOnHover' | 'playWhenHovered' | 'mutedIntent'>;

export interface HoverPlayback {
  /** The HOST decides when the player is hovered (`playWhenHovered`); the player listens to no pointer. */
  controlled: boolean;
  /** The pointer handlers of a player that plays on its own hover (`playOnHover`). */
  pointerHandlers: { onPointerEnter?: () => void; onPointerLeave?: () => void };
}

export function useHoverPlayback(
  mediaRef: MediaRef,
  sound: PlaybackSound,
  { playOnHover, playWhenHovered, mutedIntent = false }: HoverOptions,
): HoverPlayback {
  // One hover is one "play": everything started for it is undone together when it ends.
  const endHoverRef = useRef<(() => void) | null>(null);
  // The host's standing mute, read when a hover starts: as a dependency it would restart playback on every toggle.
  const hostMutedRef = useLatest(mutedIntent);
  const { playWithSound, playMuted, endMutedFallback } = sound;

  const stop = useCallback(() => {
    endHoverRef.current?.();
    endHoverRef.current = null;
    endMutedFallback();
    onLiveElement(() => mediaRef.current?.pause?.());
  }, [mediaRef, endMutedFallback]);

  const start = useCallback(() => {
    endHoverRef.current?.();
    // A play that settles after its hover ended (a late refusal) belongs to no hover and changes nothing.
    let hovered = true;
    const cleanups: Array<() => void> = [
      () => {
        hovered = false;
      },
    ];
    endHoverRef.current = () => {
      for (const cleanup of cleanups) cleanup();
    };
    const element = mediaRef.current;
    if (!element) return;
    const wanted = () => hovered;
    if (hoverLatencyMeasured()) cleanups.push(measureHoverLatency(element));
    onLiveElement(() => {
      element.volume = SOUND_VOLUME;
    });
    // A `play()` can be aborted by the element itself: a player drawn BY this hover (a bite card mounts its player
    // on the first hover) is asked to play while its stream is still attaching, and attaching it aborts the play
    // (AbortError, "interrupted by a new load request"). The first hover on every card did nothing. The play()
    // promise is how the browser and Mux say a play did not happen; while the hover lasts, ask again: a `play()`
    // on a loading element waits until it can play. A hover-out's own pause ends the hover, so it is never retried.
    const attempt = (retriesLeft: number) => {
      const played = hasUserInteracted()
        ? playWithSound(element, hostMutedRef.current, wanted)
        : playMuted(element, wanted);
      void played.then(outcome => {
        if (outcome === 'interrupted' && hovered && element.paused !== false && retriesLeft > 0)
          attempt(retriesLeft - 1);
      });
    };
    attempt(INTERRUPTED_PLAY_RETRIES);
    if (hasUserInteracted()) return;
    // No gesture on the page yet, so sound would be refused: it started muted with no
    // refusal to wait for, and the sound turns on the moment the first gesture lands.
    const onFirstGesture = () => {
      if (!hovered) return;
      onLiveElement(() => {
        element.muted = false;
        element.volume = SOUND_VOLUME;
      });
      endMutedFallback();
    };
    activationWaiters.add(onFirstGesture);
    cleanups.push(() => activationWaiters.delete(onFirstGesture));
  }, [mediaRef, hostMutedRef, playWithSound, playMuted, endMutedFallback]);

  // A hover still open when the player unmounts leaves nothing behind.
  useEffect(() => () => endHoverRef.current?.(), []);

  const controlled = typeof playWhenHovered === 'boolean';
  useEffect(() => {
    if (!controlled) return;
    if (playWhenHovered) start();
    else stop();
  }, [controlled, playWhenHovered, start, stop]);

  const ownHover = Boolean(playOnHover) && !controlled;
  return { controlled, pointerHandlers: ownHover ? { onPointerEnter: start, onPointerLeave: stop } : {} };
}

// -----------------------------------------------------------------------------
// Health: a player a user is watching that stopped working says so
// -----------------------------------------------------------------------------

export interface PlaybackHealth {
  /** Playback failed or stalled: the overlay with its retry shows. */
  failed: boolean;
  retry: () => void;
  /** The player events health is read from. */
  playerEvents: {
    onError: () => void;
    onWaiting: () => void;
    onStalled: () => void;
    onPlaying: () => void;
    onTimeUpdate: () => void;
    onPause: () => void;
  };
}

/** `monitored` is false for a decorative player (a first frame, a hover preview): it never reports. */
export function usePlaybackHealth(mediaRef: MediaRef, url: string, monitored: boolean): PlaybackHealth {
  const [failed, setFailed] = useState(false);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current === null) return;
    clearTimeout(stallTimerRef.current);
    stallTimerRef.current = null;
  }, []);
  useEffect(() => clearStallTimer, [clearStallTimer]);

  const fail = useCallback(
    (reason: VideoFailureReason) => {
      if (!monitored) return;
      clearStallTimer();
      setFailed(true);
      reportPlaybackFailure({ kind: 'file', src: url, reason });
    },
    [monitored, clearStallTimer, url],
  );

  // Waiting too long is a stall. A paused or finished video waits for nothing.
  const watchForStall = useCallback(() => {
    const element = mediaRef.current;
    if (!monitored || !element || element.paused || element.ended || stallTimerRef.current !== null) return;
    stallTimerRef.current = setTimeout(() => {
      stallTimerRef.current = null;
      fail('stall');
    }, VIDEO_STALL_TIMEOUT_MS);
  }, [mediaRef, monitored, fail]);

  // Progress means the player is alive: a stall that heals clears its own overlay.
  const alive = useCallback(() => {
    clearStallTimer();
    setFailed(false);
  }, [clearStallTimer]);

  // `load()` starts the stream again (`play()` alone cannot) but rewinds it, so
  // the position is put back once the fresh source knows its length.
  const retry = useCallback(() => {
    alive();
    const element = mediaRef.current;
    if (!element) return;
    const resumeAt = typeof element.currentTime === 'number' ? element.currentTime : 0;
    onLiveElement(() => {
      element.load?.();
      if (resumeAt > 0) {
        const seekBack = () => {
          element.removeEventListener?.('loadedmetadata', seekBack);
          // A source shorter than the kept position starts from the top.
          onLiveElement(() => {
            element.currentTime = resumeAt;
          });
        };
        element.addEventListener?.('loadedmetadata', seekBack);
      }
      // A play refused again comes back through the error and stall handlers.
      void play(element);
    });
  }, [mediaRef, alive]);

  return {
    failed: monitored && failed,
    retry,
    playerEvents: {
      onError: () => fail('error'),
      onWaiting: watchForStall,
      onStalled: watchForStall,
      onPlaying: alive,
      onTimeUpdate: alive,
      onPause: clearStallTimer,
    },
  };
}
