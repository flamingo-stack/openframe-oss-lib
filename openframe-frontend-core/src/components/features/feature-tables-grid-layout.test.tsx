import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SingleCustomerTenantsTableView } from './cloud-tenants/single-customer-tenants-table-view';
import { TenantsTableView } from './cloud-tenants/tenants-table-view';
import { DeviceSelector } from './devices/device-selector/device-selector';
import type { FeatureTableLayoutProps } from './feature-table-layout';
import {
  DEVICE_SELECTOR,
  IdleIntersectionObserver,
  KNOWLEDGE_BASE_TABLE,
  LOGS_TABLE,
  POLICIES_TABLE,
  SCRIPT_EXECUTIONS_TABLE,
  SCRIPT_SCHEDULES_TABLE,
  SCRIPTS_TABLE,
  SINGLE_CUSTOMER_TENANTS_TABLE,
  TENANTS_TABLE,
} from './feature-tables.fixtures';
import { KnowledgeBaseTableBody } from './knowledge-base/knowledge-base-table';
import { LogsTableView } from './logs/logs-table-view';
import { PoliciesTable } from './policies/policies-table';
import { ScriptExecutionsTable } from './scripts/script-executions-table';
import { ScriptSchedulesTable } from './scripts/script-schedules-table';
import { ScriptsTable } from './scripts/scripts-table';

/**
 * The feature tables pass the grid layout on to their `DataTable`: `layout`, `tableMaxHeight`, `tableSettings`. These
 * cover the pass-through only. Whether a table's columns are ready for the grid (sizes, one-line cells, action
 * columns) is each table's own work, see `docs/DATA_TABLE_GRID.md`.
 */

interface TableCase {
  name: string;
  /** The loaded table with the given layout props. */
  table: (layout: FeatureTableLayoutProps) => ReactElement;
  /** A text the table's results row holds (its count, or what the host put in the header's right slot). */
  meta: string;
}

const TABLES: TableCase[] = [
  {
    name: 'PoliciesTable',
    table: layout => <PoliciesTable {...POLICIES_TABLE.loaded} {...layout} />,
    meta: '2 policies',
  },
  { name: 'ScriptsTable', table: layout => <ScriptsTable {...SCRIPTS_TABLE.loaded} {...layout} />, meta: '2 scripts' },
  {
    name: 'ScriptSchedulesTable',
    table: layout => <ScriptSchedulesTable {...SCRIPT_SCHEDULES_TABLE.loaded} {...layout} />,
    meta: '2 schedules',
  },
  {
    name: 'ScriptExecutionsTable',
    table: layout => <ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} {...layout} />,
    meta: '2 executions',
  },
  {
    name: 'KnowledgeBaseTableBody',
    table: layout => <KnowledgeBaseTableBody {...KNOWLEDGE_BASE_TABLE.loaded} {...layout} />,
    meta: '2 items',
  },
  { name: 'LogsTableView', table: layout => <LogsTableView {...LOGS_TABLE.loaded} {...layout} />, meta: '2 results' },
  {
    name: 'TenantsTableView (multi-customer)',
    table: layout => <TenantsTableView {...TENANTS_TABLE.loaded} {...layout} />,
    meta: '2 results',
  },
  {
    name: 'SingleCustomerTenantsTableView',
    table: layout => <SingleCustomerTenantsTableView {...SINGLE_CUSTOMER_TENANTS_TABLE.loaded} {...layout} />,
    meta: '2 results',
  },
  {
    name: 'DeviceSelector',
    table: layout => <DeviceSelector {...DEVICE_SELECTOR.loaded} {...layout} />,
    // The selector's header slot is its bulk action while there is one; the count otherwise.
    meta: 'Add All Devices',
  },
];

/** What the fixed-height scroll viewport carries; the grid's root has none without a stated height. */
const MAX_HEIGHT = '--data-table-max-height';
/** The settings gear's cell in the grid header. */
const SETTINGS_GEAR = 'data-grid-settings-cell';

/** The tags stripped: the text a reader sees. */
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, '');

/** Where the first of `markers` starts in `markup` after `from`, or the end. */
function nextMarker(markup: string, from: number, markers: string[]): number {
  const found = markers.map(marker => markup.indexOf(marker, from)).filter(index => index !== -1);
  return found.length ? Math.min(...found) : markup.length;
}

/** The grid's results row above the table, as markup; empty when the table draws none. */
function metaRow(container: HTMLElement): string {
  const markup = container.innerHTML;
  const start = markup.indexOf('data-grid-meta');
  if (start === -1) return '';
  return markup.slice(start, nextMarker(markup, start + 1, [MAX_HEIGHT, 'data-grid-header', 'data-grid-body']));
}

/** The grid form of the body, as markup (from its opening tag on). */
function gridBody(container: HTMLElement): string {
  const start = container.innerHTML.indexOf('data-grid-body');
  return start === -1 ? '' : container.innerHTML.slice(start);
}

