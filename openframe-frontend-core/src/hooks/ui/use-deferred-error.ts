'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UseDeferredErrorResult {
  /** The message to render (undefined while the reveal is deferred or the field is valid). */
  error: string | undefined;
  /** Attach to the field's onBlur — reveals validation immediately and keeps it live from then on. */
  onBlur: () => void;
}

/**
 * Defers showing a field validation message while the user is still typing.
 *
 * The message is revealed when the field loses focus (touched) or when the
 * value hasn't changed for `delay` ms; every keystroke restarts the timer.
 * Once touched, validation stays live. A message that clears (the value became
 * valid) disappears immediately.
 */
export function useDeferredError(error: string | undefined, value: string, delay = 1500): UseDeferredErrorResult {
  const [touched, setTouched] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pausedFor, setPausedFor] = useState(value);

  // Typing hides the message: React's "adjust state while rendering" reset, not
  // an effect. The keystroke has already scheduled this render, so clearing
  // `paused` here costs nothing, whereas doing it from the effect below commits
  // a render with the stale message still on screen and then immediately
  // re-renders to remove it.
  if (pausedFor !== value) {
    setPausedFor(value);
    setPaused(false);
  }

  // …and restarts the pause timer.
  useEffect(() => {
    if (touched) return undefined;
    const timer = setTimeout(() => setPaused(true), delay);
    return () => clearTimeout(timer);
  }, [value, delay, touched]);

  const onBlur = useCallback(() => setTouched(true), []);

  return {
    error: error && (touched || paused) ? error : undefined,
    onBlur,
  };
}
