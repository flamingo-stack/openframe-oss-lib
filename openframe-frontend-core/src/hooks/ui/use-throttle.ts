'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Hook to throttle a value
 * @param value - Value to throttle
 * @param limit - Throttle limit in milliseconds
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, limit = 200): T {
  const [throttledValue, setThrottledValue] = useState<T>(value);
  // The clock is read in a lazy `useState` initialiser, which runs exactly
  // once. `useRef(Date.now())` looks equivalent but is not: the argument is
  // evaluated on EVERY render even though only the first call uses it, so the
  // component reads the clock during render forever after.
  const [mountedAt] = useState(() => Date.now());
  const lastUpdated = useRef<number>(mountedAt);

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastUpdated.current;

    // If enough time has elapsed, update the throttled value
    if (elapsed >= limit) {
      setThrottledValue(value);
      lastUpdated.current = now;
      return undefined;
    }

    // Otherwise, set up a timeout to update after the limit
    const timerId = setTimeout(() => {
      setThrottledValue(value);
      lastUpdated.current = Date.now();
    }, limit - elapsed);

    return () => {
      clearTimeout(timerId);
    };
  }, [value, limit]);

  return throttledValue;
}
