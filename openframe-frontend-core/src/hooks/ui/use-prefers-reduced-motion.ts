'use client';

import { useMediaQuery } from './use-media-query';

export const PREFERS_REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the visitor asked the system for reduced motion.
 *
 * `false` until the first client effect has read the media query, so a
 * server render and the first client render agree. Callers that must not
 * START an animation before the answer is known should gate on
 * `usePrefersReducedMotionState()` instead, which keeps the unknown state.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery(PREFERS_REDUCED_MOTION_QUERY) === true;
}

/** Same query, keeping `undefined` while the answer is not yet known. */
export function usePrefersReducedMotionState(): boolean | undefined {
  return useMediaQuery(PREFERS_REDUCED_MOTION_QUERY);
}
