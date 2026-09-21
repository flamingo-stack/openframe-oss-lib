'use client';

import { useEffect, useState } from 'react';
import type { TimeTrackerStatus } from './types';

export interface UseTrackerClockArgs {
  status: TimeTrackerStatus;
  /** Epoch ms the current running segment started (only used while tracking). */
  runningSince?: number | null;
  /** Elapsed ms accrued before the current running segment. */
  accumulatedMs?: number;
}

function formatElapsed(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Display-only timer. Ticks once per second while `status === 'tracking'`; otherwise
 * renders the static `accumulatedMs`. Returns a formatted `HH:MM:SS` string.
 */
export function useTrackerClock({ status, runningSince, accumulatedMs = 0 }: UseTrackerClockArgs): string {
  const [now, setNow] = useState(() => Date.now());

  // The wall clock is the external system here, and `setInterval` is the
  // subscription to it. The seed read shares the subscription's callback rather
  // than being a separate setState in the effect body — without it the label
  // would show the previous segment's elapsed time for up to a second after
  // tracking starts.
  useEffect(() => {
    if (status !== 'tracking') return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, runningSince]);

  const liveMs = status === 'tracking' && runningSince ? now - runningSince : 0;
  return formatElapsed(accumulatedMs + liveMs);
}
