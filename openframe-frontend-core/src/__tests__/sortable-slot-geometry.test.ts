import { describe, expect, it } from 'vitest'
import { type DragSlots, resolveSlot, shiftFor } from '../components/features/sortable-list/slot-geometry'

// Four items of different heights, 24px apart — mixed heights on purpose, since
// that is where "nearest neighbour's centre" and "nearest resting place" differ.
const HEIGHTS = [50, 70, 90, 60]
const GAP = 24

const TOPS = [0, 74, 168, 282]
const BOTTOMS = [50, 144, 258, 342]

const slotsFor = (from: number): DragSlots => ({
  tops: TOPS,
  bottoms: BOTTOMS,
  height: HEIGHTS[from],
  from,
  step: HEIGHTS[from] + GAP,
})

/**
 * The first offset, walking from `start` in `direction`, at which the held slot
 * changes. `start` matters: the return boundary has to be walked back from where
 * the item actually IS once it holds the new slot, not from zero.
 */
function boundary(slots: DragSlots, held: number, direction: 1 | -1, start = 0): number {
  for (let offset = start; Math.abs(offset) <= 600; offset += direction) {
    if (resolveSlot(slots, held, offset) !== held) return offset
  }
  throw new Error('no boundary found')
}

describe('resolveSlot', () => {
  const slots = slotsFor(0)

  it('holds its own slot until the item has travelled half a slot', () => {
    expect(resolveSlot(slots, 0, 0)).toBe(0)
    expect(resolveSlot(slots, 0, 40)).toBe(0)
    expect(resolveSlot(slots, 0, 80)).toBe(1)
  })

  it('walks a slot at a time rather than jumping to the end', () => {
    expect(resolveSlot(slots, 1, 160)).toBe(1)
    expect(resolveSlot(slots, 1, 200)).toBe(2)
    expect(resolveSlot(slots, 2, 300)).toBe(3)
  })

  // The complaint this exists to answer: without the handicap the item ends up
  // sitting exactly ON the boundary it just crossed, so leaving a slot costs
  // half an item of dragging and coming back costs a pixel.
  it('costs the same movement to leave a slot and to come back', () => {
    const out = boundary(slots, 0, 1)
    const back = boundary(slots, 1, -1, out)
    expect(out).toBeGreaterThan(back)

    // Both sit the same distance either side of the midpoint between the two
    // resting places — 25 and 119 here, so 72, i.e. an offset of 47.
    const midpoint = 47
    expect(out - midpoint).toBeCloseTo(midpoint - back, 0)
  })

  it('measures against resting places, not the neighbours own centres', () => {
    // Landing at index 1 puts a 50px item against item 1's BOTTOM edge (144),
    // i.e. centred at 119 — not at item 1's own centre of 109.
    expect(resolveSlot(slots, 0, 94)).toBe(1)
    expect(resolveSlot(slots, 1, 94)).toBe(1)
  })

  it('is symmetric for a drag that starts at the end of the list', () => {
    const fromLast = slotsFor(3)
    expect(resolveSlot(fromLast, 3, 0)).toBe(3)
    expect(resolveSlot(fromLast, 3, -120)).toBe(2)
    expect(resolveSlot(fromLast, 2, -10)).toBe(3)
  })
})

describe('shiftFor', () => {
  it('stands the passed items aside by exactly one slot', () => {
    const slots = slotsFor(0)
    expect(shiftFor(slots, 0, 2)).toBe(0)
    expect(shiftFor(slots, 1, 2)).toBe(-slots.step)
    expect(shiftFor(slots, 2, 2)).toBe(-slots.step)
    expect(shiftFor(slots, 3, 2)).toBe(0)
  })

  it('pushes the other way when the item is dragged upwards', () => {
    const slots = slotsFor(3)
    expect(shiftFor(slots, 3, 1)).toBe(0)
    expect(shiftFor(slots, 2, 1)).toBe(slots.step)
    expect(shiftFor(slots, 1, 1)).toBe(slots.step)
    expect(shiftFor(slots, 0, 1)).toBe(0)
  })

  it('moves nothing while the drop is still aimed at the slot it came from', () => {
    const slots = slotsFor(1)
    expect([0, 1, 2, 3].map(index => shiftFor(slots, index, 1))).toEqual([0, 0, 0, 0])
  })

  // Every displaced item travels the same distance whatever its own height:
  // removing the item from one slot and inserting it at another moves each item
  // in between by exactly the dragged item's height plus the gap.
  it('travels the dragged items height regardless of the displaced items own', () => {
    const slots = slotsFor(0)
    expect(new Set([1, 2, 3].map(index => shiftFor(slots, index, 3))).size).toBe(1)
  })
})
