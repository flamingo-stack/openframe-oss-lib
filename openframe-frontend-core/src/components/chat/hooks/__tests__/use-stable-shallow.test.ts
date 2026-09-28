/**
 * Contract test for `useStableShallow` — the reference latch that lets a host's
 * INLINE object prop be used as a memo dependency.
 *
 * Pins: a shallow-equal rerender keeps the previous reference; any changed
 * value, added key, removed key, or explicit-undefined-vs-missing key swaps it;
 * `undefined` round-trips; and the render that swaps returns the NEW value, not
 * a stale one.
 */

import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useStableShallow } from '../use-stable-shallow';

describe('useStableShallow', () => {
  it('keeps the previous reference for a shallow-equal inline object', () => {
    const fn = () => {};
    const { result, rerender } = renderHook(({ v }) => useStableShallow(v), {
      initialProps: { v: { a: 1, fn } },
    });
    const first = result.current;
    rerender({ v: { a: 1, fn } });
    expect(result.current).toBe(first);
  });

  it('swaps on a changed value, and returns the NEW object on that very render', () => {
    const { result, rerender } = renderHook(({ v }) => useStableShallow(v), {
      initialProps: { v: { a: 1 } },
    });
    const next = { a: 2 };
    rerender({ v: next });
    expect(result.current).toBe(next);
  });

  it('swaps when a key is added or removed', () => {
    const { result, rerender } = renderHook(({ v }) => useStableShallow(v), {
      initialProps: { v: { a: 1 } },
    });
    const added = { a: 1, b: 2 };
    rerender({ v: added });
    expect(result.current).toBe(added);
    const removed = { a: 1 };
    rerender({ v: removed });
    expect(result.current).toBe(removed);
  });

  it('treats an explicitly-undefined key as different from a missing one', () => {
    interface Sparse {
      a: number;
      b?: number;
      c?: number;
    }
    const withB: Sparse = { a: 1, b: undefined };
    const { result, rerender } = renderHook(({ v }) => useStableShallow(v), { initialProps: { v: withB } });
    // Same key COUNT, so a length check alone would call these equal.
    const withC: Sparse = { a: 1, c: undefined };
    rerender({ v: withC });
    expect(result.current).toBe(withC);
  });

  it('round-trips undefined in both directions', () => {
    const { result, rerender } = renderHook(({ v }) => useStableShallow(v), {
      initialProps: { v: undefined as { a: number } | undefined },
    });
    expect(result.current).toBeUndefined();
    const obj = { a: 1 };
    rerender({ v: obj });
    expect(result.current).toBe(obj);
    rerender({ v: undefined });
    expect(result.current).toBeUndefined();
  });

  it('is stable across an unrelated rerender with the SAME reference', () => {
    const v = { a: 1 };
    const { result, rerender } = renderHook(() => useStableShallow(v));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
