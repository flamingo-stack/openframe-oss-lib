'use client'

import { createContext, useContext } from 'react'
import type { BoardColumnDef } from './types'

/** The move that was reported, so we can show it and recognise it arriving. */
export interface PendingMove {
  ticketId: string
  /** The lane it came from — what tells a lane change apart from a reorder. */
  fromColumnId: string
  toColumnId: string
  /** The card it was dropped after, or `null` for the head of the lane. */
  afterTicketId: string | null
}

/**
 * `columns` with a move that has been reported but not yet answered already
 * applied — what the board renders between the drop and the host's new data.
 *
 * A drop cannot repaint the board from the host's data in the same frame it
 * happens: the host is told about the move through `onChange` and answers with
 * new `columns`, and no data layer worth using is synchronous about that —
 * react-query, for one, notifies its subscribers from a `setTimeout(0)`, which
 * is a whole macrotask (and therefore at least one paint) after the drop event.
 * Rendering the host's answer literally therefore means the card is still in its
 * old lane for that gap and arrives in the new one afterwards.
 *
 * Hiding the card across the gap was the previous answer, and it is why a drop
 * read as the ticket vanishing and reappearing somewhere else. Showing the move
 * immediately is the same optimistic update every board of this kind does, and
 * it makes the handover invisible: the host's answer, when it comes, describes
 * exactly the picture already on screen.
 *
 * Untouched columns keep their identity so the memoized lanes can skip the
 * render.
 */
export function applyPendingMove(columns: BoardColumnDef[], move: PendingMove): BoardColumnDef[] {
  const ticket = columns.flatMap(column => column.tickets).find(t => t.id === move.ticketId)
  if (!ticket || !columns.some(column => column.id === move.toColumnId)) return columns

  return columns.map(column => {
    const without = column.tickets.filter(t => t.id !== move.ticketId)
    if (column.id !== move.toColumnId) {
      return without.length === column.tickets.length ? column : { ...column, tickets: without }
    }
    return { ...column, tickets: insertAfter(without, ticket, move.afterTicketId) }
  })
}

function insertAfter<T extends { id: string }>(tickets: T[], ticket: T, afterId: string | null): T[] {
  if (afterId === null) return [ticket, ...tickets]
  const after = tickets.findIndex(t => t.id === afterId)
  // The card it was dropped after is gone — archived, or moved by someone else
  // while this drag was in the air. The end of the lane is the honest answer,
  // and the host's own reply overrides it a moment later anyway.
  const at = after < 0 ? tickets.length : after + 1
  return [...tickets.slice(0, at), ticket, ...tickets.slice(at)]
}

/**
 * The id of the card currently flying from the pointer into the slot it was
 * dropped in — hidden for exactly that long, because the drag preview is
 * covering it.
 *
 * Only the one card cares, which is why this is an id and not a flag on every
 * card.
 */
export const LandingCardContext = createContext<string | null>(null)

/** True while this card is under the preview travelling into its slot. */
export function useIsLanding(ticketId: string): boolean {
  return useContext(LandingCardContext) === ticketId
}

/**
 * Whether THIS move has reached `columns`, so the board can stop standing in for
 * the host and render its data plainly again.
 *
 * Two weaker tests were tried and both hand back too early, at which point the
 * board snaps to whatever the host currently says — the card jumping back to its
 * old lane for a frame:
 *
 * - The identity of the `columns` array. A host on react-query hands the board a
 *   fresh one whenever anything notifies — a cancelled refetch, a loading flag,
 *   a live update on an untouched lane.
 * - The card no longer sitting at its old index. Each lane here polls on its own
 *   timer and takes live updates, so a ticket arriving above this one shifts the
 *   index and reads as "the move landed" when nothing of the sort happened.
 *
 * A lane change and a reorder need different tests, though, and using the strict
 * one for both is what left a card to jump seconds after it landed:
 *
 * - **Across lanes**, arriving in the new lane IS the host applying the move.
 *   Which slot it ends up in is then the host's business — a server that sorts a
 *   lane its own way will not reproduce the dropped index, and holding out for
 *   one it will never send means showing a position that is quietly wrong until
 *   the timeout corrects it in a visible jump. The old lane has to have let go
 *   of the card as well: the two lanes are separate queries answering at their
 *   own pace, and standing aside in between would show the card in both.
 * - **Within one lane** the card is in that lane either way, so only the exact
 *   slot distinguishes "applied" from "not yet".
 *
 * Answering "not yet" for a move the host never applies is safe: the board gives
 * up on it after a timeout regardless, and the card returns to where the host
 * says it is — which is the correct thing to show once a move has failed.
 */
export function hasMoveSettled(columns: readonly BoardColumnDef[], move: PendingMove): boolean {
  const tickets = columns.find(c => c.id === move.toColumnId)?.tickets
  if (!tickets) return false
  const index = tickets.findIndex(t => t.id === move.ticketId)
  if (index < 0) return false
  if (move.fromColumnId === move.toColumnId) {
    return (tickets[index - 1]?.id ?? null) === move.afterTicketId
  }
  return !columns.find(c => c.id === move.fromColumnId)?.tickets.some(t => t.id === move.ticketId)
}
