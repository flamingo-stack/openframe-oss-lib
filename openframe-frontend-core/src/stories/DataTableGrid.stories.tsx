/**
 * DataTable, grid layout — `<DataTable layout="grid">`.
 *
 * One bordered block of 48px rows with column dividers, at every width. The action columns are pinned right; the
 * selection column and the first data column are pinned left on a desktop with at least 720px of content, and scroll
 * with the rest on a tablet, a phone and in a narrower content column. The rest scrolls sideways with a gradient on each edge that has more content.
 *
 * What a table needs before it switches from cards (column sizes, one-line cells, action columns, a storage key):
 * `docs/DATA_TABLE_GRID.md`.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useMemo, useState } from 'react';
import { ExternalLinkIcon, Ellipsis01Icon, MonitorIcon } from '../components/icons-v2-generated';
import { Button } from '../components/ui/button';
import {
  actionColumn,
  DataTable,
  multiSelectFilterFn,
  selectionColumn,
  useDataTable,
  type ColumnDef,
  type ColumnFiltersState,
  type DataTableDateFilter,
  type DataTableSortState,
  type RowSelectionState,
} from '../components/ui/data-table';
import type { DateRange } from '../components/ui/date-picker';
import { Tag } from '../components/ui/tag';
import Link from '../embed-shims/next-link';

/* ───────────────────────────── sample data ───────────────────────────── */

interface Device {
  id: string;
  name: string;
  online: boolean;
  lastSeen: string;
  enrolled: Date;
  customer: string;
  model: string;
  serial: string;
  user: string;
  os: string;
  tags: string[];
}

const CUSTOMERS = ['TechFlow Solutions', 'MedCare Clinic', 'Green Valley Manufacturing', 'Urban Design Studio'];
const MODELS = ['Dell OptiPlex 7090', 'VMware Virtual Platform', 'HP EliteDesk 800 G6', 'HPE ProLiant DL380 Gen10'];
const SYSTEMS = ['Windows 11', 'Ubuntu 24.04', 'macOS 15'];
const TAGS = ['production', 'edge', 'gpu', 'pci'];

function pick(pool: string[], index: number): string {
  return pool[index % pool.length] ?? '';
}

/** The newest enrolment of the sample; each device after it enrolled a day earlier. */
const LAST_ENROLMENT = new Date(2026, 10, 18);

function daysBefore(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - days);
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Whether a day is inside a picked range, both ends included; a range with one end is that day alone. */
function inRange(day: Date, range: DateRange | undefined): boolean {
  if (!range?.from) return true;
  const from = range.from.getTime();
  const to = (range.to ?? range.from).getTime();
  return day.getTime() >= from && day.getTime() <= to;
}

function makeDevices(count: number): Device[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `device-${index}`,
    name: index % 3 === 0 ? `Romans-MacBook-Pro-${index}.local` : `srv-db-prod-${String(index).padStart(3, '0')}`,
    online: index % 4 !== 2,
    lastSeen: `${(index % 5) + 1} hours ago`,
    enrolled: daysBefore(LAST_ENROLMENT, index),
    customer: pick(CUSTOMERS, index),
    model: pick(MODELS, index),
    serial: `C02X${String(1000 + index)}JG5H`,
    user: `user.${index}@example.com`,
    os: pick(SYSTEMS, index),
    tags: TAGS.slice(0, (index % TAGS.length) + 1),
  }));
}

const STATUS_OPTIONS = [
  { id: 'online', label: 'Online', value: 'online' },
  { id: 'offline', label: 'Offline', value: 'offline' },
];
const OS_OPTIONS = SYSTEMS.map(system => ({ id: system, label: system, value: system }));

/* ───────────────────────────── columns ───────────────────────────── */

