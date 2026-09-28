import { attachClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { describe, expect, it } from 'vitest';
import { resolveBoardDrop } from '../components/features/board/resolve-drop';
import type { BoardColumnDef } from '../components/features/board/types';

const ticket = (id: string) => ({ id, title: id, ticketNumber: `#${id}`, status: 'open' });

const COLUMNS: BoardColumnDef[] = [
  { id: 'open', label: 'Open', color: '#5ea700', tickets: ['a1', 'a2', 'a3'].map(ticket) },
  { id: 'done', label: 'Done', color: '#1f6feb', tickets: ['b1', 'b2'].map(ticket) },
];

/** A card drop target, with the edge attached the way the hitbox does it. */
function overCard(ticketId: string, columnId: string, edge: 'top' | 'bottom') {
  const height = 100;
  const top = edge === 'top' ? 0 : 0;
  const element = {
    getBoundingClientRect: () => ({ top, left: 0, right: 300, bottom: top + height, width: 300, height, x: 0, y: top }),
  } as unknown as Element;
  return attachClosestEdge(
    { type: 'ticket', ticketId, columnId },
    // A pointer near the top of the box resolves to 'top', near the bottom to
    // 'bottom' — that is the hitbox's own rule, so the fixture uses it rather
    // than hand-writing the symbol it stores the edge under.
    {
      input: { clientX: 150, clientY: edge === 'top' ? top + 5 : top + height - 5 } as never,
      element,
      allowedEdges: ['top', 'bottom'],
    },
  );
}

const overLane = (columnId: string) => ({ type: 'column', columnId });
const dragging = (ticketId: string, columnId: string) => ({ type: 'ticket', ticketId, columnId });

describe('resolveBoardDrop', () => {
  it('reports nothing when the card is released outside every target', () => {
    expect(resolveBoardDrop(COLUMNS, { source: dragging('a1', 'open'), target: undefined })).toBeNull();
  });

  it('lands above the card whose top edge is closest', () => {
    const change = resolveBoardDrop(COLUMNS, { source: dragging('a1', 'open'), target: overCard('b2', 'done', 'top') });
    expect(change).toMatchObject({ toColumnId: 'done', afterTicketId: 'b1', beforeTicketId: 'b2' });
  });

  it('lands below the card whose bottom edge is closest', () => {
    const change = resolveBoardDrop(COLUMNS, {
      source: dragging('a1', 'open'),
      target: overCard('b1', 'done', 'bottom'),
    });
    expect(change).toMatchObject({ toColumnId: 'done', afterTicketId: 'b1', beforeTicketId: 'b2' });
  });

  it('appends when the card is dropped on the lane rather than on a card', () => {
    const change = resolveBoardDrop(COLUMNS, { source: dragging('a1', 'open'), target: overLane('done') });
    expect(change).toMatchObject({ toColumnId: 'done', afterTicketId: 'b2', beforeTicketId: null });
  });

  it('does not count the dragged card as its own neighbour', () => {
    // Moving a1 below a2 within its own lane: if a1 were still in the list, the
    // neighbour would come out as a1 itself and the move would be a no-op.
    const change = resolveBoardDrop(COLUMNS, {
      source: dragging('a1', 'open'),
      target: overCard('a2', 'open', 'bottom'),
    });
    expect(change).toMatchObject({ afterTicketId: 'a2', beforeTicketId: 'a3' });
  });

  it('reports nothing when the card is dropped back where it already was', () => {
    // a2 released just below a1 — exactly its current slot.
    expect(
      resolveBoardDrop(COLUMNS, { source: dragging('a2', 'open'), target: overCard('a1', 'open', 'bottom') }),
    ).toBeNull();
  });

  it('treats a drop on the first card top edge as the head of the lane', () => {
    const change = resolveBoardDrop(COLUMNS, { source: dragging('a1', 'open'), target: overCard('b1', 'done', 'top') });
    expect(change).toMatchObject({ afterTicketId: null, beforeTicketId: 'b1' });
  });
});
