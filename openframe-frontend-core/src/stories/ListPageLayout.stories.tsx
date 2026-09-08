import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LayoutGrid, LayoutList, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ListPageLayout } from '../components/layout/list-page-layout';
import { Button } from '../components/ui/button';
import {
  DataTable,
  useDataTable,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type TableFilters,
} from '../components/ui/data-table';
import type { FilterGroup, SortConfig, SortDirection } from '../components/ui/filter-modal';

interface Device {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'pending';
  type: string;
  lastSeen: string;
}

const sampleDevices: Device[] = [
  { id: '1', name: 'MacBook Pro', status: 'online', type: 'Laptop', lastSeen: '2024-01-20' },
  { id: '2', name: 'iPhone 15', status: 'online', type: 'Mobile', lastSeen: '2024-01-20' },
  { id: '3', name: 'Windows Desktop', status: 'offline', type: 'Desktop', lastSeen: '2024-01-15' },
  { id: '4', name: 'iPad Air', status: 'pending', type: 'Tablet', lastSeen: '2024-01-18' },
  { id: '5', name: 'Linux Server', status: 'online', type: 'Server', lastSeen: '2024-01-20' },
];

// Module-level so `useDataTable` sees stable `columns` references. The filter
// option ids are the device VALUES, the same ids the mobile `FilterModal`
// groups use below, so one `TableFilters` object drives both controls.
const deviceColumns: ColumnDef<Device>[] = [
  { accessorKey: 'name', header: 'Device Name', meta: { width: 'flex-1 min-w-0' } },
  {
    accessorKey: 'type',
    header: 'Type',
    meta: {
      width: 'w-[160px]',
      hideAt: 'lg',
      filter: {
        options: [
          { id: 'Laptop', label: 'Laptop', value: 'Laptop' },
          { id: 'Mobile', label: 'Mobile', value: 'Mobile' },
          { id: 'Desktop', label: 'Desktop', value: 'Desktop' },
          { id: 'Tablet', label: 'Tablet', value: 'Tablet' },
          { id: 'Server', label: 'Server', value: 'Server' },
        ],
      },
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    meta: {
      width: 'w-[140px]',
      filter: {
        options: [
          { id: 'online', label: 'Online', value: 'online' },
          { id: 'offline', label: 'Offline', value: 'offline' },
          { id: 'pending', label: 'Pending', value: 'pending' },
        ],
      },
    },
  },
  { accessorKey: 'lastSeen', header: 'Last Seen', meta: { width: 'w-[160px]' } },
];

const NO_FILTERS: TableFilters = {};

function rowId(row: { id: string }) {
  return row.id;
}

/** `FilterModal` speaks `TableFilters`; the header funnels speak TanStack's `ColumnFiltersState`. */
function toColumnFilters(filters: TableFilters): ColumnFiltersState {
  return Object.entries(filters)
    .filter(([, ids]) => ids.length > 0)
    .map(([id, ids]) => ({ id, value: ids }));
}

function toTableFilters(columnFilters: ColumnFiltersState): TableFilters {
  return Object.fromEntries(columnFilters.map(filter => [filter.id, filter.value as string[]]));
}

/**
 * The page body the stories below show: a `DataTable` over the sample devices.
 * `filters` / `onFiltersChange` mirror the layout's mobile filter into the
 * header funnels (`WithMobileFilter`), so the two controls edit ONE state; the
 * data itself is filtered by the story, the table only stores the selection.
 */
function DevicesTable({
  data,
  emptyMessage,
  filters = NO_FILTERS,
  onFiltersChange,
}: {
  data: Device[];
  emptyMessage?: string;
  filters?: TableFilters;
  onFiltersChange?: (filters: TableFilters) => void;
}) {
  const columnFilters = useMemo(() => toColumnFilters(filters), [filters]);
  const handleColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updater => {
      const next = typeof updater === 'function' ? updater(columnFilters) : updater;
      onFiltersChange?.(toTableFilters(next));
    },
    [columnFilters, onFiltersChange],
  );
  const table = useDataTable<Device>({
    data,
    columns: deviceColumns,
    getRowId: rowId,
    state: { columnFilters },
    onColumnFiltersChange: handleColumnFiltersChange,
  });
  return (
    <DataTable table={table}>
      <DataTable.Header />
      <DataTable.Body emptyState={emptyMessage ? { title: emptyMessage, description: undefined } : undefined} />
    </DataTable>
  );
}