function deviceColumns({
  selectable,
  wide,
  actions,
  dateFilter,
}: {
  selectable: boolean;
  wide: boolean;
  actions: boolean;
  /** The "Enrolled" date column and its applied sort and range. */
  dateFilter?: DataTableDateFilter;
}): ColumnDef<Device>[] {
  const columns: ColumnDef<Device>[] = [
    {
      id: 'name',
      accessorKey: 'name',
      header: 'Device',
      size: 280,
      meta: {
        sortable: true,
        gridCell: ({ row }) => (
          <DataTable.Cell leading={{ type: 'icon', icon: <MonitorIcon size={20} /> }} text={row.original.name} />
        ),
      },
    },
    {
      id: 'status',
      accessorFn: device => (device.online ? 'online' : 'offline'),
      header: 'Status',
      size: 200,
      filterFn: multiSelectFilterFn,
      // Card form (below md): the status tag alone.
      cell: ({ row }) => (
        <Tag label={row.original.online ? 'Online' : 'Offline'} variant={row.original.online ? 'success' : 'error'} />
      ),
      meta: {
        width: 'w-auto shrink-0',
        filter: { options: STATUS_OPTIONS },
        gridCell: ({ row }) => (
          <DataTable.Cell
            tag={
              <Tag
                label={row.original.online ? 'Online' : 'Offline'}
                variant={row.original.online ? 'success' : 'error'}
              />
            }
            secondary={row.original.online ? undefined : row.original.lastSeen}
          />
        ),
      },
    },
    {
      id: 'customer',
      accessorKey: 'customer',
      header: 'Customer',
      size: 280,
      meta: {
        hideAt: 'lg',
        gridCell: ({ row }) => (
          <DataTable.Cell leading={{ type: 'image', alt: row.original.customer }} text={row.original.customer} />
        ),
      },
    },
    { id: 'model', accessorKey: 'model', header: 'Details', size: 240, meta: { hideAt: 'lg' } },
  ];
  if (dateFilter) {
    columns.splice(1, 0, {
      id: 'enrolled',
      accessorFn: device => formatDay(device.enrolled),
      header: 'Enrolled',
      size: 200,
      meta: { dateFilter },
    });
  }
  if (wide) {
    columns.push(
      { id: 'serial', accessorKey: 'serial', header: 'Serial', size: 200, meta: { hideAt: 'lg' } },
      { id: 'user', accessorKey: 'user', header: 'Logged-in user', size: 240, meta: { hideAt: 'lg' } },
      {
        id: 'os',
        accessorKey: 'os',
        header: 'OS',
        size: 160,
        filterFn: multiSelectFilterFn,
        meta: { hideAt: 'lg', filter: { options: OS_OPTIONS, placement: 'bottom-end' } },
      },
      {
        id: 'tags',
        header: 'Tags',
        size: 200,
        meta: {
          hideAt: 'lg',
          gridCell: ({ row }) => (
            <DataTable.Cell
              tag={<Tag label={row.original.tags[0] ?? ''} variant="grey" />}
              moreTags={row.original.tags.slice(1)}
            />
          ),
        },
      },
    );
  }
  if (actions) columns.push(...actionColumns());
  return selectable ? [selectionColumn<Device>(), ...columns] : columns;
}

function actionColumns(): ColumnDef<Device>[] {
  return [
    actionColumn<Device>({
      id: 'more',
      cell: () => (
        <button type="button" aria-label="More actions" className="flex size-10 items-center justify-center rounded-md">
          <Ellipsis01Icon size={20} className="text-ods-text-primary" />
        </button>
      ),
    }),
    actionColumn<Device>({
      id: 'open',
      cell: ({ row }) => (
        <Link
          href={`#${row.original.id}`}
          target="_blank"
          aria-label="Open in a new tab"
          className="flex size-10 items-center justify-center rounded-md"
        >
          <ExternalLinkIcon size={20} className="text-ods-text-primary" />
        </Link>
      ),
    }),
  ];
}

/**
 * What a host draws under a row (`renderSubRow`): two controls and a line far longer than any screen, as an approval
 * request's command is.
 */
