/**
 * The arithmetic behind a vertical sortable list: where a dragged item would
 * come to rest at each index, which of those places it is currently nearest to,
 * and how far that pushes everything else.
 *
 * Pure on purpose. The DOM is read exactly once, when the drag starts, and
 * everything after that is numbers — so the rules can be unit-tested instead of
 * discovered in a browser, and a card moving out of the way can never change the
 * answer that moved it and start an oscillation.
 */

/**
 * Share of one slot's travel that the slot an item already holds keeps as a
 * handicap.
 *
 * Without it an item ends up sitting exactly ON a boundary the instant it
 * crosses one: leaving a slot costs half an item of dragging and coming back
 * costs a pixel, which reads as the list changing its mind about the rules. The
 * handicap turns that into a dead band, so both cost the same movement — and a
 * boundary just crossed cannot be re-crossed by jitter, or by the hand simply
 * stopping.
 */
export const SLOT_STICKINESS = 0.25;

export interface DragSlots {
  /** Every item's top edge, before anything moved, measured from the list's own
   *  top rather than the viewport or the document — so a scroll during the drag
   *  (the page, the layout's `<main>`, any ancestor) leaves them all valid. */
  tops: number[];
  /** Every item's bottom edge, same frame of reference. */
  bottoms: number[];
  /** The dragged item's own height. */
  height: number;
  /** The index the drag started from. */
  from: number;
  /** How far a displaced item travels: the dragged item's height + the row gap. */
  step: number;
}

/**
 * Reads the list once, at drag start. The only DOM access in this module.
 *
 * `origin` is the list's own top edge in viewport coordinates; everything is
 * stored relative to it, so auto-scrolling an ancestor mid-drag moves the list
 * and the pointer together and none of this goes stale.
 */
export function measureSlots(items: readonly HTMLElement[], from: number, gap: number, origin: number): DragSlots {
  const rects = items.map(item => item.getBoundingClientRect());
  return {
    tops: rects.map(rect => rect.top - origin),
    bottoms: rects.map(rect => rect.bottom - origin),
    height: rects[from].height,
    from,
    step: rects[from].height + gap,
  };
}

/**
 * Where the dragged item's centre ends up if it is dropped at `index`.
 *
 * At or above its own index it takes over that item's top edge; below it, it
 * backs up against that item's bottom edge. With items of one height those are
 * the same point; with mixed heights they are not, and it is the resting place
 * the user is aiming at — not the neighbour's centre.
 */
function restingCentre(slots: DragSlots, index: number): number {
  return index <= slots.from ? slots.tops[index] + slots.height / 2 : slots.bottoms[index] - slots.height / 2;
}

/**
 * The slot the dragged item is now nearest to landing in, given the one it
 * currently holds and how far it has been dragged.
 *
 * Nearest — not "has crossed" — is what dnd-kit sorted by, and it is why the
 * list opens up when it does: nearest flips at the midpoint between two slots,
 * so half an item of travel is enough, where waiting for the item to cross a
 * neighbour outright takes twice as long and reads as late.
 */
export function resolveSlot(slots: DragSlots, held: number, offset: number): number {
  const centre = slots.tops[slots.from] + slots.height / 2 + offset;
  let best = Math.abs(centre - restingCentre(slots, held)) - slots.step * SLOT_STICKINESS;
  let next = held;
  for (let index = 0; index < slots.tops.length; index++) {
    if (index === held) continue;
    const distance = Math.abs(centre - restingCentre(slots, index));
    if (distance < best) {
      best = distance;
      next = index;
    }
  }
  return next;
}

/** How far the item at `index` has to stand aside while the drop is aimed at `to`. */
export function shiftFor(slots: DragSlots, index: number, to: number): number {
  if (index === slots.from) return 0;
  if (index > slots.from && index <= to) return -slots.step;
  if (index < slots.from && index >= to) return slots.step;
  return 0;
}
