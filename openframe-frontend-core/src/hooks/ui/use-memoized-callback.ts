'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * A callback whose IDENTITY never changes and whose BODY is always the latest
 * one you passed — the "latest ref" pattern.
 *
 * Rewritten 2026-08-25. The previous implementation was broken in three ways
 * that only showed up once the React Compiler rules were switched on:
 *
 *   1. It wrote `callbackRef.current` and `dependenciesRef.current` DURING
 *      RENDER. A render that React throws away (Strict Mode, a suspended
 *      transition, a re-render that never commits) still left those writes
 *      behind, so the "memoized" callback could be one from a discarded render.
 *   2. Its dependency array was `[depsChanged]` — a BOOLEAN. That flips true
 *      on the render where deps change and false on the next one, so the
 *      returned identity changed TWICE per dependency change and was never
 *      stable, which is the one thing the hook exists to provide.
 *   3. The doc promised "deep comparison"; it compared with `Object.is`.
 *
 * The signature is unchanged, so no call site has to move. `dependencies` is
 * now ignored: the returned function always calls the newest callback, which
 * is what every reader of "stable callback reference" expected it to do. If
 * you actually WANT the identity to change with deps, use `useCallback`
 * directly — that is what it is for.
 */
export function useMemoizedCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  _dependencies?: readonly unknown[],
): T {
  const callbackRef = useRef(callback);

  // In an effect, not during render: this runs only for renders that commit.
  useEffect(() => {
    callbackRef.current = callback;
  });

  const stable = useCallback((...args: Parameters<T>) => callbackRef.current(...args), []);
  return stable as T;
}