function DeviceSubRow({ device }: { device: Device }) {
  const command = [
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command',
    `"Get-ChildItem -Path C:\\ProgramData\\OpenFrame\\logs\\${device.serial} -Recurse`,
    '| Where-Object LastWriteTime -lt (Get-Date).AddDays(-30) | Remove-Item -Force"',
    // One word wider than a phone: it breaks instead of widening the table.
    `--working-directory C:\\ProgramData\\OpenFrame\\agents\\${device.id}\\a-path-with-no-space-in-it-that-is-longer-than-a-phone-is-wide`,
  ].join(' ');
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xsf)] p-[var(--spacing-system-sf)]">
      <p className="text-ods-text-secondary text-h6">
        Approval requested by {device.user} to run on {device.name}:
      </p>
      <p className="text-ods-text-primary text-code">{command}</p>
      <div className="flex gap-[var(--spacing-system-xsf)]" data-no-row-click>
        <Button size="small">Approve</Button>
        <Button size="small" variant="outline">
          Reject
        </Button>
      </div>
    </div>
  );
}

/** Every third device has a sub-row. */
function renderDeviceSubRow(device: Device) {
  return Number(device.id.replace('device-', '')) % 3 === 1 ? <DeviceSubRow device={device} /> : null;
}

/* ───────────────────────────── table ───────────────────────────── */

interface GridDemoProps {
  rowCount?: number;
  /** The checkbox column, first and pinned left. Off unless the table has something to do with a selection. */
  selectable?: boolean;
  wide?: boolean;
  loading?: boolean;
  maxHeight?: number | string;
  stickyHeader?: boolean;
  /** The gear and its menu. `storageKey` keeps the layout in the browser. */
  settings?: boolean;
  storageKey?: string;
  /** The row-action columns. Without them a table with settings gets a column of its own for the gear. */
  actions?: boolean;
  /** A date column (`meta.dateFilter`): its header opens the date menu, which sorts and narrows the list. */
  dateColumn?: boolean;
  /** The date column's range as the story opens. */
  initialDateRange?: DateRange;
  /** A block under every third row (`renderSubRow`). */
  subRows?: boolean;
}

function GridDemo({
  rowCount = 12,
  selectable = false,
  wide = true,
  loading = false,
  maxHeight,
  stickyHeader = false,
  settings = false,
  storageKey,
  actions = true,
  dateColumn = false,
  initialDateRange,
  subRows = false,
}: GridDemoProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [data] = useState(() => makeDevices(rowCount));
  const [dateSort, setDateSort] = useState<'asc' | 'desc'>('desc');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const columns = useMemo(
    () =>
      deviceColumns({
        selectable,
        wide,
        actions,
        dateFilter: dateColumn
          ? {
              sortDirection: dateSort,
              range: dateRange,
              onApply: result => {
                setDateSort(result.sort);
                setDateRange(result.range);
              },
            }
          : undefined,
      }),
    [selectable, wide, actions, dateColumn, dateSort, dateRange],
  );
  const [sort, setSort] = useState<DataTableSortState | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const sorted = useMemo(() => {
    const listed = dateColumn ? data.filter(device => inRange(device.enrolled, dateRange)) : data;
    if (sort) {
      const direction = sort.desc ? -1 : 1;
      return [...listed].sort((a, b) => a.name.localeCompare(b.name) * direction);
    }
    // The sample is newest first, the list's own order.
    return dateColumn && dateSort === 'asc' ? [...listed].reverse() : listed;
  }, [data, sort, dateColumn, dateSort, dateRange]);

  const table = useDataTable<Device>({
    data: loading ? [] : sorted,
    columns,
    getRowId: device => device.id,
    clientSideFiltering: true,
    enableRowSelection: selectable,
    state: { columnFilters, rowSelection },
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
  });

  return (
    <DataTable
      table={table}
      layout="grid"
      maxHeight={maxHeight}
      settings={settings ? { storageKey, autoRefresh: { enabled: autoRefresh, onChange: setAutoRefresh } } : undefined}
    >
      <DataTable.Meta>
        <DataTable.RowCount loading={loading} />
      </DataTable.Meta>
      <DataTable.Header
        stickyHeader={stickyHeader}
        sort={sort}
        onSortChange={id =>
          setSort(current => (current?.id === id ? { id, desc: !current.desc } : { id, desc: false }))
        }
      />
      <DataTable.Body<Device>
        loading={loading}
        skeletonRows={6}
        rowHref={device => `#${device.id}`}
        renderSubRow={subRows ? renderDeviceSubRow : undefined}
      />
    </DataTable>
  );
}

