import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Board } from '../components/features/board/board';
import type { BoardColumnDef } from '../components/features/board/types';
import { DRAG_AND_DROP_MEDIA_QUERY, useDragAndDropEnabled } from '../hooks/ui/use-drag-and-drop-enabled';

/**
 * A controllable `window.matchMedia`: every list created reads `matches` from
 * the current answer, and `flip()` re-answers and notifies every listener —
 * which is exactly what a real browser does when a mouse is attached or the
 * window crosses the breakpoint.
 */
function installMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  let matches = initialMatches;
  const original = window.matchMedia;
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: () => void) => {
        listeners.add(listener);
      },
      removeEventListener: (_type: string, listener: () => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
  return {
    flip(next: boolean) {
      matches = next;
      act(() => {
        for (const listener of listeners) listener();
      });
    },
    restore() {
      window.matchMedia = original;
    },
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
  { id: 'ON_HOLD', label: 'On Hold', color: '#f36666', tickets: ['b1'].map(ticket), total: 7 },
  { id: 'RESOLVED', label: 'Resolved', color: '#888888', tickets: [] },
];

let media: ReturnType<typeof installMatchMedia> | null = null;
afterEach(() => {
  media?.restore();
  media = null;
});

describe('DRAG_AND_DROP_MEDIA_QUERY', () => {
  it('requires a fine pointer AND hover AND the md breakpoint — never one alone', () => {
    expect(DRAG_AND_DROP_MEDIA_QUERY).toContain('(pointer: fine)');
    expect(DRAG_AND_DROP_MEDIA_QUERY).toContain('(hover: hover)');
    expect(DRAG_AND_DROP_MEDIA_QUERY).toContain('(min-width: 800px)');
  });
});

describe('useDragAndDropEnabled', () => {
  it('answers the media query and follows it live', () => {
    media = installMatchMedia(false);
    const { result } = renderHook(() => useDragAndDropEnabled());
    expect(result.current).toBe(false);

    media.flip(true);
    expect(result.current).toBe(true);

    media.flip(false);
    expect(result.current).toBe(false);
  });
});

describe('Board mode selection', () => {
  it('renders the touch pager when the query does not match: every lane, no drag affordances', () => {
    media = installMatchMedia(false);
    render(<Board columns={COLUMNS} onChange={() => {}} />);

    // Every lane header renders (the pager holds all lanes in its track)…
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('On Hold')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    // …with the lane-header count (`total` over length).
    expect(screen.getByText('7')).toBeInTheDocument();

    // Collapse works here too (the mock keeps the lane header buttons)…
    expect(screen.getAllByLabelText('Collapse column')).toHaveLength(3);
    // …but the card does not advertise the keyboard lift it cannot provide.
    expect(screen.getByLabelText('Ticket a1')).not.toHaveAttribute('aria-keyshortcuts');

    // The cards and the touch-worded empty state are there.
    expect(screen.getAllByText('Ticket a1').length).toBeGreaterThan(0);
    expect(screen.getByText("Change a ticket's status to move it to this column")).toBeInTheDocument();
  });

  it('collapses and expands a lane from the touch pager', () => {
    media = installMatchMedia(false);
    render(<Board columns={COLUMNS} onChange={() => {}} />);

    fireEvent.click(screen.getAllByLabelText('Collapse column')[0]);
    // The collapsed lane renders the vertical variant with an expand arrow;
    // its body (the cards) is gone.
    expect(screen.getByLabelText('Expand column')).toBeInTheDocument();
    expect(screen.queryByLabelText('Ticket a1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Expand column'));
    expect(screen.getByLabelText('Ticket a1')).toBeInTheDocument();
  });

  it('renders the drag board when the query matches', () => {
    media = installMatchMedia(true);
    render(<Board columns={COLUMNS} onChange={() => {}} />);

    // The keyboard lift exists only on the drag board; collapse exists on both.
    expect(screen.getAllByLabelText('Collapse column')).toHaveLength(3);
    expect(screen.getByLabelText('Ticket a1')).toHaveAttribute('aria-keyshortcuts', 'Space');
  });

  it('switches modes live when the query flips — no reload, no prop change', () => {
    media = installMatchMedia(true);
    render(<Board columns={COLUMNS} onChange={() => {}} />);
    expect(screen.getByLabelText('Ticket a1')).toHaveAttribute('aria-keyshortcuts', 'Space');

    media.flip(false);
    expect(screen.getByLabelText('Ticket a1')).not.toHaveAttribute('aria-keyshortcuts');
    expect(screen.getByText('Active')).toBeInTheDocument();

    media.flip(true);
    expect(screen.getByLabelText('Ticket a1')).toHaveAttribute('aria-keyshortcuts', 'Space');
  });
});
