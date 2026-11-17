import { describe, expect, it } from 'vitest';
import { getDeviceRowStatusConfig, getDeviceStatusConfig } from './device-status';
import { DEVICE_FILTER_OUTDATED } from './device-statuses';
import { getDeviceFilterColumns } from './devices-table-columns';
import type { DeviceFilters } from './types';

describe('getDeviceRowStatusConfig', () => {
  it('shows OUTDATED in place of the status when the server flags the client', () => {
    expect(getDeviceRowStatusConfig({ status: 'ONLINE', clientOutdated: true })).toEqual({
      label: 'OUTDATED',
      variant: 'warning',
      cardStatus: 'warning',
    });
    expect(getDeviceRowStatusConfig({ status: 'OFFLINE', clientOutdated: true }).label).toBe('OUTDATED');
  });

  it('shows the status when the client is supported, unknown or the field is absent', () => {
    expect(getDeviceRowStatusConfig({ status: 'ONLINE', clientOutdated: false })).toEqual(
      getDeviceStatusConfig('ONLINE'),
    );
    expect(getDeviceRowStatusConfig({ status: 'OFFLINE' })).toEqual(getDeviceStatusConfig('OFFLINE'));
  });

  it('labels the OUTDATED filter value like the tag', () => {
    expect(getDeviceStatusConfig(DEVICE_FILTER_OUTDATED).label).toBe('OUTDATED');
  });
});

const facets: DeviceFilters = {
  statuses: [
    { value: 'ONLINE', count: 7 },
    { value: 'OFFLINE', count: 3 },
  ],
  deviceTypes: [],
  osTypes: [],
  organizationIds: [],
  tagKeys: [],
  filteredCount: 10,
};

function statusOptions(filters: DeviceFilters) {
  return getDeviceFilterColumns(filters).find(column => column.key === 'status')?.filterOptions ?? [];
}

describe('Status funnel OUTDATED option', () => {
  it('is offered with the "true" count of the clientOutdated facet, after the statuses', () => {
    const options = statusOptions({
      ...facets,
      clientOutdated: [
        { value: 'true', count: 4 },
        { value: 'false', count: 6 },
      ],
    });
    // The lifecycle display reads the ONLINE / OFFLINE statuses as one MANAGED option (`mergeStatusFacets`).
    expect(options.map(option => option.value)).toEqual(['MANAGED', DEVICE_FILTER_OUTDATED]);
    expect(options[options.length - 1]).toEqual({ id: 'OUTDATED', label: 'OUTDATED', value: 'OUTDATED', count: 4 });
  });

  it('counts 0 when no device is outdated', () => {
    const options = statusOptions({
      ...facets,
      clientOutdated: [
        { value: 'true', count: 0 },
        { value: 'false', count: 10 },
      ],
    });
    expect(options[options.length - 1]?.count).toBe(0);
  });

  it('is not offered when the host does not ask for the facet', () => {
    expect(statusOptions(facets).map(option => option.value)).toEqual(['MANAGED']);
  });
});
