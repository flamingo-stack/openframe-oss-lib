import { describe, expect, it } from 'vitest'
import type { ClientRect, Collision, DroppableContainer, UniqueIdentifier } from '@dnd-kit/core'
import {
  createDropTargetResolver,
  detectCollisions,
  type BoardDroppableData,
  type CollisionArgs,
  type FrameScheduler,
} from '../components/features/board/drop-target'

// ---------------------------------------------------------------------------
// Fixtures — a two-lane board laid out by hand. dnd-kit's collision helpers are
// pure functions over rects, so no DOM layout is needed to exercise them.
//
//   x:  0        400   416       816        lane width 400, 16px lane gap
//   COL-A cards at x 0..400, COL-B cards at x 416..816
// ---------------------------------------------------------------------------

const rect = (left: number, top: number, width: number, height: number): ClientRect => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
})

interface Droppable {
  id: UniqueIdentifier
  data: BoardDroppableData
  rect: ClientRect
}

const LANE_A: Droppable = { id: 'column:a', data: { type: 'column', columnId: 'a' }, rect: rect(0, 0, 400, 800) }
const LANE_B: Droppable = { id: 'column:b', data: { type: 'column', columnId: 'b' }, rect: rect(416, 0, 400, 800) }
const A1: Droppable = { id: 'a1', data: { type: 'ticket', columnId: 'a' }, rect: rect(8, 48, 384, 100) }
const A2: Droppable = { id: 'a2', data: { type: 'ticket', columnId: 'a' }, rect: rect(8, 156, 384, 100) }
const B1: Droppable = { id: 'b1', data: { type: 'ticket', columnId: 'b' }, rect: rect(424, 48, 384, 100) }
const B2: Droppable = { id: 'b2', data: { type: 'ticket', columnId: 'b' }, rect: rect(424, 156, 384, 100) }

function makeArgs(options: {
  droppables: Droppable[]
  activeId?: UniqueIdentifier
  pointer?: { x: number; y: number } | null
  /** Rect of the card being dragged; defaults to sitting over the lane gap. */
  collisionRect?: ClientRect
}): CollisionArgs {
  const { droppables, activeId = 'a1', pointer = null, collisionRect = rect(200, 300, 384, 100) } = options

  const containers = droppables.map(
    d =>
      ({
        id: d.id,
        key: String(d.id),
        disabled: false,
        node: { current: null },
        rect: { current: d.rect },
        data: { current: d.data },
      }) as unknown as DroppableContainer,
  )

  return {
    active: { id: activeId, data: { current: null }, rect: { current: { initial: null, translated: null } } },
    collisionRect,
    droppableRects: new Map(droppables.map(d => [d.id, d.rect])),
    droppableContainers: containers,
    pointerCoordinates: pointer,
  } as unknown as CollisionArgs
}

const idsOf = (collisions: Collision[]) => collisions.map(c => c.id)
const pointerHitsOf = (args: CollisionArgs, hits: UniqueIdentifier[]): Collision[] =>
  hits.map(id => {
    const container = args.droppableContainers.find(c => c.id === id)
    if (!container) throw new Error(`fixture has no droppable ${String(id)}`)
    return { id, data: { droppableContainer: container, value: 0 } }
  })

/** A scheduler whose frames only advance when the test says so. */
function manualFrames() {
  let pending: (() => void)[] = []
  const schedule: FrameScheduler = callback => {
    pending.push(callback)
    return () => {
      pending = pending.filter(p => p !== callback)
    }
  }
  return {
    schedule,
    tick: () => {
      const due = pending
      pending = []
      for (const cb of due) cb()
    },
    get pendingCount() {
      return pending.length
    },
  }
}

describe('detectCollisions', () => {
  it('prefers a ticket under the pointer over its lane', () => {
    const args = makeArgs({ droppables: [LANE_B, B1, B2], pointer: { x: 600, y: 98 } })
    const collisions = detectCollisions(args, pointerHitsOf(args, [LANE_B.id, B1.id]))
    expect(idsOf(collisions)).toEqual(['b1'])
  })

  it('resolves a lane-only hit to the nearest ticket inside that lane', () => {
    // Pointer in lane B's empty space below both cards: the answer must still be
    // a ticket, so the move lands at a position instead of "somewhere in B".
    // `closestCorners` ranks every candidate; dnd-kit reads the first one.
    const args = makeArgs({ droppables: [LANE_B, B1, B2], pointer: { x: 600, y: 700 } })
    const collisions = detectCollisions(args, pointerHitsOf(args, [LANE_B.id]))
    expect(idsOf(collisions)).toEqual(['b2', 'b1'])
  })

  it('never answers with the dragged card itself', () => {
    // Dragging b2 over its own lane's empty space: b2 is the geometrically
    // closest ticket, but returning it reads as "no change" and swallows the move.
    const args = makeArgs({ droppables: [LANE_B, B1, B2], activeId: 'b2', pointer: { x: 600, y: 700 } })
    const collisions = detectCollisions(args, pointerHitsOf(args, [LANE_B.id]))
    expect(idsOf(collisions)).toEqual(['b1'])
  })

  it('falls back to the lane itself when it holds no other ticket', () => {
    const args = makeArgs({ droppables: [LANE_B, B1], activeId: 'b1', pointer: { x: 600, y: 700 } })
    const collisions = detectCollisions(args, pointerHitsOf(args, [LANE_B.id]))
    expect(idsOf(collisions)).toEqual(['column:b'])
  })

  it('ranks by rect overlap when there is no pointer at all (keyboard drag)', () => {
    const args = makeArgs({
      droppables: [LANE_A, LANE_B, A1, B1],
      pointer: null,
      collisionRect: rect(424, 48, 384, 100), // exactly over B1
    })
    expect(idsOf(detectCollisions(args, []))[0]).toBe('b1')
  })
})

