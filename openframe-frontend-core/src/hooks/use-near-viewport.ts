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

// Per-rootMargin IO map. Multiple call sites with different margins each
// get their own singleton observer.
const observers = new Map<string, IntersectionObserver>();
const subscribers = new WeakMap<Element, () => void>();

function getObserverFor(rootMargin: string): IntersectionObserver {
  const existing = observers.get(rootMargin);
  if (existing) return existing;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
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
    { rootMargin }
  );
  observers.set(rootMargin, io);
  return io;
}

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
 */
export function useNearViewport<T extends Element = HTMLElement>(
  rootMargin: string = '500px'
): UseNearViewportResult<T> {
  const [isNear, setIsNear] = useState(false);
  const elRef = useRef<T | null>(null);

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
          observers.get(rootMargin)?.unobserve(prev);
        }
      }

      elRef.current = node;
      if (!node) return;

      const cb = () => setIsNear(true);
      subscribers.set(node, cb);
      getObserverFor(rootMargin).observe(node);
    },
    [rootMargin]
  );

  // Unsubscribe on unmount. Identity check guards the StrictMode race.
  useEffect(() => {
    return () => {
      const el = elRef.current;
      if (!el) return;
      if (subscribers.get(el)) {
        subscribers.delete(el);
        observers.get(rootMargin)?.unobserve(el);
      }
    };
  }, [rootMargin]);

  return { ref, isNear };
}
