/**
 * `scrollElementIntoView` — canonical "smooth scroll element to top
 * of viewport, account for sticky chrome, optionally adjust for
 * known layout shifts" helper.
 *
 * Before this util existed, ~3 different call sites in the lib + hub
 * had the same 5-line snippet copy-pasted with subtle differences:
 *
 *   - `useUnifiedNav` same-URL re-scroll branch (hub)
 *   - `<HelpCenterCard>` click-to-expand (lib, with cross-row
 *     layout-shift adjustment)
 *   - Future ticket-row / docs anchor scrolls
 *
 * The canonical pattern is `window.scrollTo({top, behavior:'smooth'})`
 * with a pre-computed pixel target — NOT `element.scrollIntoView()`.
 * Pre-computing the target lets the browser run a clean uninterrupted
 * smooth animation to a fixed pixel value. `scrollIntoView` re-targets
 * continuously as the page layout shifts during the animation, which
 * causes visible jitter when content above the target is also moving
 * (a sibling collapsing, an async image loading, …).
 *
 * The `adjustTargetY` callback is the escape hatch for cases where
 * the consumer KNOWS about an upcoming layout shift and can compute
 * the correct FINAL target before the animation starts. Example: in
 * `HelpCenterCard`, clicking row B while row A above is currently
 * expanded — A's drawer collapses simultaneously with B's expansion,
 * shifting B's tile up by A's drawer height. The consumer passes
 * `adjustTargetY: raw => raw - getAboveDrawerHeight()` and the
 * browser smooth-scrolls to the post-collapse position directly.
 */

export interface ScrollElementIntoViewOptions {
  /** Pixels to subtract from the target element's `top` so it lands
   *  BELOW sticky chrome. Defaults to 0. Pass `96` (matches
   *  `scroll-mt-24`) for the standard hub header offset. */
  headerOffset?: number
  /** Scroll animation style. Defaults to `'smooth'`. Use `'instant'`
   *  for imperative jumps where animation would feel laggy (deep
   *  link land, programmatic focus moves). */
  behavior?: ScrollBehavior
  /** Optional adjustment applied to the computed pixel target. The
   *  callback receives the "raw" Y (`element.top + scrollY -
   *  headerOffset`) and returns the FINAL pixel target. Use this
   *  when the caller knows about a layout shift that will happen
   *  between the call and the animation completing — the browser's
   *  smooth-scroll commits to a single pixel value, so providing the
   *  post-shift target up front lands the element correctly even as
   *  content above it moves. */
  adjustTargetY?: (rawTargetY: number) => number
}

/**
 * Scroll the page so `target` lands at the top of the viewport,
 * accounting for sticky chrome via `headerOffset`. Returns void; the
 * scroll runs async via the browser's smooth-scroll engine.
 *
 * Accepts:
 *   - `HTMLElement` — direct reference (most common from `useRef`).
 *   - `null` / `undefined` — no-op so callers can pass refs without
 *     defensive branching.
 *
 * SSR-safe: short-circuits when `window` is undefined.
 */
export function scrollElementIntoView(
  target: HTMLElement | null | undefined,
  options: ScrollElementIntoViewOptions = {},
): void {
  if (typeof window === 'undefined' || !target) return
  const { headerOffset = 0, behavior = 'smooth', adjustTargetY } = options
  const rawTargetY =
    target.getBoundingClientRect().top + window.scrollY - headerOffset
  const finalY = adjustTargetY ? adjustTargetY(rawTargetY) : rawTargetY
  window.scrollTo({ top: Math.max(0, finalY), behavior })
}
