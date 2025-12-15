"use client"

import { useState, useEffect, useRef } from "react"

/**
 * Hook to throttle a value
 * @param value - Value to throttle
 * @param limit - Throttle limit in milliseconds
 * @returns Throttled value
 */
export function useThrottle<T>(value: T, limit = 200): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastUpdated = useRef<number>(Date.now())

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastUpdated.current

    // If enough time has elapsed, update the throttled value
    if (elapsed >= limit) {
      setThrottledValue(value)
      lastUpdated.current = now
    } else {
      // Otherwise, set up a timeout to update after the limit
      const timerId = setTimeout(() => {
        setThrottledValue(value)
        lastUpdated.current = Date.now()
      }, limit - elapsed)

      return () => {
        clearTimeout(timerId)
      }
    }
  }, [value, limit])

  return throttledValue
}
