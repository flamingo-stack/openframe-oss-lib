import { render, screen } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LoadingWhen } from '../loading-scope';
import { QueryReportTable, type QueryResultRow } from '../query-report-table';

/**
 * A query's report (`QueryReportTable`) in its two layouts. Card rows are the default and what every host drew before
 * the grid; `layout="grid"` draws the grid table: a column per key of the result at the card rows' width, one line per
 * row, no settings gear, and the grid's own loading form while the report is read. The title bar, the export and the
 * empty state are the same in both. jsdom has no layout, so what is locked is which cells there are and what each
 * holds; the widths on screen are checked in the browser on the stories.
 */

const ROWS: QueryResultRow[] = [
  { device: 'workstation-01', last_fetched: '2026-11-20', name: 'chrome', path: null },
  { device: 'workstation-02', last_fetched: '2026-11-21', name: 'node', path: '/usr/local/bin/node' },
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

/** Whether the markup holds `marker`. */
const has = (container: HTMLElement, marker: string) => placeOf(container, marker) !== -1;

/** The grid's body, as markup. */
const gridBody = (container: HTMLElement) => container.innerHTML.slice(placeOf(container, 'data-grid-body'));

/** The text of each row of the grid's body, in order. */
const gridRows = (container: HTMLElement) =>
  gridBody(container)
    .split('group/gridrow')
    .slice(1)
    // A row's cells: from the end of its opening tag, less the next row's unfinished opening tag.
    .map(row => textOf(row.slice(row.indexOf('>') + 1).replace(/<[^>]*$/, '')));

describe('QueryReportTable layouts', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IdleObserver);
    vi.stubGlobal('ResizeObserver', IdleObserver);
  });
  afterAll(() => vi.unstubAllGlobals());

  describe('card rows (the default)', () => {
    it('draws no grid markup, with a header cell per key of the result', () => {
      const { container } = render(<QueryReportTable data={ROWS} showExport={false} />);
      expect(has(container, 'data-grid-')).toBe(false);
      for (const key of Object.keys(ROWS[0] ?? {})) expect(screen.getAllByText(key).length).toBeGreaterThan(0);
      expect(screen.getByText('chrome')).toBeTruthy();
    });

    it('draws its own skeleton while the report is read', () => {
      const { container } = render(<QueryReportTable data={[]} loading skeletonRows={3} showExport={false} />);
      expect(has(container, 'data-grid-')).toBe(false);
      expect(countOf(container, 'data-loading-item')).toBe(3);
    });
  });

  describe('the grid', () => {
    it('draws a column per key of the result at the card rows’ width, in the result’s order', () => {
      const { container } = render(<QueryReportTable data={ROWS} layout="grid" />);
      expect(gridColumns(container)).toEqual(['device', 'last_fetched', 'name', 'path']);
      expect([0, 1, 2, 3].map(index => columnWidth(container, index))).toEqual([160, 160, 160, 160]);
      expect(Number.isNaN(columnWidth(container, 4))).toBe(true);
    });

    it('follows the host’s column order and column width', () => {
      const { container } = render(
        <QueryReportTable data={ROWS} layout="grid" columnOrder={['name', 'device']} columnWidth={240} />,
      );
      expect(gridColumns(container)).toEqual(['name', 'device', 'last_fetched', 'path']);
      expect(columnWidth(container, 0)).toBe(240);
    });

    it('prints each value on one line as returned, and a dash for none', () => {
      const { container } = render(<QueryReportTable data={ROWS} layout="grid" />);
      expect(gridRows(container)).toEqual([
        'workstation-012026-11-20chrome-',
        'workstation-022026-11-21node/usr/local/bin/node',
      ]);
      expect(screen.getByText('chrome').className).toContain('truncate');
    });

    it('has no settings gear, and neither the scrollbar track nor the row cards of the card layout', () => {
      const { container } = render(<QueryReportTable data={ROWS} layout="grid" />);
      expect(has(container, 'data-grid-settings-cell')).toBe(false);
      expect(has(container, 'data-scrollbar-thumb')).toBe(false);
      expect(countOf(container, 'data-grid-root')).toBe(1);
    });

    it('keeps the title bar and the export above the grid', () => {
      const { container } = render(<QueryReportTable title="Server health" data={ROWS} layout="grid" />);
      expect(screen.getByRole('heading', { name: 'Server health' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
      expect(placeOf(container, 'Export CSV')).toBeLessThan(placeOf(container, 'data-grid-root'));
    });

    it('draws the grid’s loading form while the report is read: the host’s rows on its unnamed columns', () => {
      const { container } = render(
        <QueryReportTable data={[]} loading layout="grid" skeletonRows={3} skeletonColumns={5} showExport={false} />,
      );
      expect(has(container, 'data-grid-root')).toBe(true);
      expect(countOf(container, 'data-grid-header-loading')).toBe(5);
      expect(gridBody(container).split('data-loading-item')).toHaveLength(3 + 1);
    });

    it('draws the loading form in a loading scope too, the rows it holds not shown', () => {
      const { container } = render(
        <LoadingWhen loading>
          <QueryReportTable data={ROWS} layout="grid" showExport={false} />
        </LoadingWhen>,
      );
      expect(has(container, 'data-grid-header-loading')).toBe(true);
      expect(gridColumns(container)).toEqual([]);
      expect(screen.queryByText('chrome')).toBeNull();
    });

    it('draws the report’s own empty state, with no grid, when there are no rows', () => {
      const { container } = render(
        <QueryReportTable data={[]} layout="grid" emptyState={{ title: 'No report results available' }} />,
      );
      expect(has(container, 'data-grid-root')).toBe(false);
      expect(screen.getByText('No report results available')).toBeTruthy();
    });

    it('leaves a compact report on its flat rows', () => {
      const { container } = render(<QueryReportTable data={ROWS} layout="grid" variant="compact" />);
      expect(has(container, 'data-grid-')).toBe(false);
      expect(screen.getByText('chrome')).toBeTruthy();
    });
  });
});
