import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type MediaElement, useHoverPlayback, usePlaybackSound } from '../use-file-playback';

/** The rejection a browser gives a `play()` that a source change (or a `pause()`) cut short. */
const abortError = () =>
  Object.assign(new Error('The play() request was interrupted by a new load request.'), {
    name: 'AbortError',
  });

/** A media element whose first `play()` calls are aborted (its stream attaching) and later ones play. */
function mediaElement(abortedPlays: number) {
  let left = abortedPlays;
  const element: MediaElement = { paused: true, pause: vi.fn() };
  element.play = vi.fn(() => {
    if (left > 0) {
      left -= 1;
      return Promise.reject(abortError());
    }
    element.paused = false;
    return Promise.resolve();
  });
  return element;
}

/** The hover hook on its real sound hook, hovered or not. */
function renderHover(element: MediaElement, hovered = true) {
  const ref = { current: element };
  return renderHook(
    ({ hover }) => {
      const sound = usePlaybackSound(ref, {});
      return useHoverPlayback(ref, sound, { playWhenHovered: hover });
    },
    { initialProps: { hover: hovered } },
  );
}

/** Lets every pending `play()` promise and its follow-up settle. */
const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });

describe('useHoverPlayback', () => {
  it('plays a player whose first play() was aborted while its stream attached', async () => {
    const element = mediaElement(1);
    renderHover(element);
    await settle();
    expect(element.play).toHaveBeenCalledTimes(2);
    expect(element.paused).toBe(false);
  });

  it('asks a bounded number of times', async () => {
    const element = mediaElement(10);
    renderHover(element);
    await settle();
    expect(element.play).toHaveBeenCalledTimes(3);
  });

  it('does not ask again once the hover has ended', async () => {
    const element = mediaElement(1);
    const { rerender } = renderHover(element);
    rerender({ hover: false });
    await settle();
    expect(element.play).toHaveBeenCalledTimes(1);
  });

  it('asks once when the first play() plays', async () => {
    const element = mediaElement(0);
    renderHover(element);
    await settle();
    expect(element.play).toHaveBeenCalledTimes(1);
  });
});
