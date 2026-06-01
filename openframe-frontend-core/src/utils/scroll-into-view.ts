/**
 * `scrollElementIntoView` — canonical "scroll an element to the top of the
 * viewport, account for sticky chrome, survive layout shifts" helper.
 *
 * One shared implementation so every caller (the ticket drawer expand, the
 * hub's `useUnifiedNav` / `use-nav-link` hash scroll, doc-tree, delivery
 * `?focus=`, sticky-section-nav, …) inherits the SAME cancellation-proof
 * motion.
 *
 * WHY A SELF-DRIVEN rAF TWEEN INSTEAD OF `window.scrollTo({behavior:'smooth'})`:
 * the native smooth scroll is CANCELLABLE, and in real pages it gets cancelled
 * constantly:
 *
 *   - Browser SCROLL ANCHORING: when content is inserted/removed above or
 *     around the target (a collapsible drawer expanding, an async image
 *     loading, a list re-rendering) the browser issues a synchronous scrollTop
 *     correction to keep the anchored element stable. Per CSSOM-View "perform a
 *     scroll" step 1 ("abort any ongoing smooth scroll"), that correction
 *     ABORTS an in-flight native smooth scroll — so it lands as an instant jump.
 *     Anchoring is suppressed when the scroll offset is 0, which is exactly why
 *     a native smooth scroll appears to work the FIRST time (page at top) and
 *     jumps on every repeat (page already scrolled). This was a multi-day
 *     "smooth only works once" bug on the /tickets drawer.
 *   - A second programmatic scroll on the same frame, or a `focus()` without
 *     `{preventScroll:true}`, cancels it the same way.
 *
 * A tween that re-asserts the position with INSTANT writes every frame is
 * immune: there is no "ongoing native smooth scroll" for anchoring/focus to
 * abort, and any correction that lands between our frames is overwritten on the
 * next frame. We also RECOMPUTE the target each frame, so an element whose
 * final position is still settling (drawer still expanding, images loading)
 * is tracked to its resting place instead of animating to a stale pixel.
 *
 * Honors `prefers-reduced-motion` (jumps instantly) and cancels on genuine user
 * scroll intent (wheel / touch) so we never fight the user.
 */

export interface ScrollElementIntoViewOptions {
  /** Pixels to subtract from the target element's `top` so it lands BELOW
   *  sticky chrome. Defaults to 0. Pass `96` for the standard hub header. */
  headerOffset?: number
  /** `'smooth'` (default) runs the self-driven tween; `'instant'` / `'auto'`
   *  jump in one synchronous write (deep-link land, programmatic focus moves). */
  behavior?: ScrollBehavior
  /** Optional adjustment applied to the computed pixel target each frame. The
   *  callback receives the "raw" Y (`element.top + scrollY - headerOffset`) and
   *  returns the FINAL target. Use when the caller knows about a layout shift
   *  (e.g. a sibling drawer collapsing) the geometry can't yet reflect. */
  adjustTargetY?: (rawTargetY: number) => number
  /** Tween duration in ms (smooth only). Default 320. */
  durationMs?: number
}

/** Module-level handle to the in-flight tween so a new call (or a user
 *  gesture) cancels the previous one — only ever one page-scroll animation at
 *  a time. */
let activeRaf = 0
let teardownActive: (() => void) | null = null

function cancelActiveScroll(): void {
  if (activeRaf) {
    cancelAnimationFrame(activeRaf)
    activeRaf = 0
  }
  if (teardownActive) {
    teardownActive()
    teardownActive = null
  }
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

/**
 * Scroll the page so `target` lands at the top of the viewport (below sticky
 * chrome via `headerOffset`). SSR-safe; `null`/`undefined` target is a no-op so
 * callers can pass refs without defensive branching.
 */
export function scrollElementIntoView(
  target: HTMLElement | null | undefined,
  options: ScrollElementIntoViewOptions = {},
): void {
  if (typeof window === 'undefined' || !target) return
  const { headerOffset = 0, behavior = 'smooth', adjustTargetY, durationMs = 320 } = options

  // Target is recomputed every frame: the row's absolute position can move as
  // the page reflows (a sibling drawer collapsing) and the reachable max grows
  // as the just-opened drawer expands. Clamp to the LIVE max each frame.
  const computeTarget = (): number => {
    const raw = target.getBoundingClientRect().top + window.scrollY - headerOffset
    const adjusted = adjustTargetY ? adjustTargetY(raw) : raw
    const maxScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    )
    return Math.min(Math.max(0, adjusted), maxScroll)
  }

  // Any prior animation loses — one page scroll at a time.
  cancelActiveScroll()

  const prefersReduced =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Instant paths: a single synchronous write. No tween, no anchoring race.
  if (behavior === 'instant' || behavior === 'auto' || prefersReduced) {
    window.scrollTo(0, computeTarget())
    return
  }

  // Smooth: self-driven tween with instant per-frame writes (anchoring-proof).
  let startY: number | null = null
  let startTime = 0

  // Bail the moment the user takes over with a real scroll gesture — we must
  // never fight them. (Not keydown: the ticket composer auto-focuses on open,
  // and typing there should not abort the scroll.)
  const onUserGesture = () => cancelActiveScroll()
  window.addEventListener('wheel', onUserGesture, { passive: true })
  window.addEventListener('touchmove', onUserGesture, { passive: true })
  teardownActive = () => {
    window.removeEventListener('wheel', onUserGesture)
    window.removeEventListener('touchmove', onUserGesture)
  }

  const step = (now: number) => {
    if (startY === null) {
      startY = window.scrollY
      startTime = now
    }
    const targetY = computeTarget()
    const t = Math.min(1, (now - startTime) / durationMs)
    const y = startY + (targetY - startY) * easeOutCubic(t)
    window.scrollTo(0, y)
    if (t < 1) {
      activeRaf = requestAnimationFrame(step)
    } else {
      // Final exact write in case easing left a sub-pixel gap, then teardown.
      window.scrollTo(0, computeTarget())
      activeRaf = 0
      if (teardownActive) {
        teardownActive()
        teardownActive = null
      }
    }
  }
  activeRaf = requestAnimationFrame(step)
}
