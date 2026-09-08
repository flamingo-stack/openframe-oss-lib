import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useLocalStorage } from '../use-local-storage';

/**
 * The hook is a published, widely-used entry point whose whole job is decoding
 * untrusted JSON out of a shared store — so these cover the decode edges that
 * a type check cannot see: a stored `false` (falsy but present), corrupt JSON,
 * a key removed in another tab, an event whose `detail` is not the contract,
 * and a caller-supplied validator refusing the stored shape.
 */
const KEY = 'use-local-storage-test-key';

describe('useLocalStorage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('reads an existing value synchronously', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ a: 1 }));
    const { result } = renderHook(() => useLocalStorage<{ a: number }>(KEY, { a: 0 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it('falls back to initialValue when absent', () => {
    const { result } = renderHook(() => useLocalStorage<string>(KEY, 'init'));
    expect(result.current[0]).toBe('init');
  });

  it('keeps a stored false rather than treating it as absent', () => {
    window.localStorage.setItem(KEY, 'false');
    const { result } = renderHook(() => useLocalStorage<boolean>(KEY, true));
    expect(result.current[0]).toBe(false);
  });

  it('falls back on corrupt JSON without throwing', () => {
    window.localStorage.setItem(KEY, '{not json');
    const { result } = renderHook(() => useLocalStorage<string>(KEY, 'init'));
    expect(result.current[0]).toBe('init');
  });

  it('persists writes', () => {
    const { result } = renderHook(() => useLocalStorage<number>(KEY, 0));
    act(() => {
      result.current[1](5);
    });
    expect(result.current[0]).toBe(5);
    expect(window.localStorage.getItem(KEY)).toBe('5');
  });

  it('supports the functional setter form', () => {
    const { result } = renderHook(() => useLocalStorage<number>(KEY, 1));
    act(() => {
      result.current[1](prev => prev + 1);
    });
    expect(result.current[0]).toBe(2);
  });

  it('syncs from a custom localStorageUpdate event', () => {
    const { result } = renderHook(() => useLocalStorage<string>(KEY, 'init'));
    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify('other-tab'));
      window.dispatchEvent(
        new CustomEvent('localStorageUpdate', { detail: { key: KEY, newValue: JSON.stringify('other-tab') } }),
      );
    });
    expect(result.current[0]).toBe('other-tab');
  });

  it('resets to initialValue when the key is removed', () => {
    window.localStorage.setItem(KEY, JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage<string>(KEY, 'init'));
    expect(result.current[0]).toBe('stored');
    act(() => {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new CustomEvent('localStorageUpdate', { detail: { key: KEY, newValue: null } }));
    });
    expect(result.current[0]).toBe('init');
  });

  it('ignores events for other keys and malformed details', () => {
    const { result } = renderHook(() => useLocalStorage<string>(KEY, 'init'));
    act(() => {
      window.localStorage.setItem('someone-else', JSON.stringify('nope'));
      window.dispatchEvent(new CustomEvent('localStorageUpdate', { detail: { key: 'someone-else' } }));
      window.dispatchEvent(new CustomEvent('localStorageUpdate', { detail: 'garbage' }));
      window.dispatchEvent(new Event('localStorageUpdate'));
    });
    expect(result.current[0]).toBe('init');
  });

  it('rejects a stored value the validator refuses', () => {
    window.localStorage.setItem(KEY, JSON.stringify(42));
    const isString = (v: unknown): v is string => typeof v === 'string';
    const { result } = renderHook(() => useLocalStorage<string>(KEY, 'init', { validate: isString }));
    expect(result.current[0]).toBe('init');
  });

  it('does not write back the value it just received from an event', () => {
    window.localStorage.setItem(KEY, JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage<string>(KEY, 'init'));
    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify('from-event'));
      window.dispatchEvent(
        new CustomEvent('localStorageUpdate', { detail: { key: KEY, newValue: JSON.stringify('from-event') } }),
      );
    });
    expect(result.current[0]).toBe('from-event');
    expect(window.localStorage.getItem(KEY)).toBe(JSON.stringify('from-event'));
  });
});
