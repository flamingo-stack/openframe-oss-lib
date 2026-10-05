'use client';

import { useEffect, useState } from 'react';
import { usePrefersReducedMotionState } from './use-prefers-reduced-motion';

export interface UseAutoplayResult {
  /** True while the thing may move by itself. */
  playing: boolean;
  /** The visitor stopped it with the pause control. */
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** True once the system preference is known to be reduced motion. */
  reducedMotion: boolean;
}

/**
 * THE rule for anything that moves by itself (a looping demo, an
 * auto-advancing carousel): it plays while four plain facts hold, and nothing
 * else decides it.
 *
 *   1. it is on screen (`onScreen`, the caller's `useInView`);
 *   2. the browser tab is visible (`visibilitychange`, and `pageshow` for a
 *      page restored from the back/forward cache);
 *   3. the visitor has not pressed pause (`setPaused`: the stop control
 *      WCAG 2.2.2 asks of anything that moves for more than five seconds);
 *   4. motion is allowed (never under reduced motion, and not before the
 *      preference is known).
 *
 * Every one of those has a way back that needs nothing particular from the
 * visitor: scroll back, return to the tab, press play. It deliberately does
 * NOT stop on hover, on keyboard focus, on a wheel event or on a touch.
 * Each was tried: a browser re-reports focus when its window is re-activated,
 * and a wheel or a touch is what scrolling the PAGE past the thing produces,
 * so those rules stopped it for reasons the visitor could not see, with no
 * visible way to start it again.
 */
export function useAutoplay(onScreen: boolean): UseAutoplayResult {
  const reducedState = usePrefersReducedMotionState();
  const [paused, setPaused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const sync = () => setTabHidden(document.visibilityState === 'hidden');
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);

  return {
    playing: onScreen && !paused && !tabHidden && reducedState === false,
    paused,
    setPaused,
    reducedMotion: reducedState === true,
  };
}