/** Ad-hoc rows for the page examples below: any object with an `id`. */
function SampleTable<T extends { id: string }>({ data, columns }: { data: T[]; columns: ColumnDef<T>[] }) {
  const table = useDataTable<T>({ data, columns, getRowId: rowId });
  return (
    <DataTable table={table}>
      <DataTable.Header />
      <DataTable.Body />
    </DataTable>
  );
}

interface Script {
  id: string;
  name: string;
  language: string;
  lastRun: string;
  status: string;
}

const sampleScripts: Script[] = [
  { id: '1', name: 'Deploy Script', language: 'Bash', lastRun: '2024-01-20', status: 'success' },
  { id: '2', name: 'Backup Database', language: 'Python', lastRun: '2024-01-19', status: 'success' },
  { id: '3', name: 'Clear Cache', language: 'PowerShell', lastRun: '2024-01-18', status: 'failed' },
];

const scriptColumns: ColumnDef<Script>[] = [
  { accessorKey: 'name', header: 'Script Name', meta: { width: 'flex-1 min-w-0' } },
  { accessorKey: 'language', header: 'Language', meta: { width: 'w-[160px]' } },
  { accessorKey: 'lastRun', header: 'Last Run', meta: { width: 'w-[160px]' } },
  { accessorKey: 'status', header: 'Status', meta: { width: 'w-[140px]' } },
];

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  source: string;
}

const sampleLogs: LogEntry[] = [
  {
    id: '1',
    timestamp: '2024-01-20 14:32:01',
    level: 'INFO',
    message: 'User login successful',
    source: 'auth-service',
  },
  {
    id: '2',
    timestamp: '2024-01-20 14:31:45',
    level: 'WARNING',
    message: 'Rate limit approaching',
    source: 'api-gateway',
  },
  {
    id: '3',
    timestamp: '2024-01-20 14:30:22',
    level: 'ERROR',
    message: 'Database connection timeout',
    source: 'db-service',
  },
  {
    id: '4',
    timestamp: '2024-01-20 14:29:10',
    level: 'INFO',
    message: 'Cache cleared successfully',
    source: 'cache-service',
  },
];

const logColumns: ColumnDef<LogEntry>[] = [
  { accessorKey: 'timestamp', header: 'Timestamp', meta: { width: 'w-[200px]' } },
  { accessorKey: 'level', header: 'Level', meta: { width: 'w-[120px]' } },
  { accessorKey: 'message', header: 'Message', meta: { width: 'flex-1 min-w-0' } },
  { accessorKey: 'source', header: 'Source', meta: { width: 'w-[160px]' } },
];

