/**
 * Pins where a FLOATING panel (the grid table's column filter: `fixed`, in a portal) goes vertically. It used to open
 * under its trigger whatever the room: a table at the bottom of a page (Billing & Usage → Invoices History) opened its
 * Status filter past the window's bottom edge, where nothing could scroll to it (CU-17tkuw69eq1).
 *
 * jsdom has no layout, so the sizes are stubbed per element: the trigger's rect, the card's and the option list's
 * heights (the list shrinks when the card is capped, as `flex-1 min-h-0` does in a browser), and the window.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CollisionBoundaryContext } from '../../ui/portal-container';
import { type FilterSection, FiltersDropdown } from '../filters-dropdown';

const SECTIONS: FilterSection[] = [
  {
    id: 'status',
    title: 'Status',
    type: 'checkbox',
    allowSelectAll: true,
    options: [
      { id: 'paid', label: 'Paid', value: 'paid' },
      { id: 'open', label: 'Open', value: 'open' },
      { id: 'void', label: 'Void', value: 'void' },
    ],
  },
];

const VIEWPORT_WIDTH = 1920;
const GAP = 8;
/** The card's padding, the gap above the buttons and the buttons: everything but the option list. */
const CHROME = 90;
/** The option list's full content height, at the list's own 250px limit. */
const LIST_CONTENT = 250;
const NATURAL = CHROME + LIST_CONTENT;
const SECTION_HEADER = 28;
const OPTION_ROW = 48;

interface Rect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

let triggerRect: Rect = { top: 0, bottom: 48, left: 400, right: 600 };
let boundary: { element: HTMLElement; rect: Rect } | null = null;
/** Rects of the elements a test names by `data-testid` (a table's box, a header cell); every other element is the trigger. */
let rectsByTestId: Record<string, Rect> = {};

function domRect({ top, bottom, left, right }: Rect): DOMRect {
  return {
    top,
    bottom,
    left,
    right,
    width: right - left,
    height: bottom - top,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

function role(element: HTMLElement): string | undefined {
  return element.dataset.filterPanel;
}

function cardOf(element: HTMLElement): HTMLElement | null {
  return element.closest<HTMLElement>('[data-filter-panel="card"]');
}

/** The list's laid-out height: its content, at most 250, and at most what a capped card leaves it. */
function listHeight(list: HTMLElement): number {
  const cap = cardOf(list)?.style.maxHeight;
  const room = cap ? Number.parseFloat(cap) - CHROME : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(LIST_CONTENT, 250, room));
}

function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (boundary && this === boundary.element) return domRect(boundary.rect);
    const named = this.dataset.testid ? rectsByTestId[this.dataset.testid] : undefined;
    if (named) return domRect(named);
    return domRect(triggerRect);
  });
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
    switch (role(this)) {
      case 'card': {
        const list = this.querySelector<HTMLElement>('[data-filter-panel="list"]');
        return CHROME + (list ? listHeight(list) : 0);
      }
      case 'list':
        return listHeight(this);
      case 'section-header':
        return SECTION_HEADER;
      case 'option':
        return OPTION_ROW;
      default:
        return 0;
    }
  });
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
    return role(this) === 'list' ? LIST_CONTENT : 0;
  });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
}

function setWindowHeight(height: number) {
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true });
}

function renderDropdown(wrap: (node: ReactNode) => ReactNode = node => node, { floating = true } = {}) {
  render(
    wrap(
      <FiltersDropdown
        triggerElement={<div className="w-full">Status filter</div>}
        sections={SECTIONS}
        onApply={() => {}}
        className="!block w-full"
        floating={floating}
      />,
    ),
  );
  fireEvent.click(screen.getByText('Status filter'));
  const panel = screen.getByRole('button', { name: 'Apply' }).closest<HTMLElement>('.fixed');
  if (!panel) throw new Error('the floating panel did not open');
  return panel;
}

function card(panel: HTMLElement): HTMLElement {
  const found = panel.querySelector<HTMLElement>('[data-filter-panel="card"]');
  // On a build without the markers the card is the panel's first child.
  return found ?? (panel.firstElementChild as HTMLElement);
}

/** The panel's drawn height: the card's, capped or not. */
function drawnHeight(panel: HTMLElement): number {
  const cap = card(panel).style.maxHeight;
  return cap ? Math.min(NATURAL, Number.parseFloat(cap)) : NATURAL;
}

