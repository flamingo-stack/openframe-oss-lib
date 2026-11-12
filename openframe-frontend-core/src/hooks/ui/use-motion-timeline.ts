'use client';

import { useEffect, useState } from 'react';
import { createMotionTimeline, type MotionTimeline } from '../../utils/motion-timeline';

/**
 * A scene's `MotionTimeline` for as long as the component lives: held whenever `playing` is false (the host's rule,
 * usually `useAutoplay(...).playing` and its own pause button), stopped on unmount. The host schedules its beats and
 * calls `start` once the scene is ready to move.
 */
export function useMotionTimeline(playing: boolean): MotionTimeline {
  const [timeline] = useState(createMotionTimeline);
  useEffect(() => {
    timeline.setHeld(!playing);
  }, [timeline, playing]);
  useEffect(() => () => timeline.stop(), [timeline]);
  return timeline;
}
