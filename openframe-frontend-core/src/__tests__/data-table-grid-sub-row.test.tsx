import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actionColumn, DataTable, type ColumnDef } from '../components/ui/data-table';
import {
  createGridScrollController,
  GRID_SUB_ROW_CLASS,
  GRID_VIEWPORT_WIDTH_VAR,
} from '../components/ui/data-table/data-table-grid';
import { useDataTable } from '../components/ui/data-table/use-data-table';

/**
 * A grid row's sub-row (`renderSubRow`) is as wide as the VISIBLE table. Two properties:
 * 1. it adds nothing to the table's scroll width, so a long line in it wraps;
 * 2. where the columns are wider than the scroll viewport it is one viewport wide and stays in view while the cells
 *    scroll.
 * jsdom has no layout, so what is locked here is what makes them true: the sub-row's box (its classes) and the width
 * the scroll controller writes for it. The widths themselves are measured in the browser on the `SubRow` stories.
 */

interface Item {
  id: string;
  name: string;
  owner: string;
}

const ITEMS: Item[] = [
  { id: 'a', name: 'Alpha', owner: 'Ada' },
  { id: 'b', name: 'Beta', owner: 'Bob' },
];

const COLUMNS: ColumnDef<Item>[] = [
  { id: 'name', accessorKey: 'name', header: 'Name', size: 280 },
  { id: 'owner', accessorKey: 'owner', header: 'Owner', size: 600 },
  actionColumn<Item>({ id: 'more', cell: () => <button type="button">More</button> }),
];

/** Only the first row has a sub-row. */
function renderSubRow(item: Item) {
  return item.id === 'a' ? <p>request for {item.name}</p> : null;
}

function Table({ layout = 'grid', maxHeight }: { layout?: 'grid' | 'cards'; maxHeight?: number }) {
  const table = useDataTable<Item>({ data: ITEMS, columns: COLUMNS, getRowId: item => item.id });
  return (
    <DataTable table={table} layout={layout} maxHeight={maxHeight}>
      <DataTable.Header />
      <DataTable.Body<Item> renderSubRow={renderSubRow} />
    </DataTable>
  );
}

