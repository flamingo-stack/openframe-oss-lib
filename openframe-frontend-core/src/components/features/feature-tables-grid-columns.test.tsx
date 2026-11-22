import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DeviceSelector } from './devices/device-selector/device-selector';
import type { DeviceSelectorProps, SubTab } from './devices/device-selector/device-selector.types';
import { EMPTY_NARROWING } from './devices/device-selector/narrowing';
import type { DeviceRow } from './devices/types';
import { DEVICE_SELECTOR, IdleIntersectionObserver, LOGS_TABLE, POLICIES_TABLE } from './feature-tables.fixtures';
import { LogCopyIconButton } from './logs/logs-page-view';
import { LogsTableView } from './logs/logs-table-view';
import type { LogsTableDateFilter } from './logs/types';
import { PoliciesTable } from './policies/policies-table';
import type { PolicyTableRow } from './policies/policy-table-row';

/**
 * The feature tables whose COLUMNS are ready for the grid (`docs/DATA_TABLE_GRID.md`): a px width per data column, a
 * card row's two lines on one, the row actions as action columns. jsdom has no layout, so what is locked is which
 * cells there are and what each holds; widths on screen and pinning are checked in the browser on the stories.
 */

/** The tags stripped: the text a reader sees. */
const textOf = (markup: string) => markup.replace(/<[^>]+>/g, '');

/** The grid's header and body, as markup. */
function gridParts(container: HTMLElement): { header: string; body: string } {
  const markup = container.innerHTML;
  const bodyStart = markup.indexOf('data-grid-body');
  return { header: markup.slice(markup.indexOf('data-grid-header="'), bodyStart), body: markup.slice(bodyStart) };
}

/** The ids of the grid's data columns, in header order. Action columns are not data columns and carry no id. */
function dataColumns(container: HTMLElement): string[] {
  return [...gridParts(container).header.matchAll(/data-grid-col="([^"]+)"/g)].map(match => match[1] ?? '');
}

/** What follows `marker`'s tag in `markup`, up to the next cell (a data cell, an action cell) or the next row. */
function cellAfter(markup: string, marker: string, occurrence: number): string {
  let at = -1;
  for (let found = 0; found <= occurrence; found += 1) {
    at = markup.indexOf(marker, at + 1);
    if (at === -1) return '';
  }
  const from = markup.indexOf('>', at) + 1;
  const ends = ['data-grid-col="', 'data-no-row-click', 'group/gridrow']
    .map(next => markup.indexOf(next, from))
    .filter(index => index !== -1);
  // The slice ends inside the next cell's opening tag: drop that unfinished tag.
  return markup.slice(from, ends.length ? Math.min(...ends) : markup.length).replace(/<[^>]*$/, '');
}

/** The text of a row's data cell, by the row's place and the column id. */
function cellText(container: HTMLElement, row: number, column: string): string {
  return textOf(cellAfter(gridParts(container).body, `data-grid-col="${column}"`, row));
}

/** The text of a data column's header cell. */
function headerText(container: HTMLElement, column: string): string {
  return textOf(cellAfter(gridParts(container).header, `data-grid-col="${column}"`, 0));
}

/** The stated width of the grid's column at `index`, in px. */
function columnWidth(container: HTMLElement, index: number): number {
  return Number(new RegExp(`--dtc${index}-w: (\\d+)px`).exec(container.innerHTML)?.[1]);
}

const ROW_WITH_ACTIONS: PolicyTableRow = {
  id: 'p-3',
  name: 'Screen lock enabled',
  critical: false,
  severityLabel: 'Low',
  status: { label: 'Passing', variant: 'success' },
  actions: [{ label: 'Edit policy', onClick: () => {} }],
  href: '/policies/p-3',
};

const noop = () => {};

const DATE_FILTER: LogsTableDateFilter = { sortDirection: 'desc', range: undefined, onApply: noop };

