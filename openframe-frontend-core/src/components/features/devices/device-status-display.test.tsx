import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DeviceConnectivityIcon } from './device-connectivity-icon';
import { DeviceLifecycleTag, deviceLifecycleTagProps } from './device-lifecycle-tag';
import { getLegacyDeviceStatusConfig } from './device-status';
import { DeviceStatusDisplayProvider } from './device-status-display';
import { deviceStatusFilterGroups, splitStatusFilterValue } from './device-statuses';
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
