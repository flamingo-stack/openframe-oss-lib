import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useGridEmptyReserve } from '../components/ui/data-table/use-grid-empty-reserve';

/** A box whose height the test sets, and the observer the hook watches it with, fired by hand. */
function setup(height: number) {
  const box = document.createElement('div');
  let current = height;
  Object.defineProperty(box, 'offsetHeight', { configurable: true, get: () => current });
  const fire: Array<() => void> = [];
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      fire.push(callback);
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  return {
    box,
    resize(next: number) {
      current = next;
      act(() => {
        for (const callback of fire) callback();
      });
    },
    restore: () => {
      globalThis.ResizeObserver = original;
    },
  };
}

describe('useGridEmptyReserve (CU-17tkuw6af0q)', () => {
  let restore = () => {};
  afterEach(() => restore());

  it('is the page’s height less the box, and follows the box when its message wraps', () => {
    const env = setup(100);
    restore = env.restore;
    const { result } = renderHook(() => useGridEmptyReserve(env.box, 240));
    expect(result.current).toBe(140);
    env.resize(180);
    expect(result.current).toBe(60);
  });

  it('is 0 when the box is taller than the page, with no box, and with no page height', () => {
    const env = setup(300);
    restore = env.restore;
    expect(renderHook(() => useGridEmptyReserve(env.box, 240)).result.current).toBe(0);
    expect(renderHook(() => useGridEmptyReserve(null, 240)).result.current).toBe(0);
    expect(renderHook(() => useGridEmptyReserve(env.box, 0)).result.current).toBe(0);
  });
});
