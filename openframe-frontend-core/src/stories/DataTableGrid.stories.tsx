/**
 * DataTable, grid layout — `<DataTable layout="grid">`.
 *
 * One bordered block of 48px rows with column dividers. The selection column and the first data column are pinned
 * left, the action columns pinned right, the rest scrolls sideways with a gradient on each edge that has more content.
 * Below `md` the same table draws card rows.
 *
 * What a table needs before it switches from cards (column sizes, one-line cells, action columns, a storage key):
 * `docs/DATA_TABLE_GRID.md`.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useMemo, useState } from 'react';
import { ExternalLinkIcon, Ellipsis01Icon, MonitorIcon } from '../components/icons-v2-generated';
import {
  actionColumn,
  DataTable,
  multiSelectFilterFn,
  selectionColumn,
  useDataTable,
  type ColumnDef,
  type ColumnFiltersState,
  type DataTableSortState,
  type RowSelectionState,
} from '../components/ui/data-table';
import { Tag } from '../components/ui/tag';
import Link from '../embed-shims/next-link';

/* ───────────────────────────── sample data ───────────────────────────── */

interface Device {
  id: string;
  name: string;
  online: boolean;
  lastSeen: string;
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

function makeDevices(count: number): Device[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `device-${index}`,
    name: index % 3 === 0 ? `Romans-MacBook-Pro-${index}.local` : `srv-db-prod-${String(index).padStart(3, '0')}`,
    online: index % 4 !== 2,
    lastSeen: `${(index % 5) + 1} hours ago`,
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
}: {
  selectable: boolean;
  wide: boolean;
  actions: boolean;
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
}: GridDemoProps) {
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [data] = useState(() => makeDevices(rowCount));
  const columns = useMemo(() => deviceColumns({ selectable, wide, actions }), [selectable, wide, actions]);
  const [sort, setSort] = useState<DataTableSortState | null>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const sorted = useMemo(() => {
    if (!sort) return data;
    const direction = sort.desc ? -1 : 1;
    return [...data].sort((a, b) => a.name.localeCompare(b.name) * direction);
  }, [data, sort]);

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
      <DataTable.Body<Device> loading={loading} skeletonRows={6} rowHref={device => `#${device.id}`} />
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
