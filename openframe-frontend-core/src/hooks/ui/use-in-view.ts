'use client';

import { useEffect, useState } from 'react';

export interface UseInViewOptions {
  /**
   * How much must be visible: this fraction of the element, or (for an element
   * taller than the viewport, which can never show that fraction of itself)
   * this fraction of the viewport's height. 0 = any pixel, 0.6 = 60%.
   */
  threshold?: number;
  /** Margin around the viewport, CSS-style. */
  rootMargin?: string;
  /**
   * The answer before the observer has reported (and where there is no
   * observer at all). Default false: nothing runs until it is known to be on
   * screen. A decorative strip that should rather move than sit still when the
   * observer never reports passes true.
   */
  initial?: boolean;
}

export interface UseInViewResult<T extends Element> {
  ref: (node: T | null) => void;
  /** Tracks visibility BOTH ways: true while in view, false again once it leaves. */
  inView: boolean;
}

/**
 * The observer is told about every 5% step, not only the one threshold asked
 * for. An observer given a single threshold reports only the moment that
 * threshold is CROSSED: if the visible fraction at that one report is a hair
 * under it (a fast scroll, a rounding of the layout), nothing reports again
 * while the element scrolls fully into view, and the answer stays "not in
 * view" for good. With a report at every step the answer is always re-read
 * from where the element actually is.
 */
const STEPS = Array.from({ length: 21 }, (_, i) => i / 20);

/**
 * Two-way visibility: `inView` follows the element in and out of the viewport.
 *
 * `useNearViewport` is the fire-once sibling (mount a heavy thing when it gets
 * close, never unmount). This one is for things that should run only WHILE
 * visible, like an auto-advancing carousel or a looping demo.
 *
 * The observer LIVES IN AN EFFECT keyed on the element, never in the ref
 * callback. An observer made in the callback and torn down by a separate
 * effect is torn down every time React re-runs effects without re-attaching
 * refs (a Fast Refresh, an Activity that hides and shows): nothing observed any
 * more, and `inView` froze at its last value, so a demo that happened to be off
 * screen at that moment never played again. An effect that owns it makes it
 * again whenever it is torn down.
 */
export function useInView<T extends Element = HTMLElement>({
  threshold = 0,
  rootMargin = '0px',
  initial = false,
}: UseInViewOptions = {}): UseInViewResult<T> {
  // The element, as state: the effect below is keyed on it. `setNode` is the ref (stable).
  const [node, setNode] = useState<T | null>(null);
  const [seen, setSeen] = useState<{ node: T; inView: boolean } | null>(null);

  useEffect(() => {
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        const ofElement = entry.intersectionRatio >= threshold;
        const viewportHeight = entry.rootBounds?.height ?? 0;
        const ofViewport = viewportHeight > 0 && (entry.intersectionRect?.height ?? 0) >= viewportHeight * threshold;
        setSeen({ node, inView: entry.isIntersecting && (ofElement || ofViewport) });
      },
      { threshold: STEPS, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, threshold, rootMargin]);

  // No element: not in view. An element the observer has not reported on yet (or cannot be observed): `initial`.
  const inView = !node ? false : seen?.node === node ? seen.inView : initial;
  return { ref: setNode, inView };
}
