import type { ReactElement } from 'react';
import type { SingleCustomerTenantsTableViewProps } from './cloud-tenants/single-customer-tenants-table-view';
import { SingleCustomerTenantsTableView } from './cloud-tenants/single-customer-tenants-table-view';
import type { MultiCustomerTenantRow, TenantRow } from './cloud-tenants/tenant-row';
import { TenantsTableView, type TenantsTableViewProps } from './cloud-tenants/tenants-table-view';
import { DeviceSelector } from './devices/device-selector/device-selector';
import type { DeviceSelectorProps } from './devices/device-selector/device-selector.types';
import type { DeviceRow } from './devices/types';
import {
  KnowledgeBaseTableBody,
  type KnowledgeBaseRow,
  type KnowledgeBaseTableBodyProps,
} from './knowledge-base/knowledge-base-table';
import { LogsTableView, type LogsTableViewProps } from './logs/logs-table-view';
import type { UiLogEntry } from './logs/types';
import { PoliciesTable, type PoliciesTableProps } from './policies/policies-table';
import type { PolicyTableRow } from './policies/policy-table-row';
import {
  ScriptExecutionsTable,
  type ScriptExecutionTableRow,
  type ScriptExecutionsTableProps,
} from './scripts/script-executions-table';
import {
  ScriptSchedulesTable,
  type ScriptScheduleTableRow,
  type ScriptSchedulesTableProps,
} from './scripts/script-schedules-table';
import { ScriptsTable, type ScriptTableRow, type ScriptsTableProps } from './scripts/scripts-table';

/**
 * One fixture per feature table that draws a `DataTable`: the props of a loaded table, of a loading one and of an
 * empty one. Shared by the tests that lock the tables' card markup and the ones that cover their grid layout, so both
 * render the same tables.
 *
 * Nothing here depends on the clock or the time zone: no date a cell would format, a fixed `now` where a table takes
 * one.
 */

/** jsdom has no `IntersectionObserver` and the infinite footer makes one: a sentinel that never comes into view. */
export class IdleIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

/** How many rows a loading fixture table draws. */
const FIXTURE_SKELETON_ROWS = 2;

const NOW = new Date('2026-11-11T12:00:00Z');
const noop = () => {};

const POLICIES: PolicyTableRow[] = [
  {
    id: 'p-1',
    name: 'Disk encryption enabled',
    description: 'FileVault or BitLocker is on',
    critical: true,
    severityLabel: 'Critical',
    status: { label: 'Failing', variant: 'error', note: { text: '3 devices', tone: 'error' } },
    platforms: ['windows', 'darwin'],
    href: '/policies/p-1',
  },
  {
    id: 'p-2',
    name: 'Firewall enabled',
    critical: false,
    severityLabel: 'Low',
    status: { label: 'Passing', variant: 'success' },
    platforms: [],
    href: '/policies/p-2',
  },
];

const SCRIPTS: ScriptTableRow[] = [
  {
    id: 's-1',
    name: 'Restart print spooler',
    description: 'Stops and starts the spooler service',
    shellType: 'powershell',
    supportedPlatforms: ['windows'],
    author: { name: 'Maya Chen', initials: 'MC' },
    href: '/scripts/s-1',
  },
  {
    id: 's-2',
    name: 'Clear temp files',
    shellType: 'bash',
    supportedPlatforms: ['darwin', 'linux'],
    author: null,
    href: '/scripts/s-2',
  },
];

const SCHEDULES: ScriptScheduleTableRow[] = [
  {
    id: 'sch-1',
    name: 'Nightly cleanup',
    description: 'Clears temp files',
    supportedPlatforms: ['windows', 'linux'],
    startsAt: { date: '12 Nov 2026', time: '02:00' },
    repeat: 'Every day',
    deviceCount: 14,
    href: '/schedules/sch-1',
  },
  {
    id: 'sch-2',
    name: 'On connect inventory',
    supportedPlatforms: ['darwin'],
    startsAt: null,
    trigger: 'Device Online',
    repeat: null,
    deviceCount: 0,
    href: '/schedules/sch-2',
  },
];

const EXECUTIONS: ScriptExecutionTableRow[] = [
  {
    id: 'e-1',
    executionId: 'EX-1001',
    timestamp: '11 Nov 2026, 10:15',
    status: 'SUCCESS',
    machineName: 'reception-01',
    organization: 'Acme Logistics',
    initiator: { name: 'Maya Chen', initials: 'MC' },
    source: 'MANUAL',
    scriptName: 'Restart print spooler',
    result: 'Service restarted',
    href: '/executions/e-1',
  },
  {
    id: 'e-2',
    executionId: 'EX-1002',
    timestamp: '11 Nov 2026, 10:20',
    status: 'FAILED',
    machineName: 'maya-mba',
    initiator: { name: 'Fae', initials: 'F' },
    source: 'AI_ASSISTANT',
    href: '/executions/e-2',
  },
];

