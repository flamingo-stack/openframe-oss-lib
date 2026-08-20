import { TICKET_ID_ATTRIBUTE } from './use-lane-scroll-anchor'

/** Marks the line showing where a drop would land, wherever it is drawn — on a
 *  card or in an empty lane. The keyboard needs to find it to scroll it into
 *  view; a pointer drag brings its own scrolling. */
export const DROP_LINE_ATTRIBUTE = 'data-board-drop-line'

/**
 * The card in `lane` whose middle is nearest `pointerY`, ignoring the one being
 * dragged, or `null` if the lane holds no other card.
 *
 * Live rects rather than anything cached: cards carry margins mid-drag that push
 * them about. The dragged card is skipped by name and not by having no box —
 * it keeps its slot in the lane until another card takes over holding the room,
 * so it is a full-height rectangle sitting right where the pointer is.
 */
export function nearestCardIn(lane: ParentNode, pointerY: number, draggedTicketId: string): HTMLElement | null {
  let best: HTMLElement | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const card of lane.querySelectorAll<HTMLElement>(`[${TICKET_ID_ATTRIBUTE}]`)) {
    if (card.dataset.ticketId === draggedTicketId) continue
    const rect = card.getBoundingClientRect()
    if (rect.height === 0) continue
    const distance = Math.abs(pointerY - (rect.top + rect.height / 2))
    if (distance < bestDistance) {
      bestDistance = distance
      best = card
    }
  }
  return best
}

/**
 * One card by ticket id, anywhere under `root`.
 *
 * A loop rather than an attribute selector: ticket ids are opaque global ids
 * from the host and go straight into a selector string otherwise.
 */
export function cardById(root: ParentNode, ticketId: string): HTMLElement | null {
  for (const card of root.querySelectorAll<HTMLElement>(`[${TICKET_ID_ATTRIBUTE}]`)) {
    if (card.dataset.ticketId === ticketId) return card
  }
  return null
}
