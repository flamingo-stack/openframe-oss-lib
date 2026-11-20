import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeviceConnectivityIcon } from './device-connectivity-icon';
import { DeviceLifecycleTag, deviceLifecycleTagProps } from './device-lifecycle-tag';
import { getLegacyDeviceStatusConfig } from './device-status';
import { DeviceStatusDisplayProvider } from './device-status-display';
import { deviceStatusFilterGroups, splitStatusFilterValue } from './device-statuses';
import { DevicesGrid } from './devices-grid';
import { getDeviceFilterColumns } from './devices-table-columns';
import type { DeviceFilters } from './types';
import { useTagFilterModal } from './use-tag-filter-modal';

/**
 * The legacy status display: the look from before the lifecycle / connectivity split, which a host keeps behind a
 * flag. Only the look changes; online still comes from `connectivity`, on a backend that writes MANAGED or not.
 */

const legacy = ({ children }: { children: ReactNode }) => (
  <DeviceStatusDisplayProvider display="legacy">{children}</DeviceStatusDisplayProvider>
);

const FACETS: DeviceFilters = {
  statuses: [
    { value: 'MANAGED', count: 3 },
    { value: 'ONLINE', count: 1 },
    { value: 'PENDING', count: 2 },
    { value: 'PENDING_DELETION', count: 1 },
  ],
  connectivity: [
    { value: 'OFFLINE', count: 1 },
    { value: 'ONLINE', count: 3 },
  ],
  deviceTypes: [],
  osTypes: [],
  organizationIds: [],
  tagKeys: [],
  filteredCount: 6,
};

describe('getLegacyDeviceStatusConfig', () => {
  it('reads a managed device ONLINE or OFFLINE from its connectivity, whatever its status says', () => {
    expect(getLegacyDeviceStatusConfig('MANAGED', 'ONLINE')).toMatchObject({ label: 'ONLINE', variant: 'success' });
    expect(getLegacyDeviceStatusConfig('MANAGED', 'OFFLINE')).toMatchObject({ label: 'OFFLINE', variant: 'error' });
    // A phase-1 backend's ONLINE status with the device gone offline since: connectivity is the newer word.
    expect(getLegacyDeviceStatusConfig('ONLINE', 'OFFLINE').label).toBe('OFFLINE');
  });

  it('reads never-reported connectivity as OFFLINE, and falls back to the status only without the field', () => {
    expect(getLegacyDeviceStatusConfig('MANAGED', null).label).toBe('OFFLINE');
    expect(getLegacyDeviceStatusConfig('ONLINE').label).toBe('ONLINE');
  });

  it('keeps the other statuses as they read before', () => {
    expect(getLegacyDeviceStatusConfig('PENDING', 'ONLINE')).toMatchObject({ label: 'PENDING', variant: 'warning' });
    expect(getLegacyDeviceStatusConfig('PENDING_DELETION', 'ONLINE').label).toBe('PENDING DELETION');
  });
});

describe('deviceLifecycleTagProps', () => {
  it('is the lifecycle tag, with its icon, unless the legacy display is asked for', () => {
    expect(deviceLifecycleTagProps('ONLINE')).toMatchObject({ label: 'MANAGED', variant: 'success' });
    expect(deviceLifecycleTagProps('ONLINE').icon).toBeDefined();
    expect(deviceLifecycleTagProps('MANAGED', { connectivity: 'OFFLINE', display: 'legacy' })).toEqual({
      label: 'OFFLINE',
      variant: 'error',
    });
  });
});

describe('DeviceLifecycleTag', () => {
  it('draws MANAGED by default and ONLINE in the legacy display', () => {
    const { rerender } = render(<DeviceLifecycleTag status="MANAGED" connectivity="ONLINE" />);
    expect(screen.getByText('MANAGED')).toBeTruthy();

    rerender(
      <DeviceStatusDisplayProvider display="legacy">
        <DeviceLifecycleTag status="MANAGED" connectivity="ONLINE" />
      </DeviceStatusDisplayProvider>,
    );
    expect(screen.getByText('ONLINE')).toBeTruthy();
    expect(screen.queryByText('MANAGED')).toBeNull();
  });
});