const KNOWLEDGE_BASE_ITEMS: KnowledgeBaseRow[] = [
  { id: 'k-1', type: 'FOLDER', name: 'Onboarding' },
  {
    id: 'k-2',
    type: 'ARTICLE',
    name: 'Reset a password',
    status: 'DRAFT',
    summary: 'How a technician resets a password',
    tags: [{ id: 't-1', key: 'identity' }],
  },
];

const LOGS: UiLogEntry[] = [
  {
    id: 'l-1',
    logId: 'LOG-1',
    timestamp: '11 Nov 2026, 10:15',
    status: { label: 'Info', variant: 'grey' },
    source: { name: 'Fleet', toolType: 'FLEET' },
    device: { name: 'reception-01', organization: 'Acme Logistics' },
    description: { title: 'Policy applied', details: 'Disk encryption enabled' },
  },
  {
    id: 'l-2',
    logId: 'LOG-2',
    timestamp: '11 Nov 2026, 10:20',
    status: { label: 'Error', variant: 'error' },
    source: { name: 'Tactical', toolType: 'TACTICAL' },
    device: { name: 'maya-mba' },
    description: { title: 'Script failed' },
  },
];

const MULTI_CUSTOMER_TENANTS: MultiCustomerTenantRow[] = [
  {
    id: 't-1',
    name: 'Acme',
    provider: 'MICROSOFT_365',
    domain: 'acme.example',
    customers: [{ name: 'Acme Logistics' }, { name: 'Acme Retail' }],
    userCount: 227,
    unattributedUserCount: 4,
    licenses: { assigned: 200, purchased: 250, unused: 50 },
    accessState: 'WRITE_ENABLED',
  },
  { id: 't-2', name: 'Globex', provider: 'GOOGLE_WORKSPACE', customers: [], accessState: 'DISCONNECTED' },
];

const SINGLE_CUSTOMER_TENANTS: TenantRow[] = [
  {
    id: 't-1',
    name: 'Acme',
    provider: 'MICROSOFT_365',
    domain: 'acme.example',
    customer: { name: 'Acme Logistics' },
    userCount: 227,
    accessState: 'WRITE_ENABLED',
  },
  {
    id: 't-2',
    name: 'Globex',
    provider: 'GOOGLE_WORKSPACE',
    customer: { name: 'Globex' },
    accessState: 'DISCONNECTED',
  },
];

const DEVICES: DeviceRow[] = [
  {
    id: 'd-1',
    machineId: 'm-1',
    status: 'MANAGED',
    connectivity: 'ONLINE',
    hostname: 'reception-01',
    nickname: null,
    type: 'desktop',
  },
  {
    id: 'd-2',
    machineId: 'm-2',
    status: 'MANAGED',
    connectivity: 'OFFLINE',
    hostname: 'maya-mba',
    nickname: null,
    type: 'laptop',
  },
];

const tenantHref = (row: { id: string }) => `/tenants/${row.id}`;
const knowledgeBaseHref = (item: KnowledgeBaseRow) => `/knowledge-base/${item.id}`;
const logHref = (log: UiLogEntry) => `/logs/${log.id}`;

export const POLICIES_TABLE = {
  loaded: {
    rows: POLICIES,
    showPlatform: true,
    rowAsLink: true,
    stickyHeader: true,
    stickyHeaderOffset: 'top-[56px]',
    rightSlot: <span>2 policies</span>,
  },
  loading: { rows: [], isLoading: true, skeletonRows: FIXTURE_SKELETON_ROWS, rightSlot: <span>2 policies</span> },
  empty: { rows: [], emptyMessage: 'No policies found.' },
} satisfies Record<string, PoliciesTableProps>;

export const SCRIPTS_TABLE = {
  loaded: { rows: SCRIPTS, stickyHeader: true, stickyHeaderOffset: 'top-[56px]', rightSlot: <span>2 scripts</span> },
  loading: { rows: [], isLoading: true, skeletonRows: FIXTURE_SKELETON_ROWS, rightSlot: <span>2 scripts</span> },
  empty: { rows: [] },
} satisfies Record<string, ScriptsTableProps>;

export const SCRIPT_SCHEDULES_TABLE = {
  loaded: { rows: SCHEDULES, stickyHeader: true, rightSlot: <span>2 schedules</span> },
  loading: { rows: [], isLoading: true, skeletonRows: FIXTURE_SKELETON_ROWS, rightSlot: <span>2 schedules</span> },
  empty: { rows: [] },
} satisfies Record<string, ScriptSchedulesTableProps>;

export const SCRIPT_EXECUTIONS_TABLE = {
  loaded: {
    rows: EXECUTIONS,
    rightSlot: <span>2 executions</span>,
    renderSubRow: row => (row.result ? <pre data-sub-row>{row.result}</pre> : null),
  },
  loading: { rows: [], isLoading: true, skeletonRows: FIXTURE_SKELETON_ROWS, rightSlot: <span>2 executions</span> },
  empty: { rows: [] },
} satisfies Record<string, ScriptExecutionsTableProps>;

