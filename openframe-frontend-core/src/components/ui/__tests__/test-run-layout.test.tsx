import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { QueryResultRow } from '../query-report-table';
import { TestRunResults } from '../test-run';

/**
 * The results of a live test run (`TestRunResults`) in their two layouts. Card rows are the default and what every
 * host drew before the grid; `layout="grid"` draws the grid table: a 176px column per key of the result, one line per
 * row, no settings gear, and the grid's own loading form while the run has no rows. jsdom has no layout, so what is
 * locked is which cells there are and what each holds; the widths on screen are checked in the browser on the stories.
 */

const ROWS: QueryResultRow[] = [
  { 'host display name': 'workstation-01', pid: 1234, name: 'chrome', path: null },
  { 'host display name': 'workstation-01', pid: 5678, name: 'node', path: '/usr/local/bin/node' },
];

class IdleObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

/** The tags stripped: the text a reader sees. */
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, '');

/** The ids of the grid's data columns, in header order. */
const gridColumns = (container: HTMLElement) =>
  [...container.innerHTML.matchAll(/data-grid-header-cell="true"[^>]*data-grid-col="([^"]+)"/g)].map(
    match => match[1] ?? '',
  );

/** The stated width of the grid's column at `index`, in px. */
const columnWidth = (container: HTMLElement, index: number) =>
  Number(new RegExp(`--dtc${index}-w: (\\d+)px`).exec(container.innerHTML)?.[1]);

/** How many times `marker` is in the markup. */
const countOf = (container: HTMLElement, marker: string) => container.innerHTML.split(marker).length - 1;

/** Where `marker` first is in the markup; -1 when it is not there. */
const placeOf = (container: HTMLElement, marker: string) => container.innerHTML.indexOf(marker);

/** The grid's body, as markup. */
const gridBody = (container: HTMLElement) => container.innerHTML.slice(container.innerHTML.indexOf('data-grid-body'));

describe('TestRunResults layouts', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IdleObserver);
    vi.stubGlobal('ResizeObserver', IdleObserver);
  });
  afterAll(() => vi.unstubAllGlobals());

  describe('card rows (the default)', () => {
    it('draws no grid markup, with a header cell per key of the result', () => {
      const { container } = render(<TestRunResults isActive={false} displayRows={ROWS} firstError={null} />);
      expect(container.innerHTML).not.toContain('data-grid-');
      for (const key of Object.keys(ROWS[0] ?? {})) expect(screen.getAllByText(key).length).toBeGreaterThan(0);
      expect(screen.getByText('chrome')).toBeTruthy();
    });

    it('draws its own one-row skeleton while the run has no rows', () => {
      const { container } = render(<TestRunResults isActive displayRows={[]} firstError={null} />);
      expect(container.innerHTML).not.toContain('data-grid-');
      expect(screen.getByText('Loading the test results')).toBeTruthy();
    });

    it('holds the empty state at the height of a header and one card row', () => {
      const { container } = render(<TestRunResults isActive={false} displayRows={[]} firstError={null} />);
      expect(screen.getByText('No results returned')).toBeTruthy();
      expect(container.innerHTML).toContain('h-[128px]');
      expect(container.innerHTML).not.toContain('h-[98px]');
    });
  });

  describe('the grid', () => {
    it('draws a 176px column per key of the result, in the result’s order', () => {
      const { container } = render(
        <TestRunResults isActive={false} displayRows={ROWS} firstError={null} layout="grid" />,
      );
      expect(gridColumns(container)).toEqual(['host display name', 'pid', 'name', 'path']);
      expect([0, 1, 2, 3].map(index => columnWidth(container, index))).toEqual([176, 176, 176, 176]);
      expect(Number.isNaN(columnWidth(container, 4))).toBe(true);
    });

    it('prints each value on one line as returned, and a dash for none', () => {
      const { container } = render(
        <TestRunResults isActive={false} displayRows={ROWS} firstError={null} layout="grid" />,
      );
      // A row's cells: from the end of its opening tag, less the next row's unfinished opening tag.
      const rowText = (row: string) => textOf(row.slice(row.indexOf('>') + 1).replace(/<[^>]*$/, ''));
      const [, first = '', second = ''] = gridBody(container).split('group/gridrow');
      expect(rowText(first)).toBe('workstation-011234chrome-');
      expect(rowText(second)).toBe('workstation-015678node/usr/local/bin/node');
      expect(screen.getByText('chrome').className).toContain('truncate');
    });

    it('has no settings gear: the columns are the query’s own, so there is no layout of them to keep', () => {
      const { container } = render(
        <TestRunResults isActive={false} displayRows={ROWS} firstError={null} layout="grid" />,
      );
      expect(container.innerHTML).not.toContain('data-grid-settings-cell');
    });

    it('draws the grid’s loading form while the run has no rows: a header of bars over one row', () => {
      const { container } = render(<TestRunResults isActive displayRows={[]} firstError={null} layout="grid" />);
      expect(container.innerHTML).toContain('data-grid-root');
      // Six unnamed columns: a result's columns arrive with its rows.
      expect(countOf(container, 'data-grid-header-loading')).toBe(6);
      expect(gridBody(container).split('data-loading-item')).toHaveLength(1 + 1);
      // The card rows' hand-drawn skeleton is not drawn beside it.
      expect(screen.queryByText('Loading the test results')).toBeNull();
    });

    it('keeps drawing the rows that arrived while the run is still going', () => {
      const { container } = render(<TestRunResults isActive displayRows={ROWS} firstError={null} layout="grid" />);
      expect(container.innerHTML).not.toContain('data-grid-header-loading');
      expect(gridColumns(container)).toHaveLength(4);
    });

    it('holds the empty state at the height of the grid with one row', () => {
      const { container } = render(
        <TestRunResults isActive={false} displayRows={[]} firstError={null} layout="grid" />,
      );
      expect(container.innerHTML).not.toContain('data-grid-root');
      expect(screen.getByText('No results returned')).toBeTruthy();
      expect(container.innerHTML).toContain('h-[98px]');
      expect(container.innerHTML).not.toContain('h-[128px]');
    });

    it('shows the run’s error above the rows that arrived, and alone when none did', () => {
      const { container, unmount } = render(
        <TestRunResults isActive={false} displayRows={ROWS} firstError="query timed out" layout="grid" />,
      );
      expect(screen.getByRole('alert').textContent).toContain('query timed out');
      expect(placeOf(container, 'role="alert"')).toBeLessThan(placeOf(container, 'data-grid-root'));
      unmount();

      const { container: alone } = render(
        <TestRunResults isActive={false} displayRows={[]} firstError="query timed out" layout="grid" />,
      );
      expect(alone.innerHTML).not.toContain('data-grid-root');
      expect(screen.queryByText('No results returned')).toBeNull();
    });
  });
});
