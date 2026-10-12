'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import { usePrefersReducedMotionState } from './use-prefers-reduced-motion';

/** The handlers that hold a moving thing still while a visitor is on it. Spread them on its outer element. */
export interface AutoplayHoldProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}

export interface UseAutoplayResult {
  /** True while the thing may move by itself. */
  playing: boolean;
  /** The visitor is holding it still: a finger or the mouse button is down on it, or the keyboard is inside it. */
  held: boolean;
  /** Spread on the element that moves: it is how a visitor stops it, with no control to find. */
  holdProps: AutoplayHoldProps;
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
 *   3. the visitor is not holding it (`holdProps`: the way to stop it that
 *      WCAG 2.2.2 asks of anything that moves for more than five seconds);
 *   4. motion is allowed (never under reduced motion, and not before the
 *      preference is known).
 *
 * There is NO pause button. A visitor holds it by PRESSING on it (a finger or
 * the mouse button down, as a story is held) or by having KEYBOARD focus inside
 * it. Each ends by itself (the press is released, wherever that happens; focus
 * moves on), so it can never be left stopped with no visible way to start it again.
 *
 * What does NOT hold it, each tried and removed:
 *   - HOVER: a visitor watching a demo rests the mouse on it, so it stopped the
 *     moment it had their attention and read as stuck;
 *   - a WHEEL event or a passing touch: that is what scrolling the PAGE past
 *     the thing produces (the browser cancels a press the moment it becomes a scroll);
 *   - focus the browser shows no ring for (`:focus-visible` is the test): a
 *     browser re-reports focus when its window is re-activated, and a mouse
 *     click on a control inside it is not the keyboard.
 */
export function useAutoplay(onScreen: boolean): UseAutoplayResult {
  const reducedState = usePrefersReducedMotionState();
  const [pressed, setPressed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const sync = () => {
      const hidden = document.visibilityState === 'hidden';
      setTabHidden(hidden);
      // A press released while the tab was away never reports its release.
      if (hidden) setPressed(false);
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('pageshow', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('pageshow', sync);
    };
  }, []);

  // The release is listened for on the WINDOW: a press that ends outside the
  // element (a drag that leaves it, a scroll the browser takes over) must still end.
  useEffect(() => {
    if (!pressed) return undefined;
    const release = () => setPressed(false);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [pressed]);

  const holdProps = useMemo<AutoplayHoldProps>(
    () => ({
      onPointerDown: () => setPressed(true),
      onFocus: event => {
        if (event.target.matches(':focus-visible')) setFocused(true);
      },
      onBlur: event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      },
    }),
    [],
  );

  const held = pressed || focused;
  return {
    playing: onScreen && !held && !tabHidden && reducedState === false,
    held,
    holdProps,
    reducedMotion: reducedState === true,
  };
}
