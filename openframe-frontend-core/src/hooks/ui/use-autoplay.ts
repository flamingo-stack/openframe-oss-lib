'use client';

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { FocusEvent, PointerEvent } from 'react';
import { usePrefersReducedMotionState } from './use-prefers-reduced-motion';

/** The handlers that hold a moving thing still while a visitor is on it. Spread them on its outer element. */
export interface AutoplayHoldProps {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onFocus: (event: FocusEvent<HTMLElement>) => void;
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

/** Subscribes to `events` on `target` for as long as React keeps the subscription; one signal removes them all. */
function listen(target: EventTarget, events: readonly string[], onChange: () => void): () => void {
  const controller = new AbortController();
  for (const event of events) target.addEventListener(event, onChange, { signal: controller.signal });
  return () => controller.abort();
}

// The tab: hidden or not is the document's own state, read where it lives (never mirrored into React state).
const subscribeToTab = (onChange: () => void) => {
  const stopDocument = listen(document, ['visibilitychange'], onChange);
  // `pageshow`: a page restored from the back/forward cache.
  const stopWindow = listen(window, ['pageshow'], onChange);
  return () => {
    stopDocument();
    stopWindow();
  };
};
const tabIsHidden = () => document.visibilityState === 'hidden';

const never = () => false;

/** Every way a press can end. A drag the browser takes over (an image, selected text) ends in `dragend`, never `pointerup`. */
const RELEASE_EVENTS = ['pointerup', 'pointercancel', 'mouseup', 'touchend', 'dragend', 'blur'] as const;

/**
 * THE rule for anything that moves by itself (a looping demo, an
 * auto-advancing carousel): it plays while four plain facts hold, and nothing
 * else decides it.
 *
 *   1. it is on screen (`onScreen`, the caller's `useInView`);
 *   2. the browser tab is visible;
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
 * HOW it knows, which is what keeps it from sticking. Each hold has more than
 * one way to end, and every one of them is checked:
 *   - a PRESS ends on its release, listened for on the WINDOW (a drag that
 *     leaves the element still ends it), by ANY of the events a release can
 *     arrive as (`RELEASE_EVENTS`: a native drag ends in `dragend`, not
 *     `pointerup`), and, as the net under those, by the first pointer movement
 *     that reports no button down;
 *   - the KEYBOARD holds it only when focus ARRIVED by keyboard (the browser
 *     drew a ring for it as it came in), and only until focus leaves the
 *     element or the visitor reaches for the pointer. "Is `:focus-visible`
 *     inside" alone is not the test: a browser turns the ring on for a control
 *     that was CLICKED as soon as any key is pressed, which held the demo for a
 *     visitor who clicked a tab and then scrolled with the space bar;
 *   - the tab is read from the document (`useSyncExternalStore`), never copied
 *     into state.
 *
 * What does NOT hold it, each tried and removed:
 *   - HOVER: a visitor watching a demo rests the mouse on it, so it stopped the
 *     moment it had their attention and read as stuck;
 *   - a WHEEL event or a passing touch: that is what scrolling the PAGE past
 *     the thing produces (the browser cancels a press the moment it becomes a scroll);
 *   - focus the browser shows no ring for: a browser re-reports focus when its
 *     window is re-activated, and a mouse click on a control is not the keyboard.
 */
export function useAutoplay(onScreen: boolean): UseAutoplayResult {
  const reducedState = usePrefersReducedMotionState();
  const tabHidden = useSyncExternalStore(subscribeToTab, tabIsHidden, never);

  // The element the handlers are on: known from the first event it receives, so no ref has to be threaded to it.
  const host = useRef<HTMLElement | null>(null);
  // True from the moment focus comes in by keyboard until it leaves or the pointer is used.
  const keyboardCameIn = useRef(false);
  const subscribeToKeyboard = useCallback((onChange: () => void) => {
    const usedPointer = () => {
      keyboardCameIn.current = false;
      onChange();
    };
    const stopFocus = listen(document, ['focusin', 'focusout', 'visibilitychange'], onChange);
    const stopPointer = listen(document, ['pointerdown', 'pointermove'], usedPointer);
    const stopWindow = listen(window, ['focus', 'blur'], onChange);
    return () => {
      stopFocus();
      stopPointer();
      stopWindow();
    };
  }, []);
  const keyboardIsInside = useCallback(() => {
    if (!keyboardCameIn.current) return false;
    const inside = !!host.current?.isConnected && host.current.contains(document.activeElement);
    if (!inside) keyboardCameIn.current = false;
    return inside;
  }, []);
  const focused = useSyncExternalStore(subscribeToKeyboard, keyboardIsInside, never);

  const [pressed, setPressed] = useState(false);
  const holdProps = useMemo<AutoplayHoldProps>(
    () => ({
      onPointerDown: event => {
        host.current = event.currentTarget;
        setPressed(true);
        // One release ends it, wherever and however it happens; the same signal removes every listener.
        const released = new AbortController();
        const release = () => {
          setPressed(false);
          released.abort();
        };
        for (const type of RELEASE_EVENTS) window.addEventListener(type, release, { signal: released.signal });
        // The net: a pointer that moves with no button down has been released, whatever was or was not reported.
        window.addEventListener(
          'pointermove',
          (move: globalThis.PointerEvent) => {
            if (move.buttons === 0) release();
          },
          { signal: released.signal },
        );
      },
      onFocus: event => {
        host.current = event.currentTarget;
        // Only focus that arrives by keyboard holds it (the browser draws its ring as it comes in).
        if (event.target.matches(':focus-visible')) keyboardCameIn.current = true;
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
