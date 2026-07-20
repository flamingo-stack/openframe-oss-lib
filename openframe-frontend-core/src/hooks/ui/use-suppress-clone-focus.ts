'use client'

import { useEffect, useRef } from 'react'

// Every focusable a clone might contain — matched so it can be pulled out of the
// keyboard tab order (see useSuppressCloneFocus). `[contenteditable]:not(
// [contenteditable="false"])` catches the empty/`"true"`/`"plaintext-only"`
// editable forms; `summary` is focusable inside a <details>.
const CLONE_FOCUSABLE_SELECTOR =
  'a[href],button,input,select,textarea,iframe,summary,audio[controls],video[controls],[tabindex],[contenteditable]:not([contenteditable="false"])'

/**
 * Keep a marquee clone's content pointer-CLICKABLE while taking it out of the
 * accessibility tree and the keyboard tab order. Shared by every endless-loop
 * surface that renders a second track copy (<CardsStrip> managed cells,
 * <MarqueeWall> clone copies).
 *
 * `inert` (the previous approach) does all three at once: a11y-hidden,
 * un-focusable AND un-clickable. That third effect was the "news marquee stops
 * being clickable after you scroll it for a while" bug — the 2-copy endless
 * loop ALWAYS paints clone cards inside the viewport near the copy seam, so a
 * user who manually scrolls and parks there is looking at real-looking cards
 * that silently swallow every click. Clones must therefore stay clickable (a
 * click on ANY visible card must open its link — mouse, ⌘-click, middle-click
 * and context-menu all handled natively by the clone's own anchor).
 *
 * The a11y contract is still met without `inert`: the caller keeps
 * `aria-hidden` on the clone wrapper (out of the a11y tree) and this hook
 * forces every focusable descendant to `tabindex="-1"` (out of the tab order →
 * no duplicate tab stops, no aria-hidden-focus violation). Re-applied on
 * subtree mutation. This is the standard loop-clone treatment used by
 * Swiper/Splide.
 */
export function useSuppressCloneFocus(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || !active) return
    const suppress = () => {
      root.querySelectorAll<HTMLElement>(CLONE_FOCUSABLE_SELECTOR).forEach(el => {
        // Only stamp the ones not already stamped — avoids touching the DOM (and
        // clobbering an intentional tabindex) on every mutation.
        if (el.getAttribute('tabindex') !== '-1') el.setAttribute('tabindex', '-1')
      })
    }
    suppress()
    // Watch structure AND the attributes that can turn a descendant tabbable
    // (an anchor gaining `href`, React restoring `tabindex="0"`, an element
    // becoming editable, media gaining `controls`). The `!== '-1'` guard above
    // makes our own tabindex writes a no-op, so the observer never loops.
    const mo = new MutationObserver(suppress)
    mo.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'tabindex', 'contenteditable', 'controls'],
    })
    return () => mo.disconnect()
  }, [active])
  return ref
}
