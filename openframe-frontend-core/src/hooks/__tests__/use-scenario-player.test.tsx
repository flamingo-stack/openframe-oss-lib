import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useScenarioPlayer } from '../use-scenario-player';

function stubReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: reduced,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );
}

const OPTIONS = { scenarioCount: 2, lastStep: 8, stepMs: 1700, holdMs: 4200 };

/** Each tick schedules the next one from an effect, so time moves one beat per act. */
function beats(count: number) {
  for (let i = 0; i < count; i++)
    act(() => {
      vi.advanceTimersByTime(1700);
    });
}

describe('useScenarioPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('plays 8 beats of 1.7s, holds 4.2s, then starts the other scenario', () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useScenarioPlayer(OPTIONS));
    expect(result.current).toMatchObject({ scenario: 0, step: 0 });

    for (let beat = 1; beat <= 8; beat++) {
      act(() => {
        vi.advanceTimersByTime(1700);
      });
      expect(result.current).toMatchObject({ scenario: 0, step: beat });
    }

    // The last step holds: nothing changes just before the hold ends.
    act(() => {
      vi.advanceTimersByTime(4199);
    });
    expect(result.current).toMatchObject({ scenario: 0, step: 8 });
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toMatchObject({ scenario: 1, step: 0 });

    // And the second scenario wraps back to the first.
    beats(8);
    act(() => {
      vi.advanceTimersByTime(4200);
    });
    expect(result.current).toMatchObject({ scenario: 0, step: 0 });
  });

  it('restarts a scenario from step 0 when it is chosen, then keeps rotating', () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useScenarioPlayer(OPTIONS));
    beats(3);
    expect(result.current.step).toBe(3);

    act(() => {
      result.current.go(1);
    });
    expect(result.current).toMatchObject({ scenario: 1, step: 0, paused: false });
    beats(8);
    expect(result.current).toMatchObject({ scenario: 1, step: 8 });

    // The rotation carries on after the visitor's choice has played out.
    act(() => {
      vi.advanceTimersByTime(4200);
    });
    expect(result.current).toMatchObject({ scenario: 0, step: 0, paused: false });
  });

  it('jumps to a step and keeps playing from there', () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useScenarioPlayer(OPTIONS));
    act(() => {
      result.current.setStep(7);
    });
    expect(result.current.step).toBe(7);
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(result.current.step).toBe(8);
    act(() => {
      result.current.setStep(99);
    });
    expect(result.current.step).toBe(8);
  });

  it('holds while the browser tab is hidden', () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useScenarioPlayer(OPTIONS));
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.step).toBe(0);
    visibility.mockReturnValue('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    beats(1);
    expect(result.current.step).toBe(1);
    visibility.mockRestore();
  });

  it('can start on the last step, then rotates from there', () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useScenarioPlayer({ ...OPTIONS, startAtEnd: true }));
    expect(result.current).toMatchObject({ scenario: 0, step: 8 });
    act(() => {
      vi.advanceTimersByTime(4200);
    });
    expect(result.current).toMatchObject({ scenario: 1, step: 0 });
  });

  it('does not advance while paused or disabled', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ enabled }) => useScenarioPlayer({ ...OPTIONS, enabled }), {
      initialProps: { enabled: false },
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.step).toBe(0);

    rerender({ enabled: true });
    act(() => {
      result.current.setPaused(true);
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.step).toBe(0);

    act(() => {
      result.current.setPaused(false);
    });
    act(() => {
      vi.advanceTimersByTime(1700);
    });
    expect(result.current.step).toBe(1);
  });

  it('picks up where it was every time it comes back on screen', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ enabled }) => useScenarioPlayer({ ...OPTIONS, enabled }), {
      initialProps: { enabled: true },
    });
    beats(4);
    expect(result.current.step).toBe(4);

    // Scrolled away, however long, whatever was clicked or focused before: it waits.
    act(() => {
      result.current.setStep(4);
    });
    rerender({ enabled: false });
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current.step).toBe(4);

    // Back on screen: it runs again, with nothing else asked of the visitor.
    rerender({ enabled: true });
    beats(2);
    expect(result.current.step).toBe(6);
    rerender({ enabled: false });
    rerender({ enabled: true });
    beats(1);
    expect(result.current.step).toBe(7);
  });

  it('takes its first step within a third of a second of becoming playable, then keeps the beat', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ enabled }) => useScenarioPlayer({ ...OPTIONS, enabled }), {
      initialProps: { enabled: false },
    });
    rerender({ enabled: true });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.step).toBe(1);
    // The next one takes a whole beat.
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(result.current.step).toBe(1);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.step).toBe(2);

    // Coming back on screen is the same: it moves at once.
    rerender({ enabled: false });
    rerender({ enabled: true });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.step).toBe(3);
  });

  it('still holds a finished scenario its full time when it becomes playable', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(
      ({ enabled }) => useScenarioPlayer({ ...OPTIONS, enabled, startAtEnd: true }),
      {
        initialProps: { enabled: false },
      },
    );
    rerender({ enabled: true });
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toMatchObject({ scenario: 0, step: 8 });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toMatchObject({ scenario: 1, step: 0 });
  });

  it('parks on the last step under reduced motion and never advances', () => {
    stubReducedMotion(true);
    const { result } = renderHook(() => useScenarioPlayer(OPTIONS));
    expect(result.current).toMatchObject({ scenario: 0, step: 8, reducedMotion: true });
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toMatchObject({ scenario: 0, step: 8 });
    act(() => {
      result.current.go(1);
    });
    expect(result.current).toMatchObject({ scenario: 1, step: 8 });
  });
});