export const KNOWLEDGE_BASE_TABLE = {
  loaded: {
    items: KNOWLEDGE_BASE_ITEMS,
    getHref: knowledgeBaseHref,
    totalCount: 2,
    stickyHeaderOffset: 'top-[56px]',
    footerSlot: <div data-footer-slot />,
  },
  loading: { items: [], getHref: knowledgeBaseHref, isLoading: true, skeletonRows: FIXTURE_SKELETON_ROWS },
  empty: { items: [], getHref: knowledgeBaseHref },
} satisfies Record<string, KnowledgeBaseTableBodyProps>;

export const LOGS_TABLE = {
  loaded: {
    logs: LOGS,
    filters: {},
    onFilterChange: noop,
    facets: { severities: ['INFO', 'ERROR'], toolTypes: ['FLEET', 'TACTICAL'], organizations: [] },
    getLogHref: logHref,
    hasNextPage: true,
    onLoadMore: noop,
    pageSize: 2,
  },
  loading: { logs: [], loading: true, filters: {}, onFilterChange: noop, pageSize: 2 },
  // A search that finds nothing: the table keeps its header and says so (no search: the onboarding panel instead).
  empty: { logs: [], filters: {}, onFilterChange: noop, search: 'nothing' },
} satisfies Record<string, LogsTableViewProps>;

export const TENANTS_TABLE = {
  loaded: {
    variant: 'multi-customer',
    rows: MULTI_CUSTOMER_TENANTS,
    getHref: tenantHref,
    totalCount: 2,
    hasNextPage: true,
    onLoadMore: noop,
    stickyHeaderOffset: 'top-[56px]',
    now: NOW,
  },
  empty: { variant: 'multi-customer', rows: [], getHref: tenantHref, search: 'nothing', now: NOW },
} satisfies Record<string, TenantsTableViewProps>;

export const SINGLE_CUSTOMER_TENANTS_TABLE = {
  loaded: {
    rows: SINGLE_CUSTOMER_TENANTS,
    getHref: tenantHref,
    totalCount: 2,
    hasNextPage: true,
    onLoadMore: noop,
    stickyHeaderOffset: 'top-[56px]',
    now: NOW,
  },
  empty: { rows: [], getHref: tenantHref, search: 'nothing', now: NOW },
} satisfies Record<string, SingleCustomerTenantsTableViewProps>;

export const DEVICE_SELECTOR = {
  loaded: { devices: DEVICES, loading: false, showSelectionModeRadio: false, totalCount: 2 },
  loading: { devices: [], loading: true, showSelectionModeRadio: false, skeletonRows: FIXTURE_SKELETON_ROWS },
  empty: { devices: [], loading: false, showSelectionModeRadio: false },
} satisfies Record<string, DeviceSelectorProps>;

/** A feature table in one of its states, as an element: what a markup test renders. */
export interface FeatureTableCase {
  /** `<table>, <state>`: the test's and the snapshot's name. */
  name: string;
  element: ReactElement;
}

/** Every feature table in every state it has a fixture for, in the card layout (no layout prop). */
export const FEATURE_TABLE_CASES: FeatureTableCase[] = [
  ...Object.entries(POLICIES_TABLE).map(([state, props]) => ({
    name: `PoliciesTable, ${state}`,
    element: <PoliciesTable {...props} />,
  })),
  ...Object.entries(SCRIPTS_TABLE).map(([state, props]) => ({
    name: `ScriptsTable, ${state}`,
    element: <ScriptsTable {...props} />,
  })),
  ...Object.entries(SCRIPT_SCHEDULES_TABLE).map(([state, props]) => ({
    name: `ScriptSchedulesTable, ${state}`,
    element: <ScriptSchedulesTable {...props} />,
  })),
  ...Object.entries(SCRIPT_EXECUTIONS_TABLE).map(([state, props]) => ({
    name: `ScriptExecutionsTable, ${state}`,
    element: <ScriptExecutionsTable {...props} />,
  })),
  ...Object.entries(KNOWLEDGE_BASE_TABLE).map(([state, props]) => ({
    name: `KnowledgeBaseTableBody, ${state}`,
    element: <KnowledgeBaseTableBody {...props} />,
  })),
  ...Object.entries(LOGS_TABLE).map(([state, props]) => ({
    name: `LogsTableView, ${state}`,
    element: <LogsTableView {...props} />,
  })),
  ...Object.entries(TENANTS_TABLE).map(([state, props]) => ({
    name: `TenantsTableView (multi-customer), ${state}`,
    element: <TenantsTableView {...props} />,
  })),
  ...Object.entries(SINGLE_CUSTOMER_TENANTS_TABLE).map(([state, props]) => ({
    name: `SingleCustomerTenantsTableView, ${state}`,
    element: <SingleCustomerTenantsTableView {...props} />,
  })),
  ...Object.entries(DEVICE_SELECTOR).map(([state, props]) => ({
    name: `DeviceSelector, ${state}`,
    element: <DeviceSelector {...props} />,
  })),
];