const meta = {
  title: 'UI/DataTable/Grid',
  component: GridDemo,
  parameters: { layout: 'padded' },
  decorators: [
    Story => (
      <div className="bg-ods-bg p-[var(--spacing-system-lf)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GridDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Sort, filters, pinned columns and horizontal scroll; the page scrolls vertically. */
export const Basic: Story = {};

/** With a checkbox column: it is the first column and stays in place, with the first data column, on horizontal scroll. */
export const Selection: Story = { args: { selectable: true } };

/** Columns narrower than the table: the last data column takes the free width, up to the action columns. */
export const FewColumns: Story = { args: { wide: false, rowCount: 5 } };

/** A long list on a scrolling page: the header sticks to the top and stays aligned with the body. */
export const StickyHeader: Story = { args: { rowCount: 80, stickyHeader: true } };

/** A stated height: the table is its own viewport, the header row sticky inside it, a gradient on every edge. */
export const FixedHeight: Story = { args: { rowCount: 40, maxHeight: 360 } };

/**
 * The table takes the height the page leaves under it and scrolls inside itself. Drag a header's right edge to resize
 * its column (double-click to fit its content, arrow keys while the handle is focused).
 */
export const FillHeight: Story = { args: { rowCount: 80, maxHeight: 'fill' } };

/** Rows still being read: 48px grid rows with one bar per data cell. */
export const Loading: Story = { args: { loading: true } };

/** No rows: the empty state inside the bordered block, under the header. */
export const Empty: Story = { args: { rowCount: 0 } };

/**
 * The gear in the header of the last column opens the settings menu: auto-refresh, the shown columns (click to hide,
 * drag by the dragger or Alt + Arrow to reorder), the hidden columns (click to show). The layout, resized widths
 * included, is kept in the browser under the table's `storageKey` and is there again after a reload.
 */
export const Settings: Story = { args: { settings: true, storageKey: 'storybook-grid-settings' } };

/** A table with settings and no row actions: the gear gets a column of its own. */
export const SettingsWithoutActions: Story = { args: { settings: true, actions: false, wide: false, rowCount: 5 } };

/**
 * A date column (`meta.dateFilter`): the header is the label and a calendar, and opens the date menu. Pick a direction
 * or a range and Apply: the label turns primary and the calendar takes the accent, as an applied filter's funnel does.
 */
export const DateColumn: Story = { args: { dateColumn: true, rowCount: 30 } };

/** The date column with a range applied. */
export const DateColumnApplied: Story = {
  args: {
    dateColumn: true,
    rowCount: 30,
    initialDateRange: { from: daysBefore(LAST_ENROLMENT, 9), to: daysBefore(LAST_ENROLMENT, 3) },
  },
};

/**
 * A block under a row (`renderSubRow`). It is as wide as the visible table: its long line wraps and adds nothing to
 * the table's scroll width, and while the columns scroll sideways it stays where it is.
 */
export const SubRow: Story = { args: { subRows: true, rowCount: 8 } };

/**
 * The same table on a 375px phone: the columns are far wider than the screen, the sub-row is one screen wide. Scroll
 * the table sideways: the cells move, the sub-row and its buttons stay in view.
 */
export const SubRowPhone: Story = {
  ...SubRow,
  parameters: {
    viewport: { options: { phone375: { name: 'Phone 375', styles: { width: '375px', height: '812px' } } } },
  },
  globals: { viewport: { value: 'phone375', isRotated: false } },
};

/** Sub-rows in a table of a stated height: they pass under the sticky header and under the top and bottom shades. */
export const SubRowFixedHeight: Story = { args: { subRows: true, rowCount: 20, maxHeight: 420 } };
