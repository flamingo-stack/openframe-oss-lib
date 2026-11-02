import { describe, expect, it } from 'vitest';
import type { NavigationSidebarItem } from '../../../types/navigation';
import { parseNavigationLocation, resolveNavigationActive } from '../navigation-sidebar-match';

const icon = null;

/** The Automation / Inventory / Monitor groups as the app will configure them. */
const TREE: NavigationSidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon, path: '/dashboard' },
  {
    id: 'inventory',
    label: 'Inventory',
    icon,
    children: [
      { id: 'customers', label: 'Customers', icon, path: '/customers' },
      { id: 'devices', label: 'Devices', icon, path: '/devices' },
      { id: 'software', label: 'Software', icon, path: '/software' },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    icon,
    children: [
      { id: 'scripts', label: 'Scripts', icon, path: '/scripts' },
      { id: 'schedules', label: 'Schedules', icon, path: '/scripts/schedules' },
      {
        id: 'policies',
        label: 'Policies',
        icon,
        path: '/monitoring?tab=policies',
        match: [{ path: '/monitoring', exact: true, query: { tab: 'policies' } }, '/monitoring/policy'],
      },
      {
        id: 'queries',
        label: 'Queries',
        icon,
        path: '/monitoring?tab=queries',
        // The monitoring page opens on its queries tab when there is no `tab`.
        match: [{ path: '/monitoring', exact: true, query: { tab: ['queries', null] } }, '/monitoring/query'],
      },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    icon,
    children: [
      { id: 'vulnerabilities', label: 'Vulnerabilities', icon, path: '/software/vulnerabilities' },
      { id: 'logs', label: 'Logs', icon, path: '/logs-page', match: ['/logs-page', '/log-details'] },
    ],
  },
  { id: 'kb', label: 'Knowledge Base', icon, path: '/knowledge-base', section: 'secondary' },
];

const resolve = (currentPath: string) => resolveNavigationActive(TREE, { currentPath, includeChildren: true });

describe('parseNavigationLocation', () => {
  it('drops the trailing slash, the hash, and keeps the query', () => {
    const location = parseNavigationLocation('/monitoring/?tab=policies#top');
    expect(location.pathname).toBe('/monitoring');
    expect(location.searchParams.get('tab')).toBe('policies');
    expect(parseNavigationLocation('/').pathname).toBe('/');
  });
});

describe('resolveNavigationActive — grouped', () => {
  it.each([
    ['/scripts', 'scripts', 'automation'],
    ['/scripts/details?id=7', 'scripts', 'automation'],
    ['/scripts/schedules', 'schedules', 'automation'],
    ['/scripts/schedules/details/?id=3', 'schedules', 'automation'],
    ['/software', 'software', 'inventory'],
    ['/software/details?id=1', 'software', 'inventory'],
    ['/software/vulnerabilities', 'vulnerabilities', 'monitor'],
    ['/monitoring?tab=policies', 'policies', 'automation'],
    ['/monitoring/policy?id=9', 'policies', 'automation'],
    ['/monitoring?tab=queries', 'queries', 'automation'],
    ['/monitoring', 'queries', 'automation'],
    ['/log-details?id=1', 'logs', 'monitor'],
    ['/devices/details?id=1&tab=hardware', 'devices', 'inventory'],
    ['/dashboard', 'dashboard', null],
    ['/knowledge-base/', 'kb', null],
  ])('%s → %s in %s', (path, activeId, groupId) => {
    expect(resolve(path)).toEqual({ activeId, groupId });
  });

  it('matches by segment, not by string prefix', () => {
    expect(resolve('/scriptsx')).toEqual({ activeId: null, groupId: null });
    expect(resolve('/monitoring?tab=other')).toEqual({ activeId: null, groupId: null });
  });

  it('an explicit isActive wins over every match, and isActive: false vetoes one', () => {
    const items: NavigationSidebarItem[] = [
      {
        id: 'automation',
        label: 'Automation',
        icon,
        children: [
          { id: 'scripts', label: 'Scripts', icon, path: '/scripts', isActive: false },
          { id: 'schedules', label: 'Schedules', icon, path: '/scripts/schedules' },
          { id: 'policies', label: 'Policies', icon, path: '/monitoring', isActive: true },
        ],
      },
    ];
    expect(resolveNavigationActive(items, { currentPath: '/scripts', includeChildren: true }).activeId).toBe(
      'policies',
    );
  });

  it('a parent marked active beside its active child yields to the child', () => {
    const items: NavigationSidebarItem[] = [
      {
        id: 'inventory',
        label: 'Inventory',
        icon,
        isActive: true,
        children: [{ id: 'devices', label: 'Devices', icon, isActive: true }],
      },
    ];
    expect(resolveNavigationActive(items, { includeChildren: true })).toEqual({
      activeId: 'devices',
      groupId: 'inventory',
    });
  });

  it('a parent that matches itself and no child opens its group without an active child', () => {
    const items: NavigationSidebarItem[] = [
      {
        id: 'monitor',
        label: 'Monitor',
        icon,
        match: '/insights',
        children: [{ id: 'incidents', label: 'Incidents', icon, path: '/insights/incidents' }],
      },
    ];
    expect(resolveNavigationActive(items, { currentPath: '/insights', includeChildren: true })).toEqual({
      activeId: 'monitor',
      groupId: 'monitor',
    });
  });

  it('a match function is the host deciding outright', () => {
    const items: NavigationSidebarItem[] = [
      { id: 'a', label: 'A', icon, path: '/a/b/c' },
      { id: 'b', label: 'B', icon, match: ({ searchParams }) => searchParams.get('mode') === 'b' },
    ];
    expect(resolveNavigationActive(items, { currentPath: '/a/b/c?mode=b' }).activeId).toBe('b');
  });
});

describe('resolveNavigationActive — flat', () => {
  it('is `items.find(isActive)` when the host sets isActive', () => {
    const items: NavigationSidebarItem[] = [
      { id: 'a', label: 'A', icon, isActive: false },
      { id: 'b', label: 'B', icon, isActive: true },
      { id: 'c', label: 'C', icon, isActive: true },
    ];
    expect(resolveNavigationActive(items)).toEqual({ activeId: 'b', groupId: null });
  });

  it('never resolves to a child, and matches nothing without isActive or currentPath', () => {
    expect(resolveNavigationActive(TREE)).toEqual({ activeId: null, groupId: null });
    expect(resolveNavigationActive(TREE, { currentPath: '/scripts' })).toEqual({ activeId: null, groupId: null });
    expect(resolveNavigationActive(TREE, { currentPath: '/dashboard' }).activeId).toBe('dashboard');
  });
});
