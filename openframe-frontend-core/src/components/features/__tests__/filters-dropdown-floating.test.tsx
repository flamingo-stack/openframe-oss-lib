/**
 * Pins where a FLOATING panel (the grid table's column filter: `fixed`, in a portal) goes vertically. It used to open
 * under its trigger whatever the room: a table at the bottom of a page (Billing & Usage → Invoices History) opened its
 * Status filter past the window's bottom edge, where nothing could scroll to it (CU-17tkuw69eq1).
 *
 * jsdom has no layout, so the sizes are stubbed per element: the trigger's rect, the card's and the option list's
 * heights (the list shrinks when the card is capped, as `flex-1 min-h-0` does in a browser), and the window.
 */

import { fireEvent, render, screen } from '@testing-library/react';
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
