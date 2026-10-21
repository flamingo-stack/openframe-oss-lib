import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type MediaElement, type PlaybackSound, useHoverPlayback } from '../use-file-playback';

/** A media element whose listeners can be fired by hand, and whose first `play()` is aborted (its stream attaching). */
function mediaElement() {
  const listeners = new Map<string, Set<() => void>>();
  const element: MediaElement & { fire: (type: string) => void } = {
    paused: true,
    play: vi.fn(),
    pause: vi.fn(),
    addEventListener: (type, listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
    },
    removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    fire: type => {
      for (const listener of [...(listeners.get(type) ?? [])]) listener();
    },
  };
  return element;
}

function sound(): PlaybackSound {
  return {
    mutedFallback: false,
    playWithSound: vi.fn(async (element: MediaElement) => {
      await element.play?.();
    }),
    playMuted: vi.fn(async (element: MediaElement) => {
      await element.play?.();
    }),
    endMutedFallback: vi.fn(),
    unmute: vi.fn(),
  };
}

describe('useHoverPlayback', () => {
  it('plays a player that mounts already hovered once it can play', () => {
    const element = mediaElement();
    const playback = sound();
    renderHook(() => useHoverPlayback({ current: element }, playback, { playWhenHovered: true }));
    const asked = vi.mocked(playback.playMuted).mock.calls.length + vi.mocked(playback.playWithSound).mock.calls.length;
    expect(asked).toBe(1);

    act(() => element.fire('canplay'));
    const askedAgain =
      vi.mocked(playback.playMuted).mock.calls.length + vi.mocked(playback.playWithSound).mock.calls.length;
    expect(askedAgain).toBe(2);
  });

  it('does not play again once the hover has ended', () => {
    const element = mediaElement();
    const playback = sound();
    const { rerender } = renderHook(
      ({ hovered }) => useHoverPlayback({ current: element }, playback, { playWhenHovered: hovered }),
      { initialProps: { hovered: true } },
    );
    rerender({ hovered: false });
    act(() => element.fire('canplay'));
    const asked = vi.mocked(playback.playMuted).mock.calls.length + vi.mocked(playback.playWithSound).mock.calls.length;
    expect(asked).toBe(1);
  });

  it('leaves a player that is already playing alone', () => {
    const element = mediaElement();
    const playback = sound();
    renderHook(() => useHoverPlayback({ current: element }, playback, { playWhenHovered: true }));
    element.paused = false;
    act(() => element.fire('canplay'));
    const asked = vi.mocked(playback.playMuted).mock.calls.length + vi.mocked(playback.playWithSound).mock.calls.length;
    expect(asked).toBe(1);
  });
});
