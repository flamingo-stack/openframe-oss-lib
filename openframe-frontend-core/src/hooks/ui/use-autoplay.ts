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

// Keyboard focus: also the document's own state. Whatever can move it re-asks the question.
const subscribeToFocus = (onChange: () => void) => {
  const stopDocument = listen(document, ['focusin', 'focusout', 'visibilitychange'], onChange);
  const stopWindow = listen(window, ['focus', 'blur'], onChange);
  return () => {
    stopDocument();
    stopWindow();
  };
};

const never = () => false;

/** Whether the keyboard is inside `host`: focus the browser draws a ring for, on it or within it. */
function keyboardIsInside(host: HTMLElement | null): boolean {
  if (!host?.isConnected) return false;
  try {
    return host.matches(':focus-visible, :has(:focus-visible)');
  } catch {
    // An engine without `:has()`: no keyboard hold, never a thrown render.
    return false;
  }
}

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
 * HOW it knows, which is what keeps it from sticking:
 *   - the tab and the keyboard's focus are READ FROM THE DOCUMENT
 *     (`useSyncExternalStore`), never copied into state and kept in step by
 *     hand. "Is the keyboard inside" is one selector asked of the element
 *     (`:has(:focus-visible)`), so a tab switch, an app switch or a focused
 *     control that is removed cannot leave a stale "yes" behind;
 *   - a press is the one thing with a beginning and an end: it starts on the
 *     element and its release is listened for on the WINDOW, once, by listeners
 *     that remove themselves (a drag that leaves the element, or a scroll the
 *     browser takes over, still ends it).
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
  const focused = useSyncExternalStore(
    subscribeToFocus,
    useCallback(() => keyboardIsInside(host.current), []),
    never,
  );

  const [pressed, setPressed] = useState(false);
  const holdProps = useMemo<AutoplayHoldProps>(
    () => ({
      onPointerDown: event => {
        host.current = event.currentTarget;
        setPressed(true);
        // One release ends it, wherever it happens; the same signal removes all three listeners.
        const released = new AbortController();
        const release = () => {
          setPressed(false);
          released.abort();
        };
        for (const type of ['pointerup', 'pointercancel', 'blur']) {
          window.addEventListener(type, release, { signal: released.signal });
        }
      },
      // Only names the element: the focus store asks the document whether the keyboard is inside it.
      onFocus: event => {
        host.current = event.currentTarget;
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
