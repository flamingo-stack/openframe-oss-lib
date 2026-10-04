'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseInViewOptions {
  /** Fraction of the element that must be visible (0 = any pixel, 0.6 = 60%). */
  threshold?: number;
  /** Margin around the viewport, CSS-style. */
  rootMargin?: string;
}

export interface UseInViewResult<T extends Element> {
  ref: (node: T | null) => void;
  /** Tracks visibility BOTH ways: true while in view, false again once it leaves. */
  inView: boolean;
}

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
}: UseInViewOptions = {}): UseInViewResult<T> {
  const [inView, setInView] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const nodeRef = useRef<T | null>(null);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      disconnect();
      nodeRef.current = node;
      if (!node || typeof IntersectionObserver === 'undefined') {
        setInView(false);
        return;
      }
      const observer = new IntersectionObserver(
        entries => {
          const entry = entries[entries.length - 1];
          if (!entry) return;
          setInView(entry.isIntersecting && entry.intersectionRatio >= threshold);
        },
        { threshold, rootMargin },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [disconnect, threshold, rootMargin],
  );

  useEffect(() => disconnect, [disconnect]);

  return { ref, inView };
}
