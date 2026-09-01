/**
 * Playback-failure handling for the shared `<Video>`.
 *
 * Two branches: the file player (MuxPlayer) via a fake element that fires the
 * media events the watchdog listens to, and the YouTube facade via the
 * postMessage channel it subscribes to. Both assert the same contract — a
 * failure surfaces a reachable retry AND is reported once.
 */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

interface FakeMuxEl {
  paused: boolean;
  ended: boolean;
  currentTime: number;
  loadCalls: number;
  playCalls: number;
  listeners: Record<string, Array<() => void>>;
  emit: (type: string) => void;
}

let muxProps: Record<string, (() => void) | undefined> = {};
let muxEl: FakeMuxEl | null = null;

vi.mock('@mux/mux-player-react', () => {
  const Fake = forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    muxProps = props as Record<string, (() => void) | undefined>;
    useImperativeHandle(ref, () => {
      const listeners: Record<string, Array<() => void>> = {};
      const el = {
        paused: false,
        ended: false,
        loadCalls: 0,
        playCalls: 0,
        muted: false,
        volume: 1,
        currentTime: 0,
        duration: 100,
        listeners,
        play: () => {
          el.playCalls += 1;
          el.paused = false;
          return Promise.resolve();
        },
        pause: () => {
          el.paused = true;
        },
        // Mirrors the real element: a reload rewinds to zero.
        load: () => {
          el.loadCalls += 1;
          el.currentTime = 0;
        },
        addEventListener: (type: string, fn: () => void) => {
          (listeners[type] ??= []).push(fn);
        },
        removeEventListener: (type: string, fn: () => void) => {
          listeners[type] = (listeners[type] ?? []).filter(l => l !== fn);
        },
        emit: (type: string) => {
          for (const fn of [...(listeners[type] ?? [])]) fn();
        },
      };
      muxEl = el;
      return el;
    }, []);
    return <div data-testid="mux" />;
  });
  Fake.displayName = 'FakeMuxPlayer';
  return { default: Fake };
});

import { Video, VIDEO_PLAYBACK_FAILED_EVENT } from '../video';

const YT_ORIGIN = 'https://www.youtube-nocookie.com';
const ERROR_TEXT = 'This video failed to play.';

function ytMessage(body: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(body), origin: YT_ORIGIN }));
}

function failureEvents(spy: { mock: { calls: unknown[][] } }): CustomEvent[] {
  return spy.mock.calls
    .map(call => call[0])
    .filter((e): e is CustomEvent => e instanceof CustomEvent && e.type === VIDEO_PLAYBACK_FAILED_EVENT);
}

describe('Video — file playback failure handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    muxProps = {};
    muxEl = null;
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    // Re-spying on a live spy returns it with its calls intact — restore, or
    // the next test counts this one's events.
    vi.restoreAllMocks();
  });

  it('a mid-playback stall surfaces a retry and reports the failure once', () => {
    const dispatched = vi.spyOn(window, 'dispatchEvent');
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);

    // Buffering while playback is expected — the watchdog arms.
    act(() => muxProps.onWaiting?.());
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();

    // No progress within the window → failure surfaces.
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    const events = failureEvents(dispatched);
    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({ kind: 'file', reason: 'stall' });
  });

  it('Try again reloads and resumes the element, clearing the error', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    act(() => muxProps.onWaiting?.());
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(muxEl?.loadCalls).toBe(1);
    expect(muxEl?.playCalls).toBe(1);
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  it('Try again resumes from where the stall happened, not from the top', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    if (muxEl) muxEl.currentTime = 480;
    act(() => muxProps.onWaiting?.());
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(muxEl?.currentTime).toBe(0); // reload rewound it
    act(() => muxEl?.emit('loadedmetadata'));
    expect(muxEl?.currentTime).toBe(480);
    // One-shot: a later reload must not drag the old position back.
    expect(muxEl?.listeners.loadedmetadata).toHaveLength(0);
  });

  it('a hard media error surfaces the retry immediately', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    act(() => muxProps.onError?.());
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
  });

  it('a stall that self-heals dismisses its own overlay', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    act(() => muxProps.onWaiting?.());
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();

    act(() => muxProps.onPlaying?.());
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  it('a paused player is never treated as a stall', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    if (muxEl) muxEl.paused = true;
    act(() => muxProps.onWaiting?.());
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  it('decorative first-frame previews stay silent on error', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" firstFrameOnly />);
    act(() => muxProps.onError?.());
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });
});

describe('Video — YouTube facade failure handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function activate(): void {
    render(<Video kind="youtube" url="dQw4w9WgXcQ" />);
    fireEvent.click(screen.getByRole('button', { name: /Play:/ }));
  }

  it('an explicit embed error surfaces retry + a YouTube fallback link', () => {
    const dispatched = vi.spyOn(window, 'dispatchEvent');
    activate();
    act(() => ytMessage({ event: 'onError', info: 150 }));

    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Watch on YouTube' })).toHaveAttribute(
      'href',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
    expect(failureEvents(dispatched)[0].detail).toMatchObject({
      kind: 'youtube',
      reason: 'error',
      errorCode: 150,
    });
  });

  // Regression guard: a silent embed is NOT a failed one. Safari/iOS block the
  // unmuted autoplay and wait for a click inside the iframe, and a broken jsapi
  // channel reports nothing at all — a readiness timeout would tear both down.
  it('a silent embed is left alone, however long it stays silent', () => {
    const dispatched = vi.spyOn(window, 'dispatchEvent');
    activate();
    act(() => {
      vi.advanceTimersByTime(120_000);
    });

    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    expect(screen.getByTitle('YouTube Video')).toBeInTheDocument();
    expect(failureEvents(dispatched)).toHaveLength(0);
  });

  it('reaching PLAYING keeps the embed and never shows the error', () => {
    activate();
    act(() => ytMessage({ event: 'infoDelivery', info: { playerState: 1 } }));
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
  });

  it('Try again remounts the embed', () => {
    activate();
    act(() => ytMessage({ event: 'onError', info: 150 }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText(ERROR_TEXT)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Watch on YouTube' })).toBeNull();
    expect(screen.getByTitle('YouTube Video')).toBeInTheDocument();
  });
});
