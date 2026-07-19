import { useEffect } from 'react'

/**
 * Runs `reset` whenever the tab is hidden or the window loses focus — exactly the
 * moments a `pointerleave` / `pointercancel` can be SWALLOWED (tab blur, an
 * overlay mounting under the cursor, an interrupted pointer), which otherwise
 * leaves a hover/"inside" flag stuck `true` and freezes a marquee FOREVER. The
 * next real pointer/hover re-arms the flag.
 *
 * SSOT self-heal for every marquee surface (MarqueeWall, CardsStrip) so the
 * blur + `visibilitychange` wiring lives in one place. `reset` almost always
 * only UN-sticks state. The one edge: on `blur` WITHOUT the tab hiding (a second
 * window focused beside this one), clearing the hover-pause can let the marquee
 * resume under a still-stationary cursor in the now-unfocused window — it
 * re-pauses on the next `pointermove`/`pointerenter`. We keep the `blur` reset
 * anyway because it's the only signal that catches a tab-blur that swallows the
 * `pointerleave` without a `visibilitychange`. Pass a STABLE `reset` (memoize
 * with `useCallback`) — the listeners re-attach whenever its identity changes.
 */
export function useResetOnPageHidden(reset: () => void): void {
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') reset()
    }
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', reset)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [reset])
}
