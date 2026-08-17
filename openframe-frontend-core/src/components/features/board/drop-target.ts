import {
  closestCorners,
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
  type UniqueIdentifier,
} from '@dnd-kit/core'

export type CollisionArgs = Parameters<CollisionDetection>[0]

/** Data every board droppable carries, so a collision can be read back. */
export interface BoardDroppableData {
  type?: 'ticket' | 'column'
  columnId?: string
}

function droppableDataOf(collision: Collision): BoardDroppableData | undefined {
  return collision.data?.droppableContainer?.data?.current as BoardDroppableData | undefined
}

/**
 * Picks the one droppable a drop would land in. The board registers two kinds —
 * a ticket (`type: 'ticket'`) and a column (`type: 'column'`) — and the order
 * below is what turns "somewhere over that lane" into a concrete position:
 *
 * 1. a ticket under the pointer wins outright: it is the anchor the move is
 *    ordered against (`afterTicketId` / `beforeTicketId`);
 * 2. otherwise a column under the pointer (its empty space, its header, the gap
 *    between two cards) resolves to the nearest ticket *inside that column*, so
 *    the drop still gets a position; an empty column returns itself, which the
 *    board reads as "append";
 * 3. otherwise nothing is under the pointer and geometry alone decides.
 *
 * `pointerHits` is passed in already computed: the caller has to know whether
 * the pointer hit anything at all before it decides to run this — see
 * {@link createDropTargetResolver}. With a pointer, step 3 and the
 * `rectIntersection` fallback are only ever reached on the first collision of a
 * drag; they stay for the keyboard sensor, which drags with no pointer at all.
 */
export function detectCollisions(args: CollisionArgs, pointerHits: Collision[]): Collision[] {
  const intersections = pointerHits.length > 0 ? pointerHits : rectIntersection(args)

  const ticketHit = intersections.find(c => droppableDataOf(c)?.type === 'ticket')
  if (ticketHit) return [ticketHit]

  const columnHit = intersections.find(c => droppableDataOf(c)?.type === 'column')
  if (columnHit) {
    const { columnId } = droppableDataOf(columnHit) ?? {}
    // The dragged card is a droppable too, and it is the one card that must not
    // be the answer: a collision on the active id reads as "no change" and the
    // move is dropped, which would swallow a legitimate hover over a column.
    const ticketsInColumn = args.droppableContainers.filter(container => {
      if (container.id === args.active.id) return false
      const data = container.data.current as BoardDroppableData | undefined
      return data?.type === 'ticket' && data.columnId === columnId
    })
    if (ticketsInColumn.length > 0) {
      const closest = closestCorners({ ...args, droppableContainers: ticketsInColumn })
      if (closest.length > 0) return closest
    }
    return [columnHit]
  }

  return closestCorners(args)
}

/** Schedules `callback` for after the current frame; returns a canceller. */
export type FrameScheduler = (callback: () => void) => () => void

const animationFrameScheduler: FrameScheduler = callback => {
  const id = requestAnimationFrame(callback)
  return () => cancelAnimationFrame(id)
}

export interface DropTargetResolver {
  /** Pass straight to `DndContext`'s `collisionDetection`. */
  detect: CollisionDetection
  /** Call right before a state update moves a card between columns. */
  freeze: () => void
  /**
   * Call from an effect keyed on the moved list, so the freeze outlives the
   * commit that caused it rather than a fixed slice of wall clock.
   *
   * `freeze` alone releases one frame after the HANDLER runs, which assumes the
   * state update it guards has committed by then. That holds today — dnd-kit
   * dispatches `onDragOver` from an effect, so the update flushes in the same
   * commit phase — but it is an assumption about scheduling, and React is free
   * to break it. Re-arming from the commit removes the assumption.
   *
   * A no-op while nothing is frozen, and the frame `freeze` scheduled stays as a
   * ceiling: a move that resolves to no change commits nothing, and the guard
   * still has to open on its own.
   */
  settle: () => void
  /** Call on drag start / end / cancel. */
  release: () => void
  /** Call on unmount — drops any pending frame. */
  dispose: () => void
}

/**
 * {@link detectCollisions} plus the two rules that keep the answer stable. Both
 * exist because moving a card to another column re-mounts it under a different
 * parent, so dnd-kit unregisters + re-registers its droppable and re-measures
 * EVERY rect — and dnd-kit dispatches `onDragOver` from an effect keyed on the
 * over id, so any target change that a move causes schedules another move.
 *
 * 1. **Freeze after a move.** For one frame after a cross-column move the last
 *    target is returned verbatim. The re-measure → re-collide → `onDragOver`
 *    cascade runs synchronously off the state update, so releasing on the next
 *    frame lands strictly after it: a move can never trigger the next one.
 *    Without this the two columns keep handing the card back and forth inside a
 *    single commit until React aborts the tree ("Maximum update depth exceeded").
 * 2. **Hold when the pointer is over nothing.** In the lane between two columns
 *    or off the board, the rect-based fallback ranks columns by how much the
 *    dragged card's rect overlaps each — and that ranking flips as soon as a
 *    move re-lays out the lists, so the card ping-pongs while the pointer sits
 *    perfectly still. The drop target only changes when the pointer is inside
 *    something.
 *
 * Kept out of the component (and out of React) so both rules are unit-testable:
 * pass a manual {@link FrameScheduler} to step frames by hand.
 */
export function createDropTargetResolver(scheduleFrame: FrameScheduler = animationFrameScheduler): DropTargetResolver {
  let settling = false
  let cancelFrame: (() => void) | null = null
  let lastOverId: UniqueIdentifier | null = null

  const clearFrame = () => {
    cancelFrame?.()
    cancelFrame = null
  }

  /** Replaces any pending release with a fresh one, one frame out. */
  const scheduleRelease = () => {
    clearFrame()
    cancelFrame = scheduleFrame(() => {
      cancelFrame = null
      settling = false
    })
  }

  const keepLastTarget = (args: CollisionArgs): Collision[] | null => {
    if (lastOverId === null) return null
    const last = args.droppableContainers.find(c => c.id === lastOverId)
    return last ? [{ id: last.id, data: { droppableContainer: last, value: 0 } }] : null
  }

  return {
    detect: args => {
      if (settling) {
        const frozen = keepLastTarget(args)
        if (frozen) return frozen
      }

      const pointerHits = args.pointerCoordinates ? pointerWithin(args) : []
      if (args.pointerCoordinates && pointerHits.length === 0) {
        const held = keepLastTarget(args)
        if (held) return held
      }

      const collisions = detectCollisions(args, pointerHits)
      // Only remember a real answer: forgetting on an empty result would drop
      // the guard exactly when it is needed, and the next frame would fall back
      // to the rect ranking that ping-pongs.
      if (collisions.length > 0) lastOverId = collisions[0].id
      return collisions
    },

    freeze: () => {
      settling = true
      scheduleRelease()
    },

    settle: () => {
      if (settling) scheduleRelease()
    },

    release: () => {
      clearFrame()
      settling = false
      lastOverId = null
    },

    dispose: clearFrame,
  }
}
