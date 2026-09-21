import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { describe, expect, it } from 'vitest';
import { aimAnchor, aimFromTarget, aimToChange, initialAim, moveAim } from '../components/features/board/aim';
import type { BoardColumnDef } from '../components/features/board/types';

const ticket = (id: string) => ({ id, title: id, ticketNumber: `#${id}`, status: 'open' });

const COLUMNS: BoardColumnDef[] = [
  { id: 'open', label: 'Open', color: '#5ea700', tickets: ['a1', 'a2', 'a3'].map(ticket) },
  { id: 'locked', label: 'Locked', color: '#888888', tickets: ['c1'].map(ticket), dropDisabled: true },
  { id: 'done', label: 'Done', color: '#1f6feb', tickets: ['b1', 'b2'].map(ticket) },
  { id: 'empty', label: 'Empty', color: '#333333', tickets: [] },
];

const accepts = (column: BoardColumnDef) => !column.dropDisabled;

describe('initialAim', () => {
  it('starts a card exactly where it already sits', () => {
    expect(initialAim(COLUMNS, 'a2')).toEqual({ columnId: 'open', index: 1 });
  });

  it('has nowhere to start from for a card that is on no lane', () => {
    expect(initialAim(COLUMNS, 'nope')).toBeNull();
  });
});

describe('moveAim', () => {
  const aim = { columnId: 'open', index: 1 };

  it('steps through slots with up and down', () => {
    expect(moveAim(COLUMNS, 'a2', aim, 'ArrowUp', accepts)).toEqual({ columnId: 'open', index: 0 });
    expect(moveAim(COLUMNS, 'a2', aim, 'ArrowDown', accepts)).toEqual({ columnId: 'open', index: 2 });
  });

  // The dragged card is not among the slots it can take, so a lane of three has
  // three landing places for it, not four.
  it('stops at the ends of a lane', () => {
    expect(moveAim(COLUMNS, 'a2', { columnId: 'open', index: 0 }, 'ArrowUp', accepts)).toEqual({
      columnId: 'open',
      index: 0,
    });
    expect(moveAim(COLUMNS, 'a2', { columnId: 'open', index: 2 }, 'ArrowDown', accepts)).toEqual({
      columnId: 'open',
      index: 2,
    });
  });

  it('skips a lane that will not take the card rather than stopping at it', () => {
    expect(moveAim(COLUMNS, 'a2', aim, 'ArrowRight', accepts)).toEqual({ columnId: 'done', index: 1 });
  });

  it('keeps the slot it had, as far as the new lane allows', () => {
    expect(moveAim(COLUMNS, 'a2', { columnId: 'open', index: 2 }, 'ArrowRight', accepts)).toEqual({
      columnId: 'done',
      index: 2,
    });
    expect(moveAim(COLUMNS, 'a2', { columnId: 'done', index: 2 }, 'ArrowRight', accepts)).toEqual({
      columnId: 'empty',
      index: 0,
    });
  });

  it('stays put at the ends of the board', () => {
    const first = { columnId: 'open', index: 1 };
    expect(moveAim(COLUMNS, 'a2', first, 'ArrowLeft', accepts)).toBe(first);
    const last = { columnId: 'empty', index: 0 };
    expect(moveAim(COLUMNS, 'a2', last, 'ArrowRight', accepts)).toBe(last);
  });
});

describe('aimFromTarget', () => {
  const overCard = (ticketId: string, columnId: string, edge: 'top' | 'bottom') => {
    const element = {
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 300, bottom: 100, width: 300, height: 100, x: 0, y: 0 }),
    } as unknown as Element;
    return attachClosestEdge(
      { type: 'ticket', ticketId, columnId },
      { input: { clientX: 150, clientY: edge === 'top' ? 5 : 95 } as never, element, allowedEdges: ['top', 'bottom'] },
    );
  };

  // The flicker this exists to stop: a hit test answers with whichever card the
  // pointer happens to be over, so ONE landing place arrives as "below a3" one
  // frame and "above b-nothing" the next. As an index they are the same slot, so
  // the line has one position to be drawn at instead of two to jump between.
  it('reads the same slot from either side of one boundary', () => {
    const below = aimFromTarget(COLUMNS, 'a2', overCard('a1', 'open', 'bottom'));
    const above = aimFromTarget(COLUMNS, 'a2', overCard('a3', 'open', 'top'));
    expect(below).toEqual(above);
  });

  it('counts slots among the other cards, never the one being moved', () => {
    expect(aimFromTarget(COLUMNS, 'a2', overCard('a3', 'open', 'bottom'))).toEqual({ columnId: 'open', index: 2 });
    expect(aimFromTarget(COLUMNS, 'a2', overCard('a1', 'open', 'top'))).toEqual({ columnId: 'open', index: 0 });
  });

  it('reads a lane target as past the last card', () => {
    expect(aimFromTarget(COLUMNS, 'a2', { type: 'column', columnId: 'done' })).toEqual({ columnId: 'done', index: 2 });
  });

  it('has no answer for a lane the board does not have', () => {
    expect(aimFromTarget(COLUMNS, 'a2', { type: 'column', columnId: 'gone' })).toBeNull();
  });
});

describe('aimAnchor', () => {
  it('hangs the preview above the card it would push down', () => {
    expect(aimAnchor(COLUMNS, 'a2', { columnId: 'open', index: 0 })).toEqual({ ticketId: 'a1', edge: 'top' });
  });

  it('hangs it below the last card when it would land at the end', () => {
    expect(aimAnchor(COLUMNS, 'a2', { columnId: 'open', index: 2 })).toEqual({ ticketId: 'a3', edge: 'bottom' });
  });

  it('has nothing to hang off in an empty lane', () => {
    expect(aimAnchor(COLUMNS, 'a2', { columnId: 'empty', index: 0 })).toEqual({ ticketId: null, edge: null });
  });
});

describe('aimToChange', () => {
  it('reports nothing when the card would land back where it started', () => {
    expect(aimToChange(COLUMNS, 'a2', { columnId: 'open', index: 1 })).toBeNull();
  });

  it('reports a move within one lane', () => {
    expect(aimToChange(COLUMNS, 'a2', { columnId: 'open', index: 0 })).toEqual({
      ticketId: 'a2',
      fromColumnId: 'open',
      toColumnId: 'open',
      afterTicketId: null,
      beforeTicketId: 'a1',
    });
  });

  it('reports a move to another lane', () => {
    expect(aimToChange(COLUMNS, 'a2', { columnId: 'done', index: 1 })).toEqual({
      ticketId: 'a2',
      fromColumnId: 'open',
      toColumnId: 'done',
      afterTicketId: 'b1',
      beforeTicketId: 'b2',
    });
  });

  it('reports a move into an empty lane', () => {
    expect(aimToChange(COLUMNS, 'a2', { columnId: 'empty', index: 0 })).toMatchObject({
      toColumnId: 'empty',
      afterTicketId: null,
      beforeTicketId: null,
    });
  });
});
