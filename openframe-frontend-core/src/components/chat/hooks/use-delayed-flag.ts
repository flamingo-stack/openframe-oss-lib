"use client"

import { useEffect, useRef, useState } from "react"

interface UseDelayedFlagOptions {
  /** Wait this long before flipping the returned flag to `true`. Default 200ms. */
  delay?: number
  /**
   * Once the flag has gone `true`, hold it for at least this long even if
   * the source signal flips back to `false` sooner. Prevents a sub-frame
   * flash when the operation finishes right after the loader appeared.
   * Default 400ms.
   */
  minDuration?: number
}

/**
 * Debounce + min-hold gate for transient boolean flags (most useful for
 * loading indicators).
 *
 *  - source `true`  → wait `delay` ms; if still true, flip output to `true`
 *  - source `false` → if output is `true`, hold for `minDuration - elapsed`
 *    ms before flipping back; otherwise flip immediately
 *
 * The net effect: fast operations never trigger the indicator, and slow
 * ones always show it for long enough to avoid a flicker.
 */
export function useDelayedFlag(
  source: boolean,
  { delay = 200, minDuration = 400 }: UseDelayedFlagOptions = {},
): boolean {
  const [active, setActive] = useState(false)
  const activatedAtRef = useRef<number | null>(null)

  useEffect(() => {
    if (source) {
      if (active) return
      const timer = window.setTimeout(() => {
        activatedAtRef.current = Date.now()
        setActive(true)
      }, delay)
      return () => window.clearTimeout(timer)
    }

    if (!active) return
    const elapsed = activatedAtRef.current ? Date.now() - activatedAtRef.current : minDuration
    const remaining = Math.max(0, minDuration - elapsed)
    const timer = window.setTimeout(() => {
      activatedAtRef.current = null
      setActive(false)
    }, remaining)
    return () => window.clearTimeout(timer)
  }, [source, active, delay, minDuration])

  return active
}