/** The panel's top and bottom edges in the window, from whichever of `top` / `bottom` places it. */
function verticalEdges(panel: HTMLElement): { top: number; bottom: number } {
  const height = drawnHeight(panel);
  if (panel.style.bottom) {
    const bottom = window.innerHeight - Number.parseFloat(panel.style.bottom);
    return { top: bottom - height, bottom };
  }
  const top = Number.parseFloat(panel.style.top);
  return { top, bottom: top + height };
}

describe('FiltersDropdown floating panel: vertical fit', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_WIDTH, configurable: true, writable: true });
    setWindowHeight(1080);
    triggerRect = { top: 200, bottom: 248, left: 400, right: 600 };
    boundary = null;
    stubLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens below its trigger when the panel fits there', () => {
    const panel = renderDropdown();
    expect(panel.style.top).toBe(`${248 + GAP}px`);
    expect(panel.style.bottom).toBe('');
    expect(card(panel).style.maxHeight).toBe('');
  });

  it('opens above a trigger at the bottom of a 1080px window, whole and inside the window (the Invoices History case)', () => {
    // The Status header of a table at the end of the page: 1000–1048 of 1080. Below, 8px of room; above, ~980.
    triggerRect = { top: 1000, bottom: 1048, left: 1500, right: 1700 };
    const panel = renderDropdown();
    const edges = verticalEdges(panel);
    expect(edges.bottom).toBeLessThanOrEqual(1080 - GAP);
    expect(edges.top).toBeGreaterThanOrEqual(GAP);
    expect(edges.bottom).toBe(1000 - GAP);
    expect(card(panel).style.maxHeight).toBe('');
  });

  it('caps the card to the larger side when neither side holds the whole panel, so Reset / Apply stay on screen', () => {
    // A 300px window, trigger near the top: 136px below, 84px above. It opens below, capped to 136.
    setWindowHeight(300);
    triggerRect = { top: 100, bottom: 148, left: 400, right: 600 };
    const panel = renderDropdown();
    expect(panel.style.top).toBe(`${148 + GAP}px`);
    expect(card(panel).style.maxHeight).toBe(`${300 - GAP - (148 + GAP)}px`);
    expect(verticalEdges(panel).bottom).toBeLessThanOrEqual(300 - GAP);
  });

  it('clears the cap when the window grows tall enough again', () => {
    setWindowHeight(300);
    triggerRect = { top: 100, bottom: 148, left: 400, right: 600 };
    const panel = renderDropdown();
    expect(card(panel).style.maxHeight).not.toBe('');

    setWindowHeight(1080);
    fireEvent(window, new Event('resize'));
    expect(card(panel).style.maxHeight).toBe('');
    expect(panel.style.top).toBe(`${148 + GAP}px`);
  });

  it('ignores a scroll inside the panel: the option list scrolling does not re-place or re-cap it', () => {
    setWindowHeight(300);
    triggerRect = { top: 100, bottom: 148, left: 400, right: 600 };
    const panel = renderDropdown();
    const cap = card(panel).style.maxHeight;
    const top = panel.style.top;

    // If the list's own scroll re-placed the panel, it would follow this new trigger position.
    triggerRect = { top: 60, bottom: 108, left: 400, right: 600 };
    const list = panel.querySelector<HTMLElement>('[data-filter-panel="list"]');
    if (!list) throw new Error('no option list');
    fireEvent.scroll(list);
    expect(panel.style.top).toBe(top);
    expect(card(panel).style.maxHeight).toBe(cap);

    // A page scroll does move it.
    fireEvent.scroll(window);
    expect(panel.style.top).toBe(`${108 + GAP}px`);
  });

  it('keeps the side it opened on while the page scrolls, as long as that side still holds Reset / Apply and a row', () => {
    triggerRect = { top: 1000, bottom: 1048, left: 400, right: 600 };
    const panel = renderDropdown();
    expect(panel.style.bottom).not.toBe('');

    // Scrolled so that below now has a little more room than the whole panel needs; above still has plenty.
    triggerRect = { top: 600, bottom: 648, left: 400, right: 600 };
    fireEvent.scroll(window);
    expect(panel.style.top).toBe('');
    expect(panel.style.bottom).toBe(`${1080 - 600 + GAP}px`);
  });

  it('switches side when the side it opened on can no longer hold Reset / Apply and a row', () => {
    triggerRect = { top: 1000, bottom: 1048, left: 400, right: 600 };
    const panel = renderDropdown();
    expect(panel.style.bottom).not.toBe('');

    // Scrolled to the top of the window: 64px above (less than the chrome and one row), ~1000 below.
    triggerRect = { top: 80, bottom: 128, left: 400, right: 600 };
    fireEvent.scroll(window);
    expect(panel.style.bottom).toBe('');
    expect(panel.style.top).toBe(`${128 + GAP}px`);
  });

  it('fits inside the collision boundary when one is set, not the window', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    // A panel surface ending at 700: a trigger at 600–648 has 36px below it there, though the window has ~420.
    boundary = { element, rect: { top: 100, bottom: 700, left: 0, right: 1920 } };
    triggerRect = { top: 600, bottom: 648, left: 400, right: 600 };
    const panel = renderDropdown(node => (
      <CollisionBoundaryContext.Provider value={element}>{node}</CollisionBoundaryContext.Provider>
    ));
    expect(panel.style.bottom).toBe(`${1080 - 600 + GAP}px`);
    expect(verticalEdges(panel).top).toBeGreaterThanOrEqual(100 + GAP);
    element.remove();
  });

  it('keeps the horizontal position: hung from the trigger and clamped to the window edges', () => {
    triggerRect = { top: 1000, bottom: 1048, left: 400, right: 600 };
    expect(renderDropdown().style.left).toBe('400px');
  });

  it('clamps the horizontal position to the window edge as before', () => {
    triggerRect = { top: 200, bottom: 248, left: 1800, right: 1900 };
    expect(renderDropdown().style.left).toBe(`${VIEWPORT_WIDTH - 320 - GAP}px`);
  });
});

