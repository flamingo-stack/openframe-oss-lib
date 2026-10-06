'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
 */
export function useInView<T extends Element = HTMLElement>({
  threshold = 0,
  rootMargin = '0px',
  initial = false,
}: UseInViewOptions = {}): UseInViewResult<T> {
  const [inView, setInView] = useState(initial);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      disconnect();
      if (!node) {
        setInView(false);
        return;
      }
      if (typeof IntersectionObserver === 'undefined') {
        setInView(initial);
        return;
      }
      const observer = new IntersectionObserver(
        entries => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          const ofElement = entry.intersectionRatio >= threshold;
          const viewportHeight = entry.rootBounds?.height ?? 0;
          const ofViewport = viewportHeight > 0 && (entry.intersectionRect?.height ?? 0) >= viewportHeight * threshold;
          setInView(entry.isIntersecting && (ofElement || ofViewport));
        },
        { threshold: STEPS, rootMargin },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [disconnect, threshold, rootMargin, initial],
  );

  useEffect(() => disconnect, [disconnect]);

  return { ref, inView };
}
