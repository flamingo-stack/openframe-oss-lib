import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import {
  autoScrollForElements,
  autoScrollWindowForElements,
} from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'
import { unsafeOverflowAutoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element'
import { scrollableAncestorsOf } from './scroll-parent'

/**
 * How far past a scroller's edge a drag still counts as "scroll this".
 *
 * Big on purpose: past the edge there is nothing else to hit, so the only
 * question is whether the intent is obvious, and dragging beyond a container is
 * about as obvious as intent gets.
 */
const OVERFLOW_REACH = 5000

const overflow = () => ({
  forTopEdge: { top: OVERFLOW_REACH, left: OVERFLOW_REACH, right: OVERFLOW_REACH },
  forBottomEdge: { bottom: OVERFLOW_REACH, left: OVERFLOW_REACH, right: OVERFLOW_REACH },
  forLeftEdge: { left: OVERFLOW_REACH, top: OVERFLOW_REACH, bottom: OVERFLOW_REACH },
  forRightEdge: { right: OVERFLOW_REACH, top: OVERFLOW_REACH, bottom: OVERFLOW_REACH },
})

/** Straight up and straight down only — no sideways reach at all. */
const verticalOverflow = () => ({
  forTopEdge: { top: OVERFLOW_REACH },
  forBottomEdge: { bottom: OVERFLOW_REACH },
})

/**
 * Registers drag auto-scroll for one scroller, both **inside** its edges and
 * **past** them.
 *
 * Pragmatic's over-element scrolling only engages in a band just inside the
 * edge, so a drag that has already left the container stops scrolling it — you
 * have to hunt for the strip where it works. dnd-kit kept scrolling however far
 * out you went, and `unsafeOverflowAutoScrollForElements` is Pragmatic's own
 * answer for that; "unsafe" here only means it can reach a container the pointer
 * is not over, which is exactly what is wanted.
 */
export function autoScrollBothWays(element: HTMLElement): () => void {
  return combine(
    autoScrollForElements({ element }),
    unsafeOverflowAutoScrollForElements({ element, getOverflow: overflow }),
  )
}

/**
 * Auto-scroll for one of several scrollers standing side by side — a board lane.
 *
 * Same as {@link autoScrollBothWays} except that its reach past the edges is
 * vertical only, and that is the whole point. Lanes sit shoulder to shoulder, so
 * a reach that also spreads sideways puts a pointer below the board inside
 * EVERY lane's overflow region at once and scrolls all of them together. Keeping
 * the region to the lane's own width means the pointer is below exactly one
 * lane, and only that lane moves — which is what a board is expected to do.
 */
export function autoScrollColumn(element: HTMLElement): () => void {
  return combine(
    autoScrollForElements({ element }),
    unsafeOverflowAutoScrollForElements({ element, getOverflow: verticalOverflow }),
  )
}

/**
 * Registers auto-scroll on every scrollable ancestor of `element`, and on the
 * window.
 *
 * dnd-kit walked the ancestor chain for you; Pragmatic makes each scroller opt
 * in by name, which is why dragging towards the edge of the screen stopped
 * scrolling anything after the migration. Registering the window alone would
 * have fixed nothing either: the app's real scroller is the layout's `<main>`,
 * not the document — so the chain has to be walked.
 *
 * Registration is passive; a scroller only moves while a drag is actually near
 * its edge, so it is safe to call this once on mount.
 *
 * Register this ONCE per page region, not once per thing that can be dragged:
 * Pragmatic keeps one entry per registration and each entry scrolls on its own,
 * so registering the same `<main>` from five lanes scrolls it five times as
 * fast.
 */
export function autoScrollAncestors(element: HTMLElement): () => void {
  const cleanups = scrollableAncestorsOf(element).map(autoScrollBothWays)
  // Cheap and harmless when the document itself does not scroll, and the only
  // thing that works when it does.
  cleanups.push(autoScrollWindowForElements())
  return combine(...cleanups)
}
