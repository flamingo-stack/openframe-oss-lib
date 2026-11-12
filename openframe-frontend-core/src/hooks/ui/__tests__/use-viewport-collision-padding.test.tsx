import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useViewportCollisionPadding } from '../use-viewport-collision-padding';

const root = document.documentElement;

// Before, not after: the runner unmounts the previous test's hooks after every afterEach of this file, and a hook
// still mounted would report the reset outside act.
beforeEach(() => {
  root.style.removeProperty('--native-safe-top');
  root.style.removeProperty('--of-keyboard-inset');
});

describe('useViewportCollisionPadding', () => {
  it('reserves nothing on the web, where the shell publishes neither inset', () => {
    const { result } = renderHook(() => useViewportCollisionPadding());
    expect(result.current).toEqual({ top: 0, bottom: 0 });
  });

  it('keeps a list that flips above its field out from under the status bar', () => {
    root.style.setProperty('--native-safe-top', '47px');
    const { result } = renderHook(() => useViewportCollisionPadding());
    expect(result.current.top).toBe(47);
  });

  it('reserves the keyboard at the bottom', () => {
    root.style.setProperty('--of-keyboard-inset', '300px');
    const { result } = renderHook(() => useViewportCollisionPadding());
    // jsdom has no visual viewport and a 0px layout height: the whole inset is left to reserve.
    expect(result.current.bottom).toBe(300);
  });

  it('follows an inset the shell publishes after the popper opened', async () => {
    const { result } = renderHook(() => useViewportCollisionPadding());
    expect(result.current.top).toBe(0);
    // The MutationObserver reports on a microtask: let it land inside act.
    await act(async () => {
      root.style.setProperty('--native-safe-top', '59px');
      await Promise.resolve();
    });
    expect(result.current.top).toBe(59);
  });

  it('hands every popper the same object until a value changes', () => {
    root.style.setProperty('--native-safe-top', '47px');
    const first = renderHook(() => useViewportCollisionPadding());
    const second = renderHook(() => useViewportCollisionPadding());
    first.rerender();
    expect(second.result.current).toBe(first.result.current);
  });
});