describe('createDropTargetResolver', () => {
  it('holds the last target while the pointer is over nothing', () => {
    const resolver = createDropTargetResolver(manualFrames().schedule)
    const droppables = [LANE_A, LANE_B, A1, A2, B1, B2]

    const overB1 = makeArgs({ droppables, pointer: { x: 600, y: 98 } })
    expect(idsOf(resolver.detect(overB1))).toEqual(['b1'])

    // Pointer parked in the 16px lane gap: nothing is under it. Without the hold
    // this falls to rect ranking, which flips between the lanes as the lists
    // re-lay out — the ping-pong that crashed React with #185.
    const inGap = makeArgs({ droppables, pointer: { x: 408, y: 98 } })
    expect(idsOf(resolver.detect(inGap))).toEqual(['b1'])
    expect(idsOf(resolver.detect(inGap))).toEqual(['b1'])
  })

  it('freezes the target for exactly one frame after a move', () => {
    const frames = manualFrames()
    const resolver = createDropTargetResolver(frames.schedule)
    const droppables = [LANE_A, LANE_B, A1, A2, B1, B2]

    resolver.detect(makeArgs({ droppables, pointer: { x: 600, y: 98 } })) // target = b1
    resolver.freeze()

    // Same frame: whatever the re-measured geometry now says, the answer holds.
    const overA1 = makeArgs({ droppables, pointer: { x: 200, y: 98 } })
    expect(idsOf(resolver.detect(overA1))).toEqual(['b1'])

    frames.tick()
    expect(idsOf(resolver.detect(overA1))).toEqual(['a1'])
  })

  it('re-arms the freeze window on every move instead of stacking frames', () => {
    const frames = manualFrames()
    const resolver = createDropTargetResolver(frames.schedule)
    resolver.detect(makeArgs({ droppables: [LANE_B, B1], pointer: { x: 600, y: 98 } }))

    resolver.freeze()
    resolver.freeze()
    resolver.freeze()
    expect(frames.pendingCount).toBe(1)
  })

  it('release drops both the freeze and the remembered target', () => {
    const frames = manualFrames()
    const resolver = createDropTargetResolver(frames.schedule)
    const droppables = [LANE_A, LANE_B, A1, B1]

    resolver.detect(makeArgs({ droppables, pointer: { x: 600, y: 98 } }))
    resolver.freeze()
    resolver.release()

    // Nothing held any more: over-nothing now resolves by geometry again, which
    // is what a fresh drag must do.
    const inGap = makeArgs({ droppables, pointer: { x: 408, y: 98 }, collisionRect: rect(424, 48, 384, 100) })
    expect(idsOf(resolver.detect(inGap))).toEqual(['b1'])
    expect(frames.pendingCount).toBe(0)
  })

  it('keeps the remembered target when a resolution comes back empty', () => {
    const frames = manualFrames()
    const resolver = createDropTargetResolver(frames.schedule)

    resolver.detect(makeArgs({ droppables: [LANE_B, B1], pointer: { x: 600, y: 98 } }))
    // Board unmounted its lanes mid-drag: no droppables, so no collision. The
    // resolver must not forget — the next hold has to have something to hold.
    expect(resolver.detect(makeArgs({ droppables: [], pointer: { x: 600, y: 98 } }))).toEqual([])
    expect(idsOf(resolver.detect(makeArgs({ droppables: [LANE_B, B1], pointer: { x: 408, y: 98 } })))).toEqual(['b1'])
  })

  it('dispose cancels a pending freeze frame', () => {
    const frames = manualFrames()
    const resolver = createDropTargetResolver(frames.schedule)
    resolver.freeze()
    resolver.dispose()
    expect(frames.pendingCount).toBe(0)
  })
})
