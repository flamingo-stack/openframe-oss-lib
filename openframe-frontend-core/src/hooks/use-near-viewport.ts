/**
 * useNearViewport — module-level shared IntersectionObserver in hook form.
 *
 * Single IO instance per `rootMargin` value, shared across every component
 * that mounts the hook. Reduces overhead vs. one IO per component on
 * grid/list pages where many subscribers observe the viewport with the same
 * margin. Promoted from the inline singleton at
 * `multi-platform-hub/components/shared/video-bites-display.tsx:21-43`,
 * which is the only IO pattern in either repo today.
 *
 * Usage:
 * ```tsx
 * function MyCard() {
 *   const { ref, isNear } = useNearViewport('500px');
 *   return <div ref={ref}>{isNear ? <HeavyChild /> : <Placeholder />}</div>;
 * }
 * ```
 *
 * StrictMode safety: cleanup uses an identity check on the registered
 * callback so React's dev double-mount (mount → cleanup → re-mount) does
 * not drop the second mount's freshly-set subscription. The IO callback
 * also checks `subscribers.get(target)` before invoking so a fire that
 * races with unmount cannot crash on a torn-down component.
 *
 * The hook fires once — on first intersection it sets `isNear=true` and
 * unobserves the element. Callers that need re-observation should
 * unmount and remount (or fork the hook for two-way behavior).
 */

import { useEffect, useRef, useState, useCallback } from 'react';

// Per-(rootMargin, threshold) IO map. Multiple call sites with different
// margins/thresholds each get their own singleton observer.
const observers = new Map<string, IntersectionObserver>();
const subscribers = new WeakMap<Element, () => void>();

/** Stable map key for an observer config. */
function observerKey(rootMargin: string, threshold: number): string {
  return `${rootMargin}|${threshold}`;
}

function getObserverFor(rootMargin: string, threshold: number): IntersectionObserver {
  const key = observerKey(rootMargin, threshold);
  const existing = observers.get(key);
  if (existing) return existing;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        // With a non-zero threshold, `isIntersecting` only flips true once
        // `intersectionRatio` crosses it — so this is the "≥ threshold of the
        // element is visible" gate the callers rely on.
        if (!entry.isIntersecting) return;
        // Race-safe: re-read the callback at fire time. A late IO firing
        // after cleanup must not invoke a stale callback.
        const cb = subscribers.get(entry.target);
        if (cb) {
          cb();
          io.unobserve(entry.target);
          subscribers.delete(entry.target);
        }
      });
    },
    { rootMargin, threshold }
  );
  observers.set(key, io);
  return io;
}

/**
 * Default near-viewport lookahead — the SSOT for "mount media on approach".
 * Shared by this hook's default AND the raw two-way IntersectionObservers in
 * `cards-strip.tsx` / `video-bites-strip.tsx` (which need mount+unmount, not
 * this hook's fire-once semantics, but must agree on the distance).
 */
export const NEAR_VIEWPORT_ROOT_MARGIN = '500px';

export interface UseNearViewportResult<T extends Element = HTMLElement> {
  /** Ref to attach to the element you want to gate on visibility. */
  ref: (node: T | null) => void;
  /** Flips to `true` once the element enters within `rootMargin` of the viewport. Never flips back. */
  isNear: boolean;
}

/**
 * @param rootMargin Margin around the viewport (CSS-style string).
 *                   '500px' = element starts mounting 500px before scroll-in.
 *                   '1000px' = a full viewport's worth of lookahead.
 *                   '0px' = strict on-screen detection.
 * @param threshold  Fraction of the element that must be visible before firing
 *                   (0 = any pixel — the default; 0.5 = at least half on-screen).
 */
export function useNearViewport<T extends Element = HTMLElement>(
  rootMargin: string = NEAR_VIEWPORT_ROOT_MARGIN,
  threshold: number = 0
): UseNearViewportResult<T> {
  const [isNear, setIsNear] = useState(false);
  const elRef = useRef<T | null>(null);
  const key = observerKey(rootMargin, threshold);

  // Subscribe/unsubscribe on element change.
  const ref = useCallback(
    (node: T | null) => {
      const prev = elRef.current;

      // Unsubscribe previous, if any. Identity-check the callback so a
      // StrictMode re-mount that has already re-registered keeps its sub.
      if (prev) {
        const stillOurs = subscribers.get(prev);
        if (stillOurs) {
          subscribers.delete(prev);
          observers.get(key)?.unobserve(prev);
        }
      }

      elRef.current = node;
      if (!node) return;

      const cb = () => setIsNear(true);
      subscribers.set(node, cb);
      getObserverFor(rootMargin, threshold).observe(node);
    },
    [key, rootMargin, threshold]
  );

  // Unsubscribe on unmount. Identity check guards the StrictMode race.
  useEffect(() => {
    return () => {
      const el = elRef.current;
      if (!el) return;
      if (subscribers.get(el)) {
        subscribers.delete(el);
        observers.get(key)?.unobserve(el);
      }
    };
  }, [key]);

  return { ref, isNear };
}
