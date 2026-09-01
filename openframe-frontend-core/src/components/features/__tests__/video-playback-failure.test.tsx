/**
 * Playback-failure handling for the shared `<Video>` — the recovery path that
 * turns an endless spinner or blank frame into a retry.
 *
 * Two branches are covered: the file player (MuxPlayer) via a fake element that
 * fires the media events the watchdog listens to, and the YouTube facade via
 * the postMessage state channel it subscribes to. Both assert the same
 * contract: a failure surfaces a reachable retry AND is reported once for
 * measurement.
 */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { forwardRef, useImperativeHandle } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// The fake MuxPlayer records the event props the watchdog wires and exposes a
// controllable element via the ref (play/pause/load, and mutable paused/ended).
let muxProps: Record<string, (() => void) | undefined> = {};
let muxEl: { paused: boolean; ended: boolean; loadCalls: number; playCalls: number } | null = null;

vi.mock('@mux/mux-player-react', () => {
  const Fake = forwardRef((props: Record<string, unknown>, ref: React.Ref<unknown>) => {
    muxProps = props as Record<string, (() => void) | undefined>;
    useImperativeHandle(ref, () => {
      const el = {
        paused: false,
        ended: false,
        loadCalls: 0,
        playCalls: 0,
        muted: false,
        volume: 1,
        currentTime: 0,
        duration: 100,
        play: () => {
          el.playCalls += 1;
          el.paused = false;
          return Promise.resolve();
        },
        pause: () => {
          el.paused = true;
        },
        load: () => {
          el.loadCalls += 1;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
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

function ytMessage(body: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(body), origin: YT_ORIGIN }));
}

describe('Video — file playback failure handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    muxProps = {};
    muxEl = null;
    (window as unknown as { posthog?: unknown }).posthog = { capture: vi.fn() };
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete (window as unknown as { posthog?: unknown }).posthog;
  });

  it('a mid-playback stall surfaces a retry and reports the failure once', () => {
    const dispatched = vi.spyOn(window, 'dispatchEvent');
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);

    // Buffering while playback is expected — the watchdog arms.
    act(() => muxProps.onWaiting?.());
    expect(screen.queryByText('This video failed to play.')).toBeNull();

    // No progress within the window → failure surfaces.
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByText('This video failed to play.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    const failureEvents = dispatched.mock.calls.filter(
      ([e]) => e instanceof CustomEvent && e.type === VIDEO_PLAYBACK_FAILED_EVENT,
    );
    expect(failureEvents).toHaveLength(1);
    expect((failureEvents[0][0] as CustomEvent).detail).toMatchObject({ kind: 'file', reason: 'stall' });
    const ph = (window as unknown as { posthog: { capture: ReturnType<typeof vi.fn> } }).posthog;
    expect(ph.capture).toHaveBeenCalledWith('video_playback_failed', expect.objectContaining({ reason: 'stall' }));
  });

  it('Try again reloads and resumes the element, clearing the error', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    act(() => muxProps.onWaiting?.());
    act(() => vi.advanceTimersByTime(15_000));

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(muxEl?.loadCalls).toBe(1);
    expect(muxEl?.playCalls).toBe(1);
    expect(screen.queryByText('This video failed to play.')).toBeNull();
  });

  it('a hard media error surfaces the retry immediately', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    act(() => muxProps.onError?.());
    expect(screen.getByText('This video failed to play.')).toBeInTheDocument();
  });

  it('a stall that self-heals dismisses its own overlay', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    act(() => muxProps.onWaiting?.());
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.getByText('This video failed to play.')).toBeInTheDocument();

    act(() => muxProps.onPlaying?.());
    expect(screen.queryByText('This video failed to play.')).toBeNull();
  });

  it('a paused player is never treated as a stall', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" layout="centered" />);
    if (muxEl) muxEl.paused = true;
    act(() => muxProps.onWaiting?.());
    act(() => vi.advanceTimersByTime(15_000));
    expect(screen.queryByText('This video failed to play.')).toBeNull();
  });

  it('decorative first-frame previews stay silent on error', () => {
    render(<Video kind="file" url="https://example.com/a.m3u8" firstFrameOnly />);
    act(() => muxProps.onError?.());
    expect(screen.queryByText('This video failed to play.')).toBeNull();
  });
});

describe('Video — YouTube facade failure handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (window as unknown as { posthog?: unknown }).posthog = { capture: vi.fn() };
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    delete (window as unknown as { posthog?: unknown }).posthog;
  });

  function activate(): void {
    render(<Video kind="youtube" url="dQw4w9WgXcQ" />);
    fireEvent.click(screen.getByRole('button', { name: /Play:/ }));
  }

  it('an embed that never starts surfaces retry + a YouTube fallback link', () => {
    activate();
    act(() => vi.advanceTimersByTime(12_000));

    expect(screen.getByText('This video failed to play.')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Watch on YouTube' });
    expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('an explicit embed error fails fast before the readiness window', () => {
    activate();
    act(() => ytMessage({ event: 'onError', info: 150 }));
    expect(screen.getByText('This video failed to play.')).toBeInTheDocument();
  });

  it('reaching PLAYING keeps the embed and never shows the error', () => {
    activate();
    act(() => ytMessage({ event: 'infoDelivery', info: { playerState: 1 } }));
    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.queryByText('This video failed to play.')).toBeNull();
  });

  it('Try again remounts the embed', () => {
    activate();
    act(() => vi.advanceTimersByTime(12_000));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByText('This video failed to play.')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Watch on YouTube' })).toBeNull();
  });
});
