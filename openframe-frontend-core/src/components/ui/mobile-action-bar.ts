'use client';

import { type RefObject, useEffect, useSyncExternalStore } from 'react';

/**
 * The height of the window-pinned action bar a page draws on a phone or a tablet
 * (`PageActions`, below `md`), for chrome that must stay clear of it — e.g. a host's
 * floating chat button. 0 while there is none, and from `md` up, where the bar is
 * hidden. A module store rather than a context: the bar is drawn inside the page and
 * read by the layout around it.
 */
const heights = new Map<Element, number>();
const listeners = new Set<() => void>();
let tallest = 0;
/** How many surfaces drawn over the page (a chat sheet) cover the bar now. */
let covers = 0;

function notify() {
  for (const listener of listeners) listener();
}

function publish() {
  const next = Math.max(0, ...heights.values());
  if (next === tallest) return;
  tallest = next;
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Reports the bar under `ref` while it is mounted; a hidden bar measures 0. */
export function useReportMobileActionBar(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      heights.set(element, element.getBoundingClientRect().height);
      publish();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      heights.delete(element);
      publish();
    };
  }, [ref]);
}

/**
 * While `active`, the page's action bar steps aside for a surface drawn over the page
 * (a chat sheet over it): the bar is the page's, and would otherwise split that surface
 * from the composer under it. It keeps its room, so the page under the scrim stays put.
 */
export function useCoverMobileActionBar(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    covers += 1;
    notify();
    return () => {
      covers -= 1;
      notify();
    };
  }, [active]);
}

/** Whether a surface over the page covers the action bar now. */
export function useMobileActionBarCovered(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => covers > 0,
    () => false,
  );
}

/** The window-pinned action bar's height, 0 while no page draws one. */
export function useMobileActionBarHeight(): number {
  return useSyncExternalStore(
    subscribe,
    () => tallest,
    () => 0,
  );
}