describe('DeviceConnectivityIcon', () => {
  it('draws the legacy icon in its place in the legacy display, and nothing without one', () => {
    const { rerender } = render(
      <DeviceStatusDisplayProvider display="legacy">
        <DeviceConnectivityIcon connectivity="ONLINE" legacyIcon={<span data-testid="type-tile" />} />
      </DeviceStatusDisplayProvider>,
    );
    expect(screen.getByTestId('type-tile')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();

    rerender(
      <DeviceStatusDisplayProvider display="legacy">
        <DeviceConnectivityIcon connectivity="ONLINE" />
      </DeviceStatusDisplayProvider>,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.queryByTestId('type-tile')).toBeNull();
  });

  it('draws the connectivity icon by default', () => {
    render(<DeviceConnectivityIcon connectivity="ONLINE" legacyIcon={<span data-testid="type-tile" />} />);
    expect(screen.getByRole('img', { name: /^Online/ })).toBeTruthy();
    expect(screen.queryByTestId('type-tile')).toBeNull();
  });
});

describe('DeviceConnectivityIcon states (CU-17tkuw68jdu)', () => {
  const NOW = new Date('2026-11-20T12:00:00Z');
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  /** The fill of the icon's dot: its first path, drawn in `secondaryColor`. */
  const dotFill = (icon: HTMLElement) => /<path fill="([^"]+)"/.exec(icon.innerHTML)?.[1];
  /** Opens the tooltip by keyboard focus and returns its one line (Radix renders it twice: visible + a11y copy). */
  const openTooltip = (icon: HTMLElement) => {
    act(() => {
      icon.focus();
    });
    return screen.getAllByText(/^(Online|Last seen .+|Never seen)$/)[0]?.textContent;
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('draws an offline device with a red dot and "Last seen 2 days ago" when focused', () => {
    render(<DeviceConnectivityIcon connectivity="OFFLINE" lastSeen={daysAgo(2)} />);
    const icon = screen.getByRole('img', { name: /^Offline\. Last seen / });
    expect(icon.getAttribute('data-connectivity')).toBe('offline');
    expect(dotFill(icon)).toBe('var(--color-error)');
    expect(icon.tabIndex).toBe(0);
    expect(openTooltip(icon)).toBe('Last seen 2 days ago');
  });

  it('takes the relative time when the tooltip opens, not when the row rendered', () => {
    render(<DeviceConnectivityIcon connectivity="OFFLINE" lastSeen={daysAgo(2)} />);
    const icon = screen.getByRole('img');
    vi.setSystemTime(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
    expect(openTooltip(icon)).toBe('Last seen 3 days ago');
  });

  it('keeps the grey dot and says "Never seen" for a device that never reported', () => {
    render(<DeviceConnectivityIcon connectivity={null} lastSeen={null} />);
    const icon = screen.getByRole('img', { name: 'Never seen' });
    expect(icon.getAttribute('data-connectivity')).toBe('unknown');
    expect(dotFill(icon)).toBe('var(--color-border)');
    expect(openTooltip(icon)).toBe('Never seen');
  });

  it('says "Never seen" for an offline device with no readable last seen, still red', () => {
    render(<DeviceConnectivityIcon connectivity="OFFLINE" lastSeen="not a date" />);
    const icon = screen.getByRole('img', { name: 'Offline. Never seen' });
    expect(dotFill(icon)).toBe('var(--color-error)');
    expect(openTooltip(icon)).toBe('Never seen');
  });

  it('keeps the green dot for an online device and says only "Online"', () => {
    render(<DeviceConnectivityIcon connectivity="ONLINE" lastSeen={daysAgo(0)} />);
    const icon = screen.getByRole('img', { name: 'Online' });
    expect(dotFill(icon)).toBe('var(--color-success)');
    expect(openTooltip(icon)).toBe('Online');
  });
});

describe('getDeviceFilterColumns in the legacy display', () => {
  const columns = getDeviceFilterColumns(FACETS, { statusDisplay: 'legacy' });
  const status = columns.find(column => column.key === 'status')?.filterOptions ?? [];

  it('offers ONLINE and OFFLINE as STATUS options in place of MANAGED, with no Connectivity group', () => {
    expect(status.map(option => option.label)).toEqual(['ONLINE', 'OFFLINE', 'PENDING', 'PENDING DELETION']);
    expect(columns.some(column => column.key === 'connectivity')).toBe(false);
  });

  it('filters ONLINE and OFFLINE on connectivity, counted by the connectivity facet', () => {
    const online = status.find(option => option.label === 'ONLINE');
    expect(online?.count).toBe(3);
    expect(splitStatusFilterValue([online?.value ?? ''])).toEqual({ statuses: [], connectivity: ['ONLINE'] });
  });

  it('keeps MANAGED where the backend counts no connectivity, so managed devices can still be picked', () => {
    const noConnectivity = getDeviceFilterColumns({ ...FACETS, connectivity: undefined }, { statusDisplay: 'legacy' });
    expect(noConnectivity.find(column => column.key === 'status')?.filterOptions?.map(option => option.label)).toEqual([
      'MANAGED',
      'PENDING',
      'PENDING DELETION',
    ]);
  });

  it('is the lifecycle STATUS and its Connectivity group by default', () => {
    const lifecycle = getDeviceFilterColumns(FACETS);
    expect(lifecycle.find(column => column.key === 'status')?.filterOptions?.map(option => option.label)).toEqual([
      'MANAGED',
      'PENDING',
      'PENDING DELETION',
    ]);
    expect(lifecycle.some(column => column.key === 'connectivity')).toBe(true);
  });
});

describe('deviceStatusFilterGroups', () => {
  it('keeps Connectivity a group of its own in the lifecycle display', () => {
    expect(deviceStatusFilterGroups(['PENDING'], ['ONLINE'], 'lifecycle')).toEqual({
      status: ['PENDING'],
      connectivity: ['ONLINE'],
    });
  });

  it('puts the Connectivity picks inside STATUS in the legacy display', () => {
    const groups = deviceStatusFilterGroups(['PENDING'], ['ONLINE'], 'legacy');
    expect(Object.keys(groups)).toEqual(['status']);
    expect(splitStatusFilterValue(groups.status)).toEqual({ statuses: ['PENDING'], connectivity: ['ONLINE'] });
  });
});

describe('useTagFilterModal in the legacy display', () => {
  it('sends the ONLINE / OFFLINE STATUS picks as connectivity', () => {
    const columns = getDeviceFilterColumns(FACETS, { statusDisplay: 'legacy' });
    const status = columns.find(column => column.key === 'status')?.filterOptions ?? [];
    const online = status.find(option => option.label === 'ONLINE')?.value ?? '';
    const setParams = vi.fn();
    const { result } = renderHook(
      () => useTagFilterModal({ tags: [], deviceFilters: FACETS, columns, setParams, onApplied: () => {} }),
      { wrapper: legacy },
    );
    act(() => {
      result.current.handleFilterChange({ status: [online, 'PENDING'] });
      result.current.handleTagsChange([]);
    });
    expect(setParams.mock.calls[0][0]).toMatchObject({ statuses: ['PENDING'], connectivity: ['ONLINE'] });
  });

  it('clears connectivity when no ONLINE / OFFLINE pick is left', () => {
    const columns = getDeviceFilterColumns(FACETS, { statusDisplay: 'legacy' });
    const setParams = vi.fn();
    const { result } = renderHook(
      () => useTagFilterModal({ tags: [], deviceFilters: FACETS, columns, setParams, onApplied: () => {} }),
      { wrapper: legacy },
    );
    act(() => {
      result.current.handleFilterChange({});
      result.current.handleTagsChange([]);
    });
    expect(setParams.mock.calls[0][0]).toMatchObject({ statuses: [], connectivity: [] });
  });
});

describe('an outdated client (clientOutdated)', () => {
  it('reads OUTDATED in place of the status tag in either display', () => {
    expect(deviceLifecycleTagProps('MANAGED', { connectivity: 'ONLINE', clientOutdated: true })).toEqual({
      label: 'OUTDATED',
      variant: 'warning',
    });
    expect(
      deviceLifecycleTagProps('MANAGED', { connectivity: 'ONLINE', display: 'legacy', clientOutdated: true }),
    ).toEqual({ label: 'OUTDATED', variant: 'warning' });
    expect(deviceLifecycleTagProps('MANAGED', { connectivity: 'ONLINE', clientOutdated: false }).label).toBe('MANAGED');
  });

  it('draws OUTDATED on the tag in the legacy display', () => {
    render(<DeviceLifecycleTag status="MANAGED" connectivity="ONLINE" clientOutdated />, { wrapper: legacy });
    expect(screen.getByText('OUTDATED')).toBeInTheDocument();
    expect(screen.queryByText('ONLINE')).not.toBeInTheDocument();
  });

  it('offers OUTDATED in STATUS, counted by its own facet, in either display', () => {
    const facets: DeviceFilters = {
      ...FACETS,
      clientOutdated: [
        { value: 'true', count: 2 },
        { value: 'false', count: 4 },
      ],
    };
    for (const statusDisplay of ['lifecycle', 'legacy'] as const) {
      const status = getDeviceFilterColumns(facets, { statusDisplay }).find(column => column.key === 'status');
      expect(status?.filterOptions?.find(option => option.value === 'OUTDATED')).toMatchObject({
        label: 'OUTDATED',
        count: 2,
      });
    }
  });
});

describe('a row that does not carry connectivity, in the legacy display', () => {
  it('reads its own status on the grid card, not OFFLINE', () => {
    // A host whose rows have no connectivity field (a phase-1 backend): the legacy tag falls back to the status.
    render(
      <DevicesGrid
        devices={[{ id: 'd-1', machineId: 'm-1', hostname: 'host-1', nickname: null, status: 'ONLINE' }]}
        isLoading={false}
      />,
      {
        wrapper: legacy,
      },
    );
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
    expect(screen.queryByText('OFFLINE')).not.toBeInTheDocument();
  });
});
