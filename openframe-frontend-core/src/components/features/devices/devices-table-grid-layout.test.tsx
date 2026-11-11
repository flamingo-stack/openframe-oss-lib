import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DevicesTableBody } from './devices-table-columns';
import type { DeviceRow } from './types';

/**
 * The devices table in the grid layout: every cell is one 48px line. The card form of each cell (the tile, the tag
 * over its last-seen line, the two-line customer) stays for the card rows below `md`; these lock the grid form.
 */

const DEVICES: DeviceRow[] = [
  {
    id: 'd-1',
    machineId: 'm-1',
    status: 'OFFLINE',
    hostname: 'reception-01',
    nickname: null,
    type: 'desktop',
    osType: 'WINDOWS',
    organization: 'Acme Logistics',
    last_seen: '2026-10-06T12:55:00Z',
    unreadNotificationCount: 2,
    directoryUserLink: 'PRIMARY',
    directoryUserName: 'Maya Chen',
    directorySources: ['ENTRA', 'GOOGLE', 'OKTA'],
  },
  { id: 'd-2', machineId: 'm-2', status: 'ONLINE', hostname: 'maya-mba', nickname: null },
];

/** The markup of the grid form of the body (from its opening tag on). */
function gridBodyMarkup(container: HTMLElement): string {
  return container.innerHTML.slice(container.innerHTML.indexOf('data-grid-body'));
}

/** The grid body's rows, as markup: one string per row. */
function gridRows(container: HTMLElement): string[] {
  return gridBodyMarkup(container).split('group/gridrow').slice(1);
}

describe('DevicesTableBody, grid layout', () => {
  it('stays a cards table unless asked: no grid form', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} />);
    expect(container.innerHTML).not.toContain('data-grid-body');
  });

  it('draws the grid form with the results count above it', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} layout="grid" totalCount={2} />);
    expect(gridRows(container)).toHaveLength(2);
    expect(container.innerHTML).toContain('data-grid-meta');
    // The card rows' own gap is not carried into the grid: its rows touch.
    expect(gridBodyMarkup(container)).not.toContain('mb-1');
  });

  it('draws no checkbox column unless asked: a grid row starts with the device', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} layout="grid" />);
    expect(gridBodyMarkup(container)).not.toContain('data-grid-select');
    expect(screen.queryByRole('checkbox', { name: 'Select all rows' })).toBeNull();
    expect(screen.queryAllByRole('checkbox', { name: 'Select row' })).toHaveLength(0);
  });

  it('draws no checkbox column in a cards table, selectable or not', () => {
    render(<DevicesTableBody devices={DEVICES} selectable />);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('selectable: starts every grid row with the checkbox column, and the header with "select all"', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} layout="grid" selectable />);
    const [first] = gridRows(container);
    // The selection cell is the first cell of the row, before the device's name.
    expect(first?.indexOf('data-grid-select')).toBeLessThan(first?.indexOf('reception-01') ?? -1);
    expect(first).toMatch(/data-grid-select[\s\S]*?role="checkbox"/);
    expect(screen.getByRole('checkbox', { name: 'Select all rows' })).toBeTruthy();
  });

  it('selectable: selects a row from its checkbox, and all rows from the header', () => {
    render(<DevicesTableBody devices={DEVICES} layout="grid" selectable />);
    // The card form's (hidden) checkboxes come first in the document, then the grid form's.
    const rowBoxes = () => screen.getAllByRole('checkbox', { name: 'Select row' }).slice(DEVICES.length);
    const selectAll = () => screen.getByRole('checkbox', { name: 'Select all rows' });

    fireEvent.click(rowBoxes()[0]);
    expect(rowBoxes()[0]?.getAttribute('aria-checked')).toBe('true');
    expect(selectAll().getAttribute('aria-checked')).toBe('false');

    fireEvent.click(selectAll());
    expect(rowBoxes().every(box => box.getAttribute('aria-checked') === 'true')).toBe(true);
  });

  it('puts the last-seen time beside the status tag, not under it', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} layout="grid" />);
    const [first, second] = gridRows(container);
    expect(first).toMatch(/data-part="tag"[\s\S]*data-part="secondary"/);
    // A device that was never seen says so in the same place.
    expect(second).toMatch(/data-part="secondary"[^>]*>Never</);
  });

  it('marks unread notifications at the end of the device line, only where there are some', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} layout="grid" />);
    const [first, second] = gridRows(container);
    expect(first).toContain('data-part="trailing"');
    expect(second).not.toContain('data-part="trailing"');
  });

  it('draws the directory columns on one line: the user with its role beside it, the first source and +N', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} layout="grid" directoryColumns />);
    const [first, second] = gridRows(container);
    expect(first).toContain('Maya Chen');
    expect(first).toContain('+2');
    // No directory knows the second device: its sources cell is empty.
    expect(second).not.toContain('data-part="more"');
    expect(screen.getAllByText('Maya Chen').length).toBeGreaterThan(0);
  });

  it('keeps the action column out of the row link', () => {
    const { container } = render(<DevicesTableBody devices={DEVICES} layout="grid" />);
    const [first] = gridRows(container);
    expect(first).toMatch(/data-no-row-click[\s\S]*Open in new tab/);
  });
});
