'use client';

import { useEffect, useRef, useState } from 'react';

export interface UseResumableTimeoutOptions {
  /** The wait counts down only while this is true. */
  running: boolean;
  /** How long the whole wait is. */
  durationMs: number;
  /** A new value starts the wait over from nothing (the slide changed). */
  resetKey: string | number;
  /** Called once the whole wait has been run. */
  onElapsed: () => void;
}

/**
 * A wait that PAUSES instead of starting over: `durationMs` of time spent
 * `running`, however many times it is interrupted. A carousel that scrolls off
 * screen half-way through a slide comes back with half a slide left, not a
 * whole one, and the bar that shows the wait picks up where it stopped.
 *
 * Returns how much of the wait had been run at the last stop (0 after a
 * reset), which is what a progress bar draws while it is not running and
 * where it resumes from.
 */
export function useResumableTimeout({ running, durationMs, resetKey, onElapsed }: UseResumableTimeoutOptions): number {
  // What has been run so far, for the key it was run under. The ref is the
  // clock's own memory (read when a stretch starts); the state is the same
  // figure for whoever draws it.
  const banked = useRef({ key: resetKey, ms: 0 });
  const [shown, setShown] = useState({ key: resetKey, ms: 0 });

  const onElapsedRef = useRef(onElapsed);
  useEffect(() => {
    onElapsedRef.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    // A new key: the wait starts over.
    if (banked.current.key !== resetKey) banked.current = { key: resetKey, ms: 0 };
    if (!running) return undefined;
    const startedAt = Date.now();
    const timer = setTimeout(() => onElapsedRef.current(), Math.max(0, durationMs - banked.current.ms));
    return () => {
      clearTimeout(timer);
      // Bank what this stretch ran.
      const ms = Math.min(durationMs, banked.current.ms + (Date.now() - startedAt));
      banked.current = { key: resetKey, ms };
      setShown({ key: resetKey, ms });
    };
  }, [running, durationMs, resetKey]);

  // Under another key (the slide changed) nothing has been run yet.
  return shown.key === resetKey ? shown.ms : 0;
}
