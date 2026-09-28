import { describe, expect, it } from 'vitest';
import { applyPendingMove, hasMoveSettled, type PendingMove } from '../components/features/board/pending-move';
import type { BoardColumnDef } from '../components/features/board/types';

const ticket = (id: string) => ({ id, title: id, ticketNumber: `#${id}`, status: 'open' });

const columns = (open: string[], done: string[]): BoardColumnDef[] => [
  { id: 'open', label: 'Open', color: '#5ea700', tickets: open.map(ticket) },
  { id: 'done', label: 'Done', color: '#1f6feb', tickets: done.map(ticket) },
];

/** `a2` was dragged out of Open and dropped into Done, straight after `b1`. */
const MOVE: PendingMove = { ticketId: 'a2', fromColumnId: 'open', toColumnId: 'done', afterTicketId: 'b1' };

describe('hasMoveSettled', () => {
  it('is unsettled while the card is still in the lane it came from', () => {
    expect(hasMoveSettled(columns(['a1', 'a2', 'a3'], ['b1', 'b2']), MOVE)).toBe(false);
  });

  it('settles when the card turns up exactly where it was dropped', () => {
    expect(hasMoveSettled(columns(['a1', 'a3'], ['b1', 'a2', 'b2']), MOVE)).toBe(true);
  });

  // The failure this test exists for: each lane polls on its own timer and takes
  // live updates, so the lane a card came FROM changes for reasons that have
  // nothing to do with the move. Reading any of that as "landed" uncovers the
  // card in its old place — the flash the whole mechanism exists to remove.
  it('stays unsettled when the lane it came from changes for unrelated reasons', () => {
    expect(hasMoveSettled(columns(['a0', 'a1', 'a2', 'a3'], ['b1', 'b2']), MOVE)).toBe(false);
    expect(hasMoveSettled(columns(['a2'], ['b1', 'b2']), MOVE)).toBe(false);
  });

  // A server free to sort the destination lane its own way will never reproduce
  // the dropped index. Holding out for one it will not send means the board
  // shows a position it has already been told is wrong, until the timeout jerks
  // it into place seconds later.
  it('settles anywhere in the new lane once the old one has let go', () => {
    expect(hasMoveSettled(columns(['a1', 'a3'], ['a2', 'b1', 'b2']), MOVE)).toBe(true);
    expect(hasMoveSettled(columns(['a1', 'a3'], ['b1', 'b2', 'a2']), MOVE)).toBe(true);
  });

  // The two lanes are separate queries and answer at their own pace. Handing
  // back while both still list the card shows it in two places at once.
  it('stays unsettled while both lanes still list the card', () => {
    expect(hasMoveSettled(columns(['a1', 'a2', 'a3'], ['b1', 'a2', 'b2']), MOVE)).toBe(false);
  });

  it('recognises a drop at the head of a lane', () => {
    const toHead: PendingMove = { ticketId: 'a2', fromColumnId: 'open', toColumnId: 'done', afterTicketId: null };
    expect(hasMoveSettled(columns(['a1', 'a3'], ['a2', 'b1']), toHead)).toBe(true);
  });

  // Within one lane the card is in that lane whether the move landed or not, so
  // here the exact slot is the only thing that can answer.
  it('holds a reorder inside one lane to the exact slot', () => {
    const withinLane: PendingMove = { ticketId: 'a1', fromColumnId: 'open', toColumnId: 'open', afterTicketId: 'a2' };
    expect(hasMoveSettled(columns(['a1', 'a2', 'a3'], []), withinLane)).toBe(false);
    expect(hasMoveSettled(columns(['a2', 'a1', 'a3'], []), withinLane)).toBe(true);
  });

  it('is unsettled when the lane it was dropped into is gone', () => {
    expect(hasMoveSettled([{ id: 'open', label: 'Open', color: '#5ea700', tickets: [] }], MOVE)).toBe(false);
  });
});

describe('applyPendingMove', () => {
  it('shows the card in the lane it was dropped into, in the slot it was dropped in', () => {
    const moved = applyPendingMove(columns(['a1', 'a2', 'a3'], ['b1', 'b2']), MOVE);
    expect(moved[0].tickets.map(t => t.id)).toEqual(['a1', 'a3']);
    expect(moved[1].tickets.map(t => t.id)).toEqual(['b1', 'a2', 'b2']);
  });

  it('drops the card at the head of the lane', () => {
    const toHead: PendingMove = { ticketId: 'a2', fromColumnId: 'open', toColumnId: 'done', afterTicketId: null };
    const moved = applyPendingMove(columns(['a1', 'a2'], ['b1']), toHead);
    expect(moved[1].tickets.map(t => t.id)).toEqual(['a2', 'b1']);
  });

  it('reorders inside one lane', () => {
    const within: PendingMove = { ticketId: 'a1', fromColumnId: 'open', toColumnId: 'open', afterTicketId: 'a3' };
    const moved = applyPendingMove(columns(['a1', 'a2', 'a3'], []), within);
    expect(moved[0].tickets.map(t => t.id)).toEqual(['a2', 'a3', 'a1']);
  });

  // The whole point of the optimistic view: once the host agrees, applying the
  // move to its answer has to be a no-op, or handing back would move the card
  // a second time.
  it('is idempotent once the host has caught up', () => {
    const settled = columns(['a1', 'a3'], ['b1', 'a2', 'b2']);
    expect(hasMoveSettled(settled, MOVE)).toBe(true);
    const moved = applyPendingMove(settled, MOVE);
    expect(moved[0].tickets.map(t => t.id)).toEqual(['a1', 'a3']);
    expect(moved[1].tickets.map(t => t.id)).toEqual(['b1', 'a2', 'b2']);
  });

  it('appends when the card it was dropped after is gone', () => {
    const moved = applyPendingMove(columns(['a1', 'a2'], ['b2']), MOVE);
    expect(moved[1].tickets.map(t => t.id)).toEqual(['b2', 'a2']);
  });

  it('leaves untouched lanes identical, so memoized lanes can skip the render', () => {
    const before = columns(['a1', 'a2'], ['b1']);
    const extra = [...before, { id: 'cold', label: 'Cold', color: '#333', tickets: [ticket('c1')] }];
    const moved = applyPendingMove(extra, MOVE);
    expect(moved[2]).toBe(extra[2]);
  });

  it('changes nothing when the card or the lane is unknown', () => {
    const before = columns(['a1'], ['b1']);
    expect(applyPendingMove(before, { ...MOVE, ticketId: 'ghost' })).toBe(before);
    expect(applyPendingMove(before, { ...MOVE, toColumnId: 'ghost' })).toBe(before);
  });
});