describe('FiltersDropdown on mobile: the fixed panel fits vertically too', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true, writable: true });
    setWindowHeight(812);
    triggerRect = { top: 200, bottom: 248, left: 16, right: 359 };
    boundary = null;
    stubLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens above a trigger at the bottom of a phone screen, whole, keeping its full-width classes', () => {
    // Billing & Usage at 375×812: the Status header at 699–747, 49px of room below it.
    triggerRect = { top: 699, bottom: 747, left: 16, right: 359 };
    const panel = renderDropdown(undefined, { floating: false });
    expect(panel.style.bottom).toBe(`${812 - 699 + GAP}px`);
    expect(panel.style.top).toBe('');
    expect(panel.style.left).toBe('');
    expect(panel.classList.contains('left-4')).toBe(true);
    expect(panel.classList.contains('mt-2')).toBe(false);
    const edges = verticalEdges(panel);
    expect(edges.top).toBeGreaterThanOrEqual(GAP);
    expect(edges.bottom).toBeLessThanOrEqual(812 - GAP);
  });

  it('opens below with an 8px gap when it fits, measured in the window (no scroll offset)', () => {
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true, writable: true });
    const panel = renderDropdown(undefined, { floating: false });
    expect(panel.style.top).toBe(`${248 + GAP}px`);
    expect(panel.style.bottom).toBe('');
    Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true });
  });
});

/**
 * Pins where a floating panel goes SIDEWAYS: inside the box its table shows, not the window. A grid column scrolled
 * partly out of a narrow table (a page in the side panel next to the Mingo chat) used to hang its panel at the window
 * clamp, over the navigation rail or the chat, away from the column it filters; scrolled fully out, the panel stayed
 * open with no header in view (CU-17tkuw69g8m).
 *
 * The tree is the grid's: the table's scroll box (clips sideways) › the header cell (`data-grid-header-cell`, clips its
 * own label) › the trigger.
 */