describe('feature tables, grid layout pass-through', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());

  describe.each(TABLES)('$name', ({ table, meta }) => {
    it('stays a cards table unless asked', () => {
      const { container } = render(table({}));
      expect(container.innerHTML).not.toContain('data-grid-');
    });

    it('drops the height and the settings while it is a cards table: the same markup', () => {
      const { container: plain } = render(table({}));
      const { container: withGridOptions } = render(
        table({ tableMaxHeight: 360, tableSettings: { storageKey: 'unused' } }),
      );
      expect(withGridOptions.innerHTML).toBe(plain.innerHTML);

      const { container: cards } = render(table({ layout: 'cards', tableMaxHeight: 'fill', tableSettings: {} }));
      expect(cards.innerHTML).toBe(plain.innerHTML);
    });

    it('draws the grid when asked, with its results row above the table', () => {
      const { container } = render(table({ layout: 'grid' }));
      expect(container.innerHTML).toContain('data-grid-root');
      expect(container.innerHTML).toContain('data-grid-header');
      expect(container.innerHTML).toContain('data-grid-body');
      expect(textOf(metaRow(container))).toContain(meta);
      // No height stated: the page scrolls, the table has no viewport of its own. No settings: no gear.
      expect(container.innerHTML).not.toContain(MAX_HEIGHT);
      expect(container.innerHTML).not.toContain(SETTINGS_GEAR);
    });

    it('hands the grid its height: the table becomes its own scroll viewport', () => {
      const { container } = render(table({ layout: 'grid', tableMaxHeight: 360 }));
      const markup = container.innerHTML;
      expect(markup).toContain(`${MAX_HEIGHT}: 360px`);
      // The results row stays above the viewport; the header and the rows scroll inside it.
      expect(markup.indexOf('data-grid-meta')).toBeLessThan(markup.indexOf(MAX_HEIGHT));
      expect(markup.indexOf(MAX_HEIGHT)).toBeLessThan(markup.indexOf('data-grid-header'));
      expect(markup.indexOf('data-grid-header')).toBeLessThan(markup.indexOf('data-grid-body'));
    });

    it('hands the grid its settings: the gear is in the header', () => {
      const { container } = render(table({ layout: 'grid', tableSettings: {} }));
      expect(container.innerHTML).toContain(SETTINGS_GEAR);
    });
  });

  describe('the results row follows the header', () => {
    it('is left out when the host gives the header no right slot', () => {
      const { rightSlot: _rightSlot, ...withoutSlot } = POLICIES_TABLE.loaded;
      const { container } = render(<PoliciesTable {...withoutSlot} layout="grid" />);
      expect(container.innerHTML).toContain('data-grid-header');
      expect(metaRow(container)).toBe('');
    });

    it('is left out with the header on an empty table', () => {
      const { container: policies } = render(
        <PoliciesTable {...POLICIES_TABLE.empty} rightSlot={<span>0 policies</span>} layout="grid" />,
      );
      expect(policies.innerHTML).not.toContain('data-grid-header');
      expect(metaRow(policies)).toBe('');

      const { container: scripts } = render(
        <ScriptsTable {...SCRIPTS_TABLE.empty} rightSlot={<span>0 scripts</span>} layout="grid" />,
      );
      expect(metaRow(scripts)).toBe('');

      const { container: schedules } = render(
        <ScriptSchedulesTable {...SCRIPT_SCHEDULES_TABLE.empty} rightSlot={<span>0 schedules</span>} layout="grid" />,
      );
      expect(metaRow(schedules)).toBe('');
    });

    it('is left out when the executions table is asked for no header', () => {
      const { container } = render(
        <ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} showHeader={false} layout="grid" />,
      );
      expect(container.innerHTML).not.toContain('data-grid-header');
      expect(metaRow(container)).toBe('');
    });

    it("is left out with the logs header on a device's empty tab, and kept while a search is applied", () => {
      const { container: emptyTab } = render(
        <LogsTableView logs={[]} filters={{}} onFilterChange={() => {}} deviceScoped layout="grid" />,
      );
      expect(emptyTab.innerHTML).not.toContain('data-grid-header');
      expect(metaRow(emptyTab)).toBe('');

      const { container: searched } = render(<LogsTableView {...LOGS_TABLE.empty} deviceScoped layout="grid" />);
      expect(searched.innerHTML).toContain('data-grid-header');
      expect(metaRow(searched)).not.toBe('');
    });

    it('holds the device count where the selector has no bulk action', () => {
      const { container } = render(<DeviceSelector {...DEVICE_SELECTOR.loaded} singleSelect layout="grid" />);
      expect(textOf(metaRow(container))).toContain('2 devices');
    });
  });

  describe('grid states', () => {
    it('draws loading rows as grid rows', () => {
      const { container } = render(<ScriptsTable {...SCRIPTS_TABLE.loading} layout="grid" />);
      expect(gridBody(container).split('data-loading-item')).toHaveLength(2 + 1);
    });

    it('draws the empty state inside the grid body', () => {
      const { container } = render(<KnowledgeBaseTableBody {...KNOWLEDGE_BASE_TABLE.empty} layout="grid" />);
      expect(textOf(gridBody(container))).toContain('No items found.');
    });

    it("draws a row's sub-row in the grid", () => {
      const { container } = render(<ScriptExecutionsTable {...SCRIPT_EXECUTIONS_TABLE.loaded} layout="grid" />);
      expect(gridBody(container)).toMatch(/data-sub-row[^>]*>Service restarted</);
    });

    it('keeps a footer the host hands in inside the fixed viewport, after the rows', () => {
      const { container } = render(
        <KnowledgeBaseTableBody {...KNOWLEDGE_BASE_TABLE.loaded} layout="grid" tableMaxHeight="fill" />,
      );
      const markup = container.innerHTML;
      expect(markup.indexOf(MAX_HEIGHT)).toBeGreaterThan(-1);
      expect(markup.indexOf(MAX_HEIGHT)).toBeLessThan(markup.indexOf('data-grid-body'));
      expect(gridBody(container)).toContain('data-footer-slot');
    });
  });
});
