import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Board } from '../components/features/board/board';
import type { BoardColumnDef } from '../components/features/board/types';

// The board picks its kind from this query: `true` the drag board, `false` the touch board.
function answerMediaQueries(matches: boolean) {
  const original = window.matchMedia;
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
  return () => {
    window.matchMedia = original;
  };
}

// jsdom has no ResizeObserver; the drag board's custom scrollbar measures with one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver ?? ResizeObserverStub;

const ticket = (id: string) => ({ id, title: `Ticket ${id}`, ticketNumber: `#${id}`, status: 'ACTIVE' });

const COLUMNS: BoardColumnDef[] = [
  { id: 'ACTIVE', label: 'Active', color: '#5ea62e', tickets: ['a1', 'a2'].map(ticket) },
  { id: 'RESOLVED', label: 'Resolved', color: '#888888', tickets: [] },
];

// A variable, as a host passes it (`var(--composer-dock-inset)`): jsdom folds two lengths into one.
const INSET = 'var(--composer-dock-inset)';
const INSET_STYLE = `padding-bottom: calc(5px + ${INSET})`;

let restore: (() => void) | null = null;
afterEach(() => {
  restore?.();
  restore = null;
});

describe('Board laneEndInset', () => {
  it.each([
    ['drag', true],
    ['touch', false],
  ])("keeps every lane's last card clear of what lies over the %s board's bottom", (_kind, matches) => {
    restore = answerMediaQueries(matches);
    render(<Board columns={COLUMNS} onChange={() => {}} laneEndInset={INSET} />);
    expect(document.body.innerHTML.split(INSET_STYLE)).toHaveLength(COLUMNS.length + 1);
  });

  it('leaves the lanes as they are without one', () => {
    restore = answerMediaQueries(true);
    render(<Board columns={COLUMNS} onChange={() => {}} />);
    expect(document.body.innerHTML).not.toContain('padding-bottom: calc(');
  });
});
