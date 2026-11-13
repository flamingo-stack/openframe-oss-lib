import { describe, expect, it } from 'vitest';
import { getDeviceConnectivityConfig, getDeviceLifecycleConfig } from './device-status';
import {
  expandDeviceStatuses,
  isDeviceConnected,
  isManagedStatus,
  joinStatusFilterValue,
  mergeStatusFacets,
  splitStatusFilterValue,
  toUiDeviceStatus,
} from './device-statuses';

describe('expandDeviceStatuses', () => {
  it('sends MANAGED with the legacy ONLINE / OFFLINE when the backend knows MANAGED', () => {
    expect(expandDeviceStatuses(['MANAGED', 'PENDING_DELETION'], true)).toEqual([
      'MANAGED',
      'ONLINE',
      'OFFLINE',
      'PENDING_DELETION',
    ]);
  });

  it('never sends MANAGED to a backend without it', () => {
    expect(expandDeviceStatuses(['MANAGED', 'PENDING'], false)).toEqual(['ONLINE', 'OFFLINE', 'PENDING']);
  });

  it('drops duplicates and keeps other statuses as they are', () => {
    expect(expandDeviceStatuses(['ONLINE', 'MANAGED', 'DELETED'], false)).toEqual(['ONLINE', 'OFFLINE', 'DELETED']);
  });
});

describe('managed status', () => {
  it('reads MANAGED, ONLINE and OFFLINE as managed, in any case', () => {
    expect(['MANAGED', 'online', 'OFFLINE'].every(isManagedStatus)).toBe(true);
    expect(isManagedStatus('PENDING')).toBe(false);
    expect(isManagedStatus(null)).toBe(false);
  });

  it('maps the legacy statuses to the UI value MANAGED', () => {
    expect(toUiDeviceStatus('ONLINE')).toBe('MANAGED');
    expect(toUiDeviceStatus('PENDING_DELETION')).toBe('PENDING_DELETION');
  });

  it('sums the MANAGED, ONLINE and OFFLINE facet rows into one', () => {
    expect(
      mergeStatusFacets([
        { value: 'ONLINE', count: 3 },
        { value: 'PENDING', count: 1 },
        { value: 'OFFLINE', count: 2 },
        { value: 'MANAGED', count: 5 },
      ]),
    ).toEqual([
      { value: 'MANAGED', count: 10 },
      { value: 'PENDING', count: 1 },
    ]);
  });
});

describe('connectivity', () => {
  it('is online only for ONLINE; null reads as offline', () => {
    expect(isDeviceConnected('ONLINE')).toBe(true);
    expect(isDeviceConnected('OFFLINE')).toBe(false);
    expect(isDeviceConnected(null)).toBe(false);
    expect(getDeviceConnectivityConfig(undefined)).toEqual({ online: false, label: 'Offline' });
    expect(getDeviceConnectivityConfig('online')).toEqual({ online: true, label: 'Online' });
  });

  it('round-trips through the STATUS column filter value', () => {
    const value = joinStatusFilterValue(['MANAGED'], ['ONLINE']);
    expect(value).toEqual(['MANAGED', 'connectivity:ONLINE']);
    expect(splitStatusFilterValue(value)).toEqual({ statuses: ['MANAGED'], connectivity: ['ONLINE'] });
    expect(splitStatusFilterValue(undefined)).toEqual({ statuses: [], connectivity: [] });
  });
});

describe('getDeviceLifecycleConfig', () => {
  it.each([
    ['MANAGED', 'MANAGED', 'success'],
    ['ONLINE', 'MANAGED', 'success'],
    ['OFFLINE', 'MANAGED', 'success'],
    ['PENDING', 'PENDING', 'warning'],
    ['PENDING_DELETION', 'PENDING DELETION', 'error'],
    ['DELETED', 'DELETED', 'grey'],
    ['ARCHIVED', 'ARCHIVED', 'grey'],
  ])('%s reads %s (%s)', (status, label, variant) => {
    const config = getDeviceLifecycleConfig(status);
    expect(config.label).toBe(label);
    expect(config.variant).toBe(variant);
  });

  it('never crashes on a missing status', () => {
    expect(getDeviceLifecycleConfig(undefined)).toEqual({ label: '', variant: 'grey' });
  });
});