const meta = {
  title: 'Layout/ListPageLayout',
  component: ListPageLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
A standardized layout component for list-based pages throughout the OpenFrame application.

## Layout Structure
\`\`\`
┌─────────────────────────────────────────────────────────────┐
│ Title (left aligned)    │    Header Actions (right aligned) │
├─────────────────────────────────────────────────────────────┤
│                 Search Bar (full width)                     │
├─────────────────────────────────────────────────────────────┤
│                Table/Grid with Filters                      │
│                    (main content)                           │
└─────────────────────────────────────────────────────────────┘
\`\`\`

## Key Features
- **Consistent Spacing**: All pages use identical padding and gaps
- **Responsive Design**: Works seamlessly across all screen sizes
- **Accessibility**: Proper semantic HTML and ARIA support
- **Error Handling**: Built-in error state display
- **Flexible Actions**: Supports any combination of buttons/controls
- **Search Integration**: Standardized search bar positioning
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
      description: 'Container padding size',
    },
    background: {
      control: 'select',
      options: ['default', 'card', 'transparent'],
      description: 'Container background style',
    },
  },
} satisfies Meta<typeof ListPageLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Basic list page layout with a title, search bar, and table content.
 */
export const Basic: Story = {
  args: {
    title: 'The quick brown fox',
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: <DevicesTable data={sampleDevices} />,
  },
};

/**
 * List page with header actions including refresh and add buttons.
 */
export const WithHeaderActions: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <div className="flex gap-2">
        <Button variant="outline" size="small-legacy" leftIcon={<RefreshCw className="h-4 w-4" />}>
          Refresh
        </Button>
        <Button variant="accent" size="small-legacy" leftIcon={<Plus className="h-4 w-4" />}>
          Add Device
        </Button>
      </div>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: <DevicesTable data={sampleDevices} />,
  },
};

/**
 * List page with view toggle actions (table/grid view).
 */
export const WithViewToggle: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <div className="flex gap-2">
        <Button variant="outline" size="small-legacy" leftIcon={<LayoutList className="h-4 w-4" />}>
          List
        </Button>
        <Button variant="transparent" size="small-legacy" leftIcon={<LayoutGrid className="h-4 w-4" />}>
          Grid
        </Button>
        <Button variant="accent" size="small-legacy" leftIcon={<Plus className="h-4 w-4" />}>
          New
        </Button>
      </div>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: <DevicesTable data={sampleDevices} />,
  },
};

/**
 * List page displaying an error state.
 */
export const WithError: Story = {
  args: {
    title: 'Devices',
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    error: 'Failed to load devices. Please try again later.',
    children: null,
  },
};

/**
 * List page with pre-filled search value.
 */
export const WithSearchValue: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <Button variant="outline" size="small-legacy" leftIcon={<RefreshCw className="h-4 w-4" />}>
        Refresh
      </Button>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: 'MacBook',
    onSearch: () => {},
    children: <DevicesTable data={sampleDevices.filter(d => d.name.includes('MacBook'))} />,
  },
};

/**
 * List page with empty data state.
 */
export const EmptyState: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <Button variant="accent" size="small-legacy" leftIcon={<Plus className="h-4 w-4" />}>
        Add Device
      </Button>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: <DevicesTable data={[]} emptyMessage="No devices found. Add your first device to get started." />,
  },
};

/**
 * List page with small padding.
 */
export const SmallPadding: Story = {
  args: {
    title: 'Compact View',
    searchPlaceholder: 'Search...',
    searchValue: '',
    onSearch: () => {},
    padding: 'sm',
    children: <DevicesTable data={sampleDevices} />,
  },
};

/**
 * List page with large padding.
 */
export const LargePadding: Story = {
  args: {
    title: 'Spacious View',
    searchPlaceholder: 'Search...',
    searchValue: '',
    onSearch: () => {},
    padding: 'lg',
    children: <DevicesTable data={sampleDevices} />,
  },
};

/**
 * List page with card background.
 */
export const CardBackground: Story = {
  args: {
    title: 'Devices',
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    background: 'card',
    children: <DevicesTable data={sampleDevices} />,
  },
};

/**
 * Interactive example with working search functionality.
 */
export const Interactive: Story = {
  args: {
    title: 'Devices',
    searchPlaceholder: 'Search by name or type...',
    searchValue: '',
    onSearch: () => {},
    children: null,
  },
  render: function InteractiveStory() {
    const [searchValue, setSearchValue] = useState('');

    const filteredDevices = sampleDevices.filter(
      device =>
        device.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        device.type.toLowerCase().includes(searchValue.toLowerCase()),
    );

    return (
      <ListPageLayout
        title="Devices"
        headerActions={
          <div className="flex gap-2">
            <Button variant="outline" size="small-legacy" leftIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Button variant="accent" size="small-legacy" leftIcon={<Plus className="h-4 w-4" />}>
              Add Device
            </Button>
          </div>
        }
        searchPlaceholder="Search by name or type..."
        searchValue={searchValue}
        onSearch={setSearchValue}
      >
        <DevicesTable data={filteredDevices} emptyMessage="No devices match your search criteria." />
      </ListPageLayout>
    );
  },
};

/**
 * Example mimicking the Scripts page layout.
 */
export const ScriptsPageExample: Story = {
  args: {
    title: 'Scripts',
    headerActions: (
      <div className="flex gap-2">
        <Button variant="outline" size="small-legacy" leftIcon={<RefreshCw className="h-4 w-4" />}>
          Refresh
        </Button>
        <Button variant="accent" size="small-legacy" leftIcon={<Plus className="h-4 w-4" />}>
          New Script
        </Button>
      </div>
    ),
    searchPlaceholder: 'Search scripts...',
    searchValue: '',
    onSearch: () => {},
    children: <SampleTable data={sampleScripts} columns={scriptColumns} />,
  },
};

/**
 * Example mimicking the Logs page layout.
 */
export const LogsPageExample: Story = {
  args: {
    title: 'Logs',
    headerActions: (
      <Button variant="outline" size="small-legacy" leftIcon={<RefreshCw className="h-4 w-4" />}>
        Refresh
      </Button>
    ),
    searchPlaceholder: 'Search logs...',
    searchValue: '',
    onSearch: () => {},
    children: <SampleTable data={sampleLogs} columns={logColumns} />,
  },
};

/**
 * Interactive example with mobile filter button.
 * Resize to mobile viewport to see the filter button next to search bar.
 */
export const WithMobileFilter: Story = {
  args: {
    title: 'Devices',
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: null,
  },
  render: function WithMobileFilterStory() {
    const [searchValue, setSearchValue] = useState('');
    const [filters, setFilters] = useState<TableFilters>({});
    const [sortBy, setSortBy] = useState<string | undefined>();
    const [sortDirection, setSortDirection] = useState<SortDirection | undefined>();

    // Define filter groups
    const filterGroups: FilterGroup[] = [
      {
        id: 'status',
        title: 'Status',
        options: [
          { id: 'online', label: 'Online', count: 3 },
          { id: 'offline', label: 'Offline', count: 1 },
          { id: 'pending', label: 'Pending', count: 1 },
        ],
      },
      {
        id: 'type',
        title: 'Device Type',
        options: [
          { id: 'Laptop', label: 'Laptop', count: 1 },
          { id: 'Mobile', label: 'Mobile', count: 1 },
          { id: 'Desktop', label: 'Desktop', count: 1 },
          { id: 'Tablet', label: 'Tablet', count: 1 },
          { id: 'Server', label: 'Server', count: 1 },
        ],
      },
    ];

    // Define sort config
    const sortConfig: SortConfig = {
      columns: [
        { key: 'name', label: 'Device Name' },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'lastSeen', label: 'Last Seen' },
      ],
      sortBy,
      sortDirection,
    };

    // Filter devices based on search and filters
    const filteredDevices = sampleDevices.filter(device => {
      // Search filter
      const matchesSearch =
        searchValue === '' ||
        device.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        device.type.toLowerCase().includes(searchValue.toLowerCase());

      // Status filter
      const statusFilter = filters.status || [];
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(device.status);

      // Type filter
      const typeFilter = filters.type || [];
      const matchesType = typeFilter.length === 0 || typeFilter.includes(device.type);

      return matchesSearch && matchesStatus && matchesType;
    });

    // Sort devices
    const sortedDevices = [...filteredDevices].sort((a, b) => {
      if (!sortBy) return 0;

      const aValue = a[sortBy as keyof Device];
      const bValue = b[sortBy as keyof Device];

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const handleSort = (column: string, direction: SortDirection) => {
      setSortBy(column);
      setSortDirection(direction);
    };

    return (
      <ListPageLayout
        title="Devices"
        headerActions={
          <div className="flex gap-2">
            <Button variant="outline" size="small-legacy" leftIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Button variant="accent" size="small-legacy" leftIcon={<Plus className="h-4 w-4" />}>
              Add Device
            </Button>
          </div>
        }
        searchPlaceholder="Search devices..."
        searchValue={searchValue}
        onSearch={setSearchValue}
        mobileFilterGroups={filterGroups}
        onMobileFilterChange={setFilters}
        currentMobileFilters={filters}
        mobileSortConfig={sortConfig}
        onMobileSort={handleSort}
        mobileFilterTitle="Sort and Filter"
      >
        <DevicesTable
          data={sortedDevices}
          filters={filters}
          onFiltersChange={setFilters}
          emptyMessage="No devices match your criteria."
        />
      </ListPageLayout>
    );
  },
};