describe('feature tables, grid columns', () => {
  beforeAll(() => vi.stubGlobal('IntersectionObserver', IdleIntersectionObserver));
  afterAll(() => vi.unstubAllGlobals());

  describe('PoliciesTable', () => {
    it('lists its data columns, with the open button as an action column', () => {
      const { container } = render(<PoliciesTable {...POLICIES_TABLE.loaded} layout="grid" />);
      expect(dataColumns(container)).toEqual(['name', 'severity', 'platform', 'status']);
      // name 480, severity 140, platform 160, status 240, open 56.
      expect([0, 1, 2, 3, 4].map(index => columnWidth(container, index))).toEqual([480, 140, 160, 240, 56]);
    });

    it('adds the row menu as a second action column when a row has actions', () => {
      const { container } = render(<PoliciesTable rows={[ROW_WITH_ACTIONS]} layout="grid" />);
      expect(dataColumns(container)).toEqual(['name', 'severity', 'status']);
      // name, severity, status, then actions 56 and open 56.
      expect([3, 4].map(index => columnWidth(container, index))).toEqual([56, 56]);
      expect(screen.getByRole('button', { name: 'More actions' }).className).toContain('size-10');
    });

    it('puts a card row’s two lines on one: the name with its description, the status with its note', () => {
      const { container } = render(<PoliciesTable {...POLICIES_TABLE.loaded} layout="grid" />);
      expect(cellText(container, 0, 'name')).toBe('Disk encryption enabledFileVault or BitLocker is on');
      expect(cellText(container, 1, 'name')).toBe('Firewall enabled');
      expect(cellText(container, 0, 'status')).toBe('Failing3 devices');
      expect(cellText(container, 0, 'severity')).toBe('Critical');
    });

    it('keeps the note’s tone and cuts it before the tag', () => {
      render(<PoliciesTable {...POLICIES_TABLE.loaded} layout="grid" />);
      const note = screen.getByText('3 devices');
      expect(note.className).toContain('text-ods-error');
      expect(note.className).toContain('truncate');
    });

    it('draws the open button bare in the grid and outlined in a card row', () => {
      const { unmount } = render(<PoliciesTable {...POLICIES_TABLE.loaded} layout="grid" />);
      const inGrid = screen.getByRole('button', { name: 'Open Disk encryption enabled' });
      expect(inGrid.className).toContain('size-10');
      expect(inGrid.className).not.toContain('bg-ods-card');
      unmount();

      render(<PoliciesTable {...POLICIES_TABLE.loaded} />);
      const inCards = screen.getAllByRole('button', { name: 'Open Disk encryption enabled' })[0];
      expect(inCards?.className).toContain('bg-ods-card');
      expect(inCards?.className).not.toContain('size-10');
    });

    it('keeps the action columns while loading, so the columns do not move when the rows arrive', () => {
      const { container } = render(<PoliciesTable {...POLICIES_TABLE.loading} layout="grid" />);
      // name, severity, status, then the reserved actions column and the open column.
      expect([3, 4].map(index => columnWidth(container, index))).toEqual([56, 56]);
    });
  });

  describe('LogsTableView', () => {
    it('lists its data columns, with copy, quick view and open as action columns', () => {
      const { container } = render(<LogsTableView {...LOGS_TABLE.loaded} layout="grid" />);
      expect(dataColumns(container)).toEqual(['logId', 'status', 'tool', 'source', 'description']);
      // logId 320, status 160, tool 200, source 280, description 400, then three 56px actions.
      expect([0, 1, 2, 3, 4, 5, 6, 7].map(index => columnWidth(container, index))).toEqual([
        320, 160, 200, 280, 400, 56, 56, 56,
      ]);
    });

    it('puts a card row’s two lines on one: the time with the id, the device with its customer', () => {
      const { container } = render(<LogsTableView {...LOGS_TABLE.loaded} layout="grid" />);
      expect(cellText(container, 0, 'logId')).toBe('11 Nov 2026, 10:15LOG-1');
      expect(cellText(container, 0, 'source')).toBe('reception-01Acme Logistics');
      expect(cellText(container, 1, 'source')).toBe('maya-mba');
      expect(cellText(container, 0, 'description')).toBe('Policy applied');
    });

    it('draws the Log ID header as the date header, from the date filter', () => {
      render(<LogsTableView {...LOGS_TABLE.loaded} dateFilter={DATE_FILTER} layout="grid" />);
      const trigger = screen.getByRole('button', { name: 'Log ID, sort and filter by date' });
      expect(trigger).toHaveAttribute('data-grid-date-filter');
      expect(trigger).not.toHaveAttribute('data-applied');
    });

    it('shows an applied range on the date header', () => {
      const range = { from: new Date(2026, 10, 1), to: new Date(2026, 10, 7) };
      render(<LogsTableView {...LOGS_TABLE.loaded} dateFilter={{ ...DATE_FILTER, range }} layout="grid" />);
      expect(screen.getByRole('button', { name: 'Log ID, sort and filter by date' })).toHaveAttribute('data-applied');
    });

    it('leaves the host’s header control to the cards table: the grid draws its own', () => {
      const header = <span data-host-date-header>Log ID</span>;
      const { container: grid } = render(
        <LogsTableView {...LOGS_TABLE.loaded} dateFilter={DATE_FILTER} logIdHeader={header} layout="grid" />,
      );
      expect(grid.innerHTML).not.toContain('data-host-date-header');
      expect(grid.innerHTML).toContain('data-grid-date-filter');

      const { container: cards } = render(
        <LogsTableView {...LOGS_TABLE.loaded} dateFilter={DATE_FILTER} logIdHeader={header} />,
      );
      expect(cards.innerHTML).toContain('data-host-date-header');
      expect(cards.innerHTML).not.toContain('data-grid-date-filter');
    });

    it('has a plain Log ID header without a date filter', () => {
      const { container } = render(<LogsTableView {...LOGS_TABLE.loaded} layout="grid" />);
      expect(container.innerHTML).not.toContain('data-grid-date-filter');
      expect(headerText(container, 'logId')).toBe('Log ID');
    });

    it('draws the row buttons bare, the host’s copy button included', () => {
      render(
        <LogsTableView {...LOGS_TABLE.loaded} renderCopyAction={() => <LogCopyIconButton grid />} layout="grid" />,
      );
      for (const name of ['Quick view', 'Open in new tab', 'Copy log details']) {
        const [button] = screen.getAllByRole('button', { name });
        expect(button?.className).toContain('size-10');
        expect(button?.className).not.toContain('bg-ods-card');
      }
    });

    it('still leaves out the columns the host hides', () => {
      const { container } = render(
        <LogsTableView {...LOGS_TABLE.loaded} hiddenColumns={['source', 'copy']} layout="grid" />,
      );
      expect(dataColumns(container)).toEqual(['logId', 'status', 'tool', 'description']);
      // Four data columns, then quick view and open.
      expect([4, 5].map(index => columnWidth(container, index))).toEqual([56, 56]);
      expect(Number.isNaN(columnWidth(container, 6))).toBe(true);
    });
  });

  describe('DeviceSelector', () => {
    /** The picker holding its own selection, as a host's form does (the lists are the browser's). */
    function ClientPicker(props: Partial<DeviceSelectorProps>) {
      const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
      return (
        <DeviceSelector
          {...DEVICE_SELECTOR.loaded}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          layout="grid"
          {...props}
        />
      );
    }

    /**
     * The picker in server mode: the host answers add and remove, and hands back which rows of the page are in. The
     * Selected tab lists only those.
     */
    function ServerPicker({ startTab = 'available' }: { startTab?: SubTab }) {
      const [assigned, setAssigned] = useState<Set<string>>(() => new Set(['m-2']));
      const [activeTab, setActiveTab] = useState<SubTab>(startTab);
      const page = DEVICE_SELECTOR.loaded.devices.filter(
        device => activeTab === 'available' || assigned.has(device.machineId ?? ''),
      );
      const change = (device: DeviceRow, isIn: boolean) =>
        setAssigned(previous => {
          const next = new Set(previous);
          if (isIn) next.add(device.machineId ?? '');
          else next.delete(device.machineId ?? '');
          return next;
        });
      return (
        <DeviceSelector
          {...DEVICE_SELECTOR.loaded}
          devices={page}
          selectedIds={assigned}
          layout="grid"
          server={{
            activeTab,
            onTabChange: setActiveTab,
            search: '',
            onSearchChange: noop,
            narrowing: EMPTY_NARROWING,
            onNarrowingChange: noop,
            selectedCount: assigned.size,
            totalCount: page.length,
            onAdd: device => change(device, true),
            onRemove: device => change(device, false),
            onAddAll: noop,
            onRemoveAll: noop,
          }}
        />
      );
    }

    it('lists its data columns, with add / remove as an action column', () => {
      const { container } = render(<ClientPicker />);
      expect(dataColumns(container)).toEqual(['device', 'organization', 'os', 'status']);
      // device 280, customer 280, OS 160, status 220, then the 56px add / remove column.
      expect([0, 1, 2, 3, 4].map(index => columnWidth(container, index))).toEqual([280, 280, 160, 220, 56]);
      expect(Number.isNaN(columnWidth(container, 5))).toBe(true);
    });

    it('puts a card row’s two lines on one: the last online time sits with the status', () => {
      const { container } = render(<ClientPicker />);
      expect(cellText(container, 0, 'device')).toBe('reception-01');
      // The fixture's devices were never seen. A card row says so under the name ("Last Online: ...").
      expect(cellText(container, 0, 'status')).toMatch(/Never$/);
      expect(gridParts(container).body).not.toContain('Last Online');
    });

    it('draws the add control bare in the grid and outlined in a card row', () => {
      const { unmount } = render(<ClientPicker />);
      const inGrid = screen.getByRole('button', { name: 'Add reception-01' });
      expect(inGrid.className).toContain('size-10');
      expect(inGrid.className).toContain('border-0');
      unmount();

      const { container } = render(<DeviceSelector {...DEVICE_SELECTOR.loaded} />);
      // A card row's control carries no name of its own: the grid's does, since it is an icon alone.
      expect(screen.queryByRole('button', { name: 'Add reception-01' })).toBeNull();
      expect(container.innerHTML).not.toContain('data-grid-body');
    });

    it('marks an added device in its row at once, in the lists the browser holds', () => {
      render(<ClientPicker />);
      const add = screen.getByRole('button', { name: 'Add reception-01' });
      expect(add).not.toHaveAttribute('aria-pressed');
      fireEvent.click(add);

      const added = screen.getByRole('button', { name: 'Remove reception-01' });
      expect(added).toHaveAttribute('aria-pressed', 'true');
      // "Added" is the accent check: the card row's fill and border are not drawn in a grid action cell.
      expect(added.className).toContain('text-ods-accent');
      expect(added.className).not.toContain('bg-ods-open-yellow-secondary');
      expect(screen.queryByRole('button', { name: 'Add reception-01' })).toBeNull();
      // The other row did not change.
      expect(screen.getByRole('button', { name: 'Add maya-mba' })).not.toHaveAttribute('aria-pressed');

      fireEvent.click(added);
      expect(screen.getByRole('button', { name: 'Add reception-01' })).not.toHaveAttribute('aria-pressed');
    });

    it('marks an added device in its row at once, in the lists the server answers', () => {
      render(<ServerPicker />);
      // The host says the second device is already in.
      expect(screen.getByRole('button', { name: 'Remove maya-mba' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Add reception-01' }));
      expect(screen.getByRole('button', { name: 'Remove reception-01' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Remove maya-mba' }));
      expect(screen.getByRole('button', { name: 'Add maya-mba' })).not.toHaveAttribute('aria-pressed');
    });

    it('offers remove on the Selected tab, and the row leaves when it is used', () => {
      render(<ServerPicker startTab="selected" />);
      const remove = screen.getByRole('button', { name: 'Remove maya-mba' });
      expect(remove.className).toContain('text-ods-error');
      // A removal is not a state of the row: nothing is "pressed" on this tab.
      expect(remove).not.toHaveAttribute('aria-pressed');
      expect(screen.queryByRole('button', { name: /reception-01/ })).toBeNull();
      fireEvent.click(remove);
      expect(screen.queryByRole('button', { name: 'Remove maya-mba' })).toBeNull();
    });

    it('keeps a device that cannot be added out, with the reason on the control', () => {
      const reason = 'Offline devices cannot run a script';
      const { container } = render(
        <ClientPicker isDeviceDisabled={device => (device.connectivity === 'OFFLINE' ? reason : undefined)} />,
      );
      const blocked = screen.getByRole('button', { name: 'Add maya-mba' });
      expect(blocked).toBeDisabled();
      // The reason is the control's tooltip and its name for a screen reader, not text in the 56px cell.
      expect(screen.getByLabelText(`Add maya-mba: ${reason}`)).toBeTruthy();
      expect(textOf(gridParts(container).body)).not.toContain(reason);
      expect(screen.getByRole('button', { name: 'Add reception-01' })).toBeEnabled();
    });

    it('still leaves out the columns the host hides, the add / remove column among them', () => {
      const { container } = render(<ClientPicker hideColumns={['organization', 'status', 'actions']} />);
      expect(dataColumns(container)).toEqual(['device', 'os']);
      expect([0, 1].map(index => columnWidth(container, index))).toEqual([280, 160]);
      expect(Number.isNaN(columnWidth(container, 2))).toBe(true);
      expect(screen.queryByRole('button', { name: 'Add reception-01' })).toBeNull();
    });

    it('keeps the add / remove column while loading, so the columns do not move when the devices arrive', () => {
      const { container } = render(<DeviceSelector {...DEVICE_SELECTOR.loading} layout="grid" />);
      expect(columnWidth(container, 4)).toBe(56);
    });

    it('does not draw a device’s unread mark: a picker is not where notifications are read', () => {
      const devices: DeviceRow[] = DEVICE_SELECTOR.loaded.devices.map(device => ({
        ...device,
        unreadNotificationCount: 3,
      }));
      const { container } = render(<ClientPicker devices={devices} />);
      expect(cellText(container, 0, 'device')).toBe('reception-01');
      expect(gridParts(container).body).not.toMatch(/unread/i);
    });
  });
});