/** The opening tag of the first element carrying `marker` (an attribute or a class), read off the markup. */
function openingTag(container: HTMLElement, marker: string): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<[a-z]+[^>]*${escaped}[^>]*>`).exec(container.innerHTML)?.[0] ?? '';
}

/** An opening tag's class names. */
function classes(tag: string): string[] {
  return (/ class="([^"]*)"/.exec(tag)?.[1] ?? '').split(/\s+/).filter(Boolean);
}

/** The sub-row's box: the element the grid row wraps the host's content in. */
function subRowBox(container: HTMLElement): string {
  return openingTag(container, 'data-grid-sub-row');
}

/** How many sub-row boxes the table draws. */
function subRowBoxes(container: HTMLElement): number {
  return container.innerHTML.split('data-grid-sub-row').length - 1;
}

/** The scroll viewport's opening tag, with the width written on it. */
function viewportTag(container: HTMLElement, mode: 'page' | 'fixed'): string {
  return openingTag(container, mode === 'page' ? 'class="overflow-x-auto"' : 'overflow-auto');
}

/** Every element reports `width` as its `clientWidth` when it scrolls (the viewport), and 0 otherwise. */
function stubViewportWidth(width: () => number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return /(^| )overflow-(x-)?auto( |$)/.test(this.className) ? width() : 0;
  });
}

/** A `ResizeObserver` the test fires by hand. */
function stubResizeObserver(): { fire: () => void } {
  const callbacks: Array<() => void> = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        callbacks.push(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  return {
    fire: () => {
      for (const callback of callbacks) callback();
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('a grid row’s sub-row', () => {
  it('adds nothing to the table’s scroll width: no width of its own, a min-width that is a share of the row', () => {
    const { container } = render(<Table />);
    const box = classes(subRowBox(container));
    // Zero wide as far as the row's `w-max` goes, and a `%` min-width counts as zero there too.
    expect(box).toContain('w-0');
    expect(box.filter(name => name.startsWith('min-w-'))).toEqual(['min-w-[min(100%,var(--dt-viewport-w,100%))]']);
    // Never a width that follows its content or a length of its own.
    expect(box.filter(name => /^(w-(max|fit|full|auto|screen)|max-w-)/.test(name))).toEqual([]);
    // What the host forbids to wrap is cut, not scrolled to; a word longer than the table breaks.
    expect(box).toContain('overflow-x-clip');
    expect(box).toContain('break-words');
    // The row itself is still as wide as its columns, and the sub-row is its last child: the cells are what the
    // table scrolls.
    expect(container.innerHTML).toMatch(/<div class="w-max min-w-full"[^>]*>.*<\/(a|div)><div data-grid-sub-row/);
  });

  it('stays in view while the cells scroll: sticky to the viewport’s left edge, one viewport wide', () => {
    stubViewportWidth(() => 375);
    const { container } = render(<Table />);
    expect(classes(subRowBox(container))).toEqual(expect.arrayContaining(['sticky', 'left-0']));
    // The width it reads is the one the scroll viewport states: the viewport's own, not the columns' (936px here).
    const viewport = viewportTag(container, 'page');
    expect(viewport).toContain(`${GRID_VIEWPORT_WIDTH_VAR}: 375px`);
    expect(GRID_SUB_ROW_CLASS).toContain(`var(${GRID_VIEWPORT_WIDTH_VAR},`);
    // The sub-row is inside that viewport: the variable reaches it.
    const html = container.innerHTML;
    expect(html.indexOf(viewport)).toBeGreaterThan(-1);
    expect(html.indexOf(viewport)).toBeLessThan(html.indexOf('data-grid-sub-row'));
  });

  it('is one viewport wide in a table of a stated height too, where the table’s one viewport scrolls', () => {
    stubViewportWidth(() => 640);
    const { container } = render(<Table maxHeight={360} />);
    const viewport = viewportTag(container, 'fixed');
    expect(viewport).toContain(`${GRID_VIEWPORT_WIDTH_VAR}: 640px`);
    const html = container.innerHTML;
    expect(html.indexOf(viewport)).toBeLessThan(html.indexOf('data-grid-sub-row'));
  });

  it('lies over the horizontal shades and under the vertical ones and the sticky header', () => {
    const { container } = render(<Table maxHeight={360} />);
    const layer = (tag: string) =>
      Number(/^z-\[(\d+)\]$/.exec(classes(tag).find(name => name.startsWith('z-[')) ?? '')?.[1]);
    const shade = (edge: string) => openingTag(container, `data-grid-gradient="${edge}"`);
    const subRow = layer(subRowBox(container));
    // The horizontal shades say more COLUMNS lie behind an edge, and a sub-row is not behind it.
    expect(layer(shade('left'))).toBeLessThan(subRow);
    expect(layer(shade('right'))).toBeLessThan(subRow);
    // The vertical ones say more ROWS do, and a sub-row scrolls with its row.
    expect(layer(shade('top'))).toBeGreaterThan(subRow);
    expect(layer(shade('bottom'))).toBeGreaterThan(subRow);
    expect(layer(openingTag(container, 'data-grid-header'))).toBeGreaterThan(subRow);
  });

  it('is drawn only for a row that has one', () => {
    const { container } = render(<Table />);
    expect(subRowBoxes(container)).toBe(1);
    expect(screen.getByText('request for Alpha')).toBeTruthy();
  });

  it('leaves a card row’s sub-row as it was: no grid box, nothing sticky to the left', () => {
    const { container } = render(<Table layout="cards" />);
    expect(screen.getByText('request for Alpha')).toBeTruthy();
    expect(container.innerHTML).not.toContain('data-grid-sub-row');
    expect(container.innerHTML).not.toMatch(/[" ]left-0[" ]/);
    expect(container.innerHTML).not.toContain('--dt-viewport-w');
  });
});

describe('createGridScrollController: the viewport’s width for the sub-rows', () => {
  /** A viewport element whose `clientWidth` the test sets. */
  function viewportOf(width: number) {
    const element = document.createElement('div');
    let current = width;
    Object.defineProperty(element, 'clientWidth', { get: () => current });
    return {
      element,
      resizeTo: (next: number) => {
        current = next;
      },
    };
  }

  const written = (element: HTMLElement) => element.style.getPropertyValue(GRID_VIEWPORT_WIDTH_VAR);

  it('writes the width when the viewport is attached, before any resize is observed', () => {
    const controller = createGridScrollController(false);
    const { element } = viewportOf(912);
    controller.setViewport(element);
    expect(written(element)).toBe('912px');
  });

  it('follows the viewport as it is resized', () => {
    const observer = stubResizeObserver();
    const controller = createGridScrollController(false);
    const { element, resizeTo } = viewportOf(912);
    controller.setViewport(element);

    resizeTo(375);
    observer.fire();
    expect(written(element)).toBe('375px');
  });

  it('writes nothing while the width has not changed', () => {
    const observer = stubResizeObserver();
    const controller = createGridScrollController(false);
    const { element } = viewportOf(912);
    controller.setViewport(element);
    const write = vi.spyOn(element.style, 'setProperty');

    // Rows arriving change the content's size, not the viewport's.
    observer.fire();
    expect(write).not.toHaveBeenCalled();
  });

  it('states no width for a viewport that has none (not laid out): the sub-row is then as wide as its row', () => {
    const observer = stubResizeObserver();
    const controller = createGridScrollController(false);
    const { element, resizeTo } = viewportOf(0);
    controller.setViewport(element);
    expect(written(element)).toBe('');

    resizeTo(800);
    observer.fire();
    expect(written(element)).toBe('800px');

    // Hidden again (`display: none`): the last width is not kept as if it were still true.
    resizeTo(0);
    observer.fire();
    expect(written(element)).toBe('');
  });

  it('measures a new viewport element afresh, even at the width of the one before', () => {
    const controller = createGridScrollController(false);
    const first = viewportOf(640);
    controller.setViewport(first.element);
    const second = viewportOf(640);
    controller.setViewport(second.element);
    expect(written(second.element)).toBe('640px');
  });
});
