import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import type { BoardChange, BoardColumnDef } from './types'

/**
 * Where a card being moved currently points: a lane, and a slot among the cards
 * ALREADY in it — the card being moved never counts as one of them.
 *
 * This is the board's ONE description of a landing place, and everything is
 * expressed in it: the pointer, the keyboard, the line that gets drawn and the
 * change that gets reported. An index cannot say the same thing two ways, which
 * matters more than it sounds — "below card X" and "above card Y" are the same
 * slot, and drawing a line for whichever one a hit test happened to return makes
 * it jump between two positions as the pointer crosses the boundary.
 */
export interface BoardAim {
  columnId: string
  /** Insertion index among the other cards, so `0..others.length`. */
  index: number
}

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight'

/** Whether a lane will take this card — the board's own rules, passed in so this
 *  module stays arithmetic. */
type LaneFilter = (column: BoardColumnDef) => boolean

const othersIn = (columns: readonly BoardColumnDef[], columnId: string, ticketId: string) =>
  (columns.find(c => c.id === columnId)?.tickets ?? []).filter(t => t.id !== ticketId)

/** The lane a card is in right now, or `null` if it is in none of them. */
export function laneOf(columns: readonly BoardColumnDef[], ticketId: string): BoardColumnDef | null {
  return columns.find(c => c.tickets.some(t => t.id === ticketId)) ?? null
}

/** Where a card starts: exactly where it already sits. */
export function initialAim(columns: readonly BoardColumnDef[], ticketId: string): BoardAim | null {
  const lane = laneOf(columns, ticketId)
  if (!lane) return null
  // Its index among the others is its own index: dropping it back at that slot
  // puts it exactly where it came from.
  return { columnId: lane.id, index: lane.tickets.findIndex(t => t.id === ticketId) }
}

/**
 * The aim after one arrow key, or the aim unchanged when the move would leave
 * the board or land in a lane that will not take the card.
 *
 * Up and down step through slots; left and right step through lanes, skipping
 * any the card is not allowed into rather than stopping dead at it — a lane the
 * user cannot use should cost a keypress, not end the journey.
 */
/**
 * The slot a resolved drop target points at.
 *
 * Card targets carry the edge the pointer is nearest; a lane target means "past
 * the last card". Either way the answer comes out as an index, so the caller
 * never has to care which kind of target replied.
 */
export function aimFromTarget(
  columns: readonly BoardColumnDef[],
  ticketId: string,
  target: Record<string | symbol, unknown>,
): BoardAim | null {
  const columnId = String(target.columnId)
  if (!columns.some(c => c.id === columnId)) return null
  const others = othersIn(columns, columnId, ticketId)
  if (target.type !== 'ticket') return { columnId, index: others.length }
  const over = others.findIndex(t => t.id === String(target.ticketId))
  if (over < 0) return { columnId, index: others.length }
  return { columnId, index: over + (extractClosestEdge(target) === 'bottom' ? 1 : 0) }
}

export function moveAim(
  columns: readonly BoardColumnDef[],
  ticketId: string,
  aim: BoardAim,
  key: ArrowKey,
  accepts: LaneFilter,
): BoardAim {
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    const limit = othersIn(columns, aim.columnId, ticketId).length
    const index = Math.min(Math.max(aim.index + (key === 'ArrowUp' ? -1 : 1), 0), limit)
    return index === aim.index ? aim : { ...aim, index }
  }

  const step = key === 'ArrowLeft' ? -1 : 1
  const from = columns.findIndex(c => c.id === aim.columnId)
  for (let i = from + step; i >= 0 && i < columns.length; i += step) {
    const column = columns[i]
    if (!accepts(column)) continue
    // Keep the slot the card had, as far as the new lane allows.
    const limit = othersIn(columns, column.id, ticketId).length
    return { columnId: column.id, index: Math.min(aim.index, limit) }
  }
  return aim
}

/** The card the preview hangs off, and which side of it — `null` for a lane with
 *  nothing else in it. */
export function aimAnchor(
  columns: readonly BoardColumnDef[],
  ticketId: string,
  aim: BoardAim,
): { ticketId: string | null; edge: 'top' | 'bottom' | null } {
  const others = othersIn(columns, aim.columnId, ticketId)
  if (others.length === 0) return { ticketId: null, edge: null }
  if (aim.index < others.length) return { ticketId: others[aim.index].id, edge: 'top' }
  return { ticketId: others[others.length - 1].id, edge: 'bottom' }
}

/**
 * The move to report, or `null` when the card would land back where it started.
 *
 * Same rule as a pointer drop, and deliberately so: a keyboard move that ends
 * where it began must be as silent as a card picked up and put down again.
 */
export function aimToChange(columns: readonly BoardColumnDef[], ticketId: string, aim: BoardAim): BoardChange | null {
  const lane = laneOf(columns, ticketId)
  if (!lane) return null

  const others = othersIn(columns, aim.columnId, ticketId)
  const afterTicketId = others[aim.index - 1]?.id ?? null
  const beforeTicketId = others[aim.index]?.id ?? null

  if (lane.id === aim.columnId) {
    const currentIndex = lane.tickets.findIndex(t => t.id === ticketId)
    if ((lane.tickets[currentIndex - 1]?.id ?? null) === afterTicketId) return null
  }

  return { ticketId, fromColumnId: lane.id, toColumnId: aim.columnId, afterTicketId, beforeTicketId }
}