describe('FiltersDropdown floating panel: attached to its column sideways', () => {
  /** The table's visible box: a side panel's table, 963px wide, in a 2560px window. */
  const TABLE: Rect = { top: 300, bottom: 1200, left: 1372, right: 2335 };
  const WINDOW_WIDTH = 2560;

  function renderInTable({ cellStyle = {} }: { cellStyle?: Record<string, string> } = {}) {
    return renderDropdown(node => (
      <div data-testid="table" style={{ overflowX: 'auto' }}>
        <div data-testid="cell" data-grid-header-cell="" style={{ overflowX: 'hidden', ...cellStyle }}>
          {node}
        </div>
      </div>
    ));
  }

  /** The header cell and the trigger in it share one box (the trigger is `w-full` of its cell). */
  function placeHeader(left: number, right: number) {
    triggerRect = { top: 349, bottom: 397, left, right };
    rectsByTestId.cell = triggerRect;
  }

  function panelLeft(panel: HTMLElement): number {
    return Number.parseFloat(panel.style.left);
  }

  function isOpen(): boolean {
    act(() => {
      vi.advanceTimersByTime(300);
    });
    return screen.queryByRole('button', { name: 'Apply' }) !== null;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { value: WINDOW_WIDTH, configurable: true, writable: true });
    setWindowHeight(1323);
    boundary = null;
    rectsByTestId = { table: TABLE };
    placeHeader(1972, 2147);
    stubLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    rectsByTestId = {};
  });

  it('hangs from its header when the panel fits in the table', () => {
    expect(panelLeft(renderInTable())).toBe(1972);
  });

  it('opens inside the table for a header partly visible at its right edge, not at the window clamp (the ticket case)', () => {
    // AUTO-UPDATE scrolled mostly past the table's right edge: 2274–2449 against a box ending at 2335.
    placeHeader(2274, 2449);
    const panel = renderInTable();
    expect(panelLeft(panel)).toBe(TABLE.right - 320 - GAP);
    expect(panelLeft(panel) + 320).toBeLessThanOrEqual(TABLE.right);
    expect(isOpen()).toBe(true);
  });

  it('stays inside the table while the open panel follows a header scrolled partly out on the left', () => {
    const panel = renderInTable();
    placeHeader(1300, 1475);
    fireEvent.scroll(window);
    expect(panelLeft(panel)).toBe(TABLE.left + GAP);
    expect(isOpen()).toBe(true);
  });

  it('closes when its header is scrolled fully out of the table on the right', () => {
    renderInTable();
    placeHeader(2400, 2575);
    fireEvent.scroll(window);
    expect(isOpen()).toBe(false);
  });

  it('closes when its header is scrolled fully out of the table on the left', () => {
    renderInTable();
    placeHeader(1100, 1275);
    fireEvent.scroll(window);
    expect(isOpen()).toBe(false);
  });

  it('closes when what is left of its header is under the right-pinned columns', () => {
    // The pinned actions column covers the box's last 45px; the header shows only 2300–2335, under it. The table's root
    // publishes the width and the cell inherits it; jsdom does not inherit custom properties, so it is set on the cell.
    renderInTable({ cellStyle: { '--dt-pin-r': '45px' } });
    placeHeader(2300, 2475);
    fireEvent.scroll(window);
    expect(isOpen()).toBe(false);
  });

  it('does not count its own pinned block against a header that is pinned itself', () => {
    // A left-pinned column at the box's left edge, inside the 300px block it is part of.
    placeHeader(TABLE.left, TABLE.left + 200);
    const panel = renderInTable({ cellStyle: { '--dt-pin-l': '300px', position: 'sticky' } });
    expect(panelLeft(panel)).toBe(TABLE.left + GAP);
    expect(isOpen()).toBe(true);
  });

  it('keeps a panel inside the table when its column is wide: the header cell is not the room, even past the panel width', () => {
    // A grown or resized column, 400px, starting 300px left of the box: only its last 100px are in view.
    placeHeader(TABLE.left - 300, TABLE.left + 100);
    const panel = renderInTable();
    expect(panelLeft(panel)).toBeGreaterThanOrEqual(TABLE.left + GAP);
    expect(isOpen()).toBe(true);
  });

  it('keeps inside the collision boundary when it is narrower than the window', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    boundary = { element, rect: { top: 0, bottom: 1323, left: 0, right: 2200 } };
    placeHeader(2100, 2275);
    const panel = renderDropdown(node => (
      <CollisionBoundaryContext.Provider value={element}>{node}</CollisionBoundaryContext.Provider>
    ));
    expect(panelLeft(panel)).toBe(2200 - 320 - GAP);
    element.remove();
  });

  it('does not close a panel whose trigger has no size yet (not laid out, a hidden tab)', () => {
    vi.restoreAllMocks();
    const panel = renderInTable();
    expect(panel).toBeTruthy();
    expect(isOpen()).toBe(true);
  });
});
