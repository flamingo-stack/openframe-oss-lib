import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { LayoutGrid, LayoutList, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ListPageLayout } from '../components/layout/list-page-layout';
import { Button } from '../components/ui/button';
import {
  type ColumnDef,
  createColumnHelper,
  DataTable,
  type DataTableFilters,
  useDataTable,
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

const deviceColumn = createColumnHelper<Device>();
const deviceColumns: ColumnDef<Device, string>[] = [
  deviceColumn.accessor('name', { header: 'Device Name' }),
  deviceColumn.accessor('type', {
    header: 'Type',
    meta: {
      hideAt: 'lg',
      filter: {
        options: [
          { id: 'laptop', label: 'Laptop', value: 'laptop' },
          { id: 'mobile', label: 'Mobile', value: 'mobile' },
          { id: 'desktop', label: 'Desktop', value: 'desktop' },
          { id: 'tablet', label: 'Tablet', value: 'tablet' },
          { id: 'server', label: 'Server', value: 'server' },
        ],
      },
    },
  }),
  deviceColumn.accessor('status', {
    header: 'Status',
    meta: {
      filter: {
        options: [
          { id: 'online', label: 'Online', value: 'online' },
          { id: 'offline', label: 'Offline', value: 'offline' },
          { id: 'pending', label: 'Pending', value: 'pending' },
        ],
      },
    },
  }),
  deviceColumn.accessor('lastSeen', { header: 'Last Seen' }),
];

/** A story's rows in the lib's `DataTable`: the header, then the rows or the empty message. */
function StoryTable<T extends { id: string }>({
  data,
  columns,
  emptyMessage,
}: {
  data: T[];
  columns: ColumnDef<T, string>[];
  emptyMessage?: string;
}) {
  const table = useDataTable({ data, columns, getRowId: row => row.id });
  return (
    <DataTable table={table}>
      <DataTable.Header />
      <DataTable.Body emptyState={emptyMessage ? { title: emptyMessage } : undefined} />
    </DataTable>
  );
}

interface ScriptRow {
  id: string;
  name: string;
  language: string;
  lastRun: string;
  status: string;
}
const scriptColumn = createColumnHelper<ScriptRow>();
const scriptColumns: ColumnDef<ScriptRow, string>[] = [
  scriptColumn.accessor('name', { header: 'Script Name' }),
  scriptColumn.accessor('language', { header: 'Language' }),
  scriptColumn.accessor('lastRun', { header: 'Last Run' }),
  scriptColumn.accessor('status', { header: 'Status' }),
];

interface LogRow {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  source: string;
}
const logColumn = createColumnHelper<LogRow>();
const logColumns: ColumnDef<LogRow, string>[] = [
  logColumn.accessor('timestamp', { header: 'Timestamp' }),
  logColumn.accessor('level', { header: 'Level' }),
  logColumn.accessor('message', { header: 'Message' }),
  logColumn.accessor('source', { header: 'Source' }),
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
    children: <StoryTable data={sampleDevices} columns={deviceColumns} />,
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
    children: <StoryTable data={sampleDevices} columns={deviceColumns} />,
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
    children: <StoryTable data={sampleDevices} columns={deviceColumns} />,
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
    children: <StoryTable data={sampleDevices.filter(d => d.name.includes('MacBook'))} columns={deviceColumns} />,
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
    children: (
      <StoryTable
        data={[]}
        columns={deviceColumns}
        emptyMessage="No devices found. Add your first device to get started."
      />
    ),
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
    children: <StoryTable data={sampleDevices} columns={deviceColumns} />,
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
    children: <StoryTable data={sampleDevices} columns={deviceColumns} />,
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
    children: <StoryTable data={sampleDevices} columns={deviceColumns} />,
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
        <StoryTable
          data={filteredDevices}
          columns={deviceColumns}
          emptyMessage="No devices match your search criteria."
        />
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
    children: (
      <StoryTable
        data={[
          { id: '1', name: 'Deploy Script', language: 'Bash', lastRun: '2024-01-20', status: 'success' },
          { id: '2', name: 'Backup Database', language: 'Python', lastRun: '2024-01-19', status: 'success' },
          { id: '3', name: 'Clear Cache', language: 'PowerShell', lastRun: '2024-01-18', status: 'failed' },
        ]}
        columns={scriptColumns}
      />
    ),
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
    children: (
      <StoryTable
        data={[
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
        ]}
        columns={logColumns}
      />
    ),
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
    const [filters, setFilters] = useState<DataTableFilters>({});
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
        <StoryTable data={sortedDevices} columns={deviceColumns} emptyMessage="No devices match your criteria." />
      </ListPageLayout>
    );
  },
};
