'use client'

import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge'
import { createContext, useContext } from 'react'
import type { BoardTicket } from './types'

/**
 * Where the drop currently points, resolved once for the whole board.
 *
 * Each card used to work this out for itself, from its own hover events. That
 * only ever answers for a card the pointer is physically over, so the moment the
 * pointer left the lanes — over the filters, between two columns, below the last
 * card — the preview vanished even though the drop would still have landed
 * somewhere. Resolving it in one place and handing it down means the preview
 * follows the answer wherever the answer came from.
 */
export interface DropAim {
  columnId: string
  /** The card the preview hangs off, or `null` for a lane with nothing in it. */
  ticketId: string | null
  /** Which side of that card. Meaningless when `ticketId` is `null`. */
  edge: Edge | null
  /** The card being carried, drawn faded in the room it opened. */
  ticket: BoardTicket
}

export const DropAimContext = createContext<DropAim | null>(null)

/**
 * Picking a card up from the keyboard. Separate from the aim so a card can offer
 * it without subscribing to something that changes on every pointer move.
 */
export const BoardLiftContext = createContext<((ticketId: string) => void) | null>(null)

export function useBoardLift(): ((ticketId: string) => void) | null {
  return useContext(BoardLiftContext)
}

/** Null while no drag is pointing anywhere the board would accept. */
export function useDropAim(): DropAim | null {
  return useContext(DropAimContext)
}

/** Whether two aims would draw the same thing — used to keep a pointer moving
 *  inside one card from re-rendering the board on every frame. */
export function isSameAim(a: DropAim | null, b: DropAim | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.columnId === b.columnId && a.ticketId === b.ticketId && a.edge === b.edge
}
