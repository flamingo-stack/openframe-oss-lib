'use client'

import { useRef, type RefObject } from 'react'
import { useIsomorphicLayoutEffect } from '../../../hooks/ui/use-isomorphic-layout-effect'
import type { BoardTicket } from './types'

/** Attribute the lane's cards carry so the anchor can find them again. */
export const TICKET_ID_ATTRIBUTE = 'data-ticket-id'

interface CardPosition {
  id: string
  /**
   * Position in LAYOUT space, absolute within the lane — not the painted one.
   * `offsetTop` ignores transforms, so a card mid-animation reads at its resting
   * position and the correction below stays honest. Absolute rather than
   * viewport-relative so that scrolling between two list changes — the drag's own
   * auto-scroll, most of all — cannot stale the reading.
   */
  offsetTop: number
}

function cardPositions(root: HTMLElement): CardPosition[] {
  return Array.from(root.querySelectorAll<HTMLElement>(`[${TICKET_ID_ATTRIBUTE}]`)).map(element => ({
    id: element.getAttribute(TICKET_ID_ATTRIBUTE) ?? '',
    offsetTop: element.offsetTop,
  }))
}

/**
 * Keeps a scrolled lane visually still when its list changes above the viewport.
 *
 * Browsers do this themselves — it is called scroll anchoring — but the lane turns
 * theirs off (`overflow-anchor:none`), because leaving both on double-corrects
 * every insertion. So a ticket arriving from a live update is inserted above the
 * viewport with nothing to compensate, and the whole list slides down by a card.
 *
 * NOTE: the original reason for taking this over by hand was that Chrome skips
 * anchor candidates carrying a `transform`, and dnd-kit transformed every card in
 * the lane during a drag. Nothing transforms cards any more, so the browser's own
 * anchoring may well be enough now — worth testing against live updates before
 * deleting this and the `overflow-anchor:none` that goes with it.
 *
 * The fix is one measurement: whichever card sits at the top of the viewport,
 * note where it is, and after the list changes put the viewport back the same
 * distance from it.
 *
 * Deliberately inert at the very top of a lane (`scrollTop === 0`), matching what
 * browsers do — there a new ticket is meant to be seen, not scrolled away.
 */
export function useLaneScrollAnchor(
  scrollRef: RefObject<HTMLDivElement | null>,
  tickets: readonly BoardTicket[],
): void {
  const positionsRef = useRef<CardPosition[]>([])

  useIsomorphicLayoutEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const previous = positionsRef.current
    const scrollTop = root.scrollTop
    // Measured once and reused: this runs for every lane on every list change —
    // live updates, the host's refetch, every committed move — and reading
    // `offsetTop` after the DOM changed forces a synchronous layout.
    const current = cardPositions(root)

    if (previous.length > 0 && scrollTop > 0) {
      // The card at the top of the viewport right now, by its previous position.
      const anchor = previous.find(card => card.offsetTop >= scrollTop) ?? previous[previous.length - 1]
      const moved = current.find(card => card.id === anchor.id)
      if (moved) {
        const drift = moved.offsetTop - anchor.offsetTop
        if (Math.abs(drift) >= 1) root.scrollTop = scrollTop + drift
      }
    }

    positionsRef.current = current
  }, [tickets])
}
