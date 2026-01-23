import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LayoutGrid, LayoutList, Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { ListPageLayout } from '../components/layout/list-page-layout'
import { Button } from '../components/ui/button'
import type { FilterGroup, SortConfig, SortDirection } from '../components/ui/mobile-filter-sheet'
import { Table, type TableColumn, type TableFilters } from '../components/ui/table'

interface Device {
  id: string
  name: string
  status: 'online' | 'offline' | 'pending'
  type: string
  lastSeen: string
}

const sampleDevices: Device[] = [
  { id: '1', name: 'MacBook Pro', status: 'online', type: 'Laptop', lastSeen: '2024-01-20' },
  { id: '2', name: 'iPhone 15', status: 'online', type: 'Mobile', lastSeen: '2024-01-20' },
  { id: '3', name: 'Windows Desktop', status: 'offline', type: 'Desktop', lastSeen: '2024-01-15' },
  { id: '4', name: 'iPad Air', status: 'pending', type: 'Tablet', lastSeen: '2024-01-18' },
  { id: '5', name: 'Linux Server', status: 'online', type: 'Server', lastSeen: '2024-01-20' },
]

const deviceColumns: TableColumn<Device>[] = [
  { key: 'name', label: 'Device Name' },
  { key: 'type', label: 'Type', hideAt: 'lg', filterable: true, filterOptions: [
    { id: 'laptop', label: 'Laptop', value: 'laptop' },
    { id: 'mobile', label: 'Mobile', value: 'mobile' },
    { id: 'desktop', label: 'Desktop', value: 'desktop' },
    { id: 'tablet', label: 'Tablet', value: 'tablet' },
    { id: 'server', label: 'Server', value: 'server' },
  ] },
  { key: 'status', label: 'Status', filterable: true, filterOptions: [
    { id: 'online', label: 'Online', value: 'online' },
    { id: 'offline', label: 'Offline', value: 'offline' },
    { id: 'pending', label: 'Pending', value: 'pending' },
  ] },
  { key: 'lastSeen', label: 'Last Seen' },
]

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
        `
      }
    }
  },
  tags: ['autodocs'],
  argTypes: {
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
      description: 'Container padding size'
    },
    background: {
      control: 'select',
      options: ['default', 'card', 'transparent'],
      description: 'Container background style'
    }
  }
} satisfies Meta<typeof ListPageLayout>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Basic list page layout with a title, search bar, and table content.
 */
export const Basic: Story = {
  args: {
    title: 'Devices',
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: (
      <Table
        data={sampleDevices}
        columns={deviceColumns}
        rowKey="id"
      />
    )
  }
}

/**
 * List page with header actions including refresh and add buttons.
 */
export const WithHeaderActions: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
          Refresh
        </Button>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
          Add Device
        </Button>
      </div>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: (
      <Table
        data={sampleDevices}
        columns={deviceColumns}
        rowKey="id"
      />
    )
  }
}

/**
 * List page with view toggle actions (table/grid view).
 */
export const WithViewToggle: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" leftIcon={<LayoutList className="w-4 h-4" />}>
          List
        </Button>
        <Button variant="ghost" size="sm" leftIcon={<LayoutGrid className="w-4 h-4" />}>
          Grid
        </Button>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
          New
        </Button>
      </div>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: (
      <Table
        data={sampleDevices}
        columns={deviceColumns}
        rowKey="id"
      />
    )
  }
}

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
    children: null
  }
}

/**
 * List page with pre-filled search value.
 */
export const WithSearchValue: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
        Refresh
      </Button>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: 'MacBook',
    onSearch: () => {},
    children: (
      <Table
        data={sampleDevices.filter(d => d.name.includes('MacBook'))}
        columns={deviceColumns}
        rowKey="id"
      />
    )
  }
}

/**
 * List page with empty data state.
 */
export const EmptyState: Story = {
  args: {
    title: 'Devices',
    headerActions: (
      <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
        Add Device
      </Button>
    ),
    searchPlaceholder: 'Search devices...',
    searchValue: '',
    onSearch: () => {},
    children: (
      <Table
        data={[]}
        columns={deviceColumns}
        rowKey="id"
        emptyMessage="No devices found. Add your first device to get started."
      />
    )
  }
}

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
    children: (
      <Table
        data={sampleDevices}
        columns={deviceColumns}
        rowKey="id"
      />
    )
  }
}

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
    children: (
      <Table
        data={sampleDevices}
        columns={deviceColumns}
        rowKey="id"
      />
    )
  }
}

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
    children: (
      <Table
        data={sampleDevices}
        columns={deviceColumns}
        rowKey="id"
      />
    )
  }
}

/**
 * Interactive example with working search functionality.
 */
export const Interactive: Story = {
  args: {
    title: 'Devices',
    searchPlaceholder: 'Search by name or type...',
    searchValue: '',
    onSearch: () => {},
    children: null
  },
  render: function InteractiveStory() {
    const [searchValue, setSearchValue] = useState('')

    const filteredDevices = sampleDevices.filter(device =>
      device.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      device.type.toLowerCase().includes(searchValue.toLowerCase())
    )

    return (
      <ListPageLayout
        title="Devices"
        headerActions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Add Device
            </Button>
          </div>
        }
        searchPlaceholder="Search by name or type..."
        searchValue={searchValue}
        onSearch={setSearchValue}
      >
        <Table
          data={filteredDevices}
          columns={deviceColumns}
          rowKey="id"
          emptyMessage="No devices match your search criteria."
        />
      </ListPageLayout>
    )
  }
}

/**
 * Example mimicking the Scripts page layout.
 */
export const ScriptsPageExample: Story = {
  args: {
    title: 'Scripts',
    headerActions: (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
          Refresh
        </Button>
        <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
          New Script
        </Button>
      </div>
    ),
    searchPlaceholder: 'Search scripts...',
    searchValue: '',
    onSearch: () => {},
    children: (
      <Table
        data={[
          { id: '1', name: 'Deploy Script', language: 'Bash', lastRun: '2024-01-20', status: 'success' },
          { id: '2', name: 'Backup Database', language: 'Python', lastRun: '2024-01-19', status: 'success' },
          { id: '3', name: 'Clear Cache', language: 'PowerShell', lastRun: '2024-01-18', status: 'failed' },
        ]}
        columns={[
          { key: 'name', label: 'Script Name' },
          { key: 'language', label: 'Language' },
          { key: 'lastRun', label: 'Last Run' },
          { key: 'status', label: 'Status' },
        ] as TableColumn<{ id: string; name: string; language: string; lastRun: string; status: string }>[]}
        rowKey="id"
      />
    )
  }
}

/**
 * Example mimicking the Logs page layout.
 */
export const LogsPageExample: Story = {
  args: {
    title: 'Logs',
    headerActions: (
      <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
        Refresh
      </Button>
    ),
    searchPlaceholder: 'Search logs...',
    searchValue: '',
    onSearch: () => {},
    children: (
      <Table
        data={[
          { id: '1', timestamp: '2024-01-20 14:32:01', level: 'INFO', message: 'User login successful', source: 'auth-service' },
          { id: '2', timestamp: '2024-01-20 14:31:45', level: 'WARNING', message: 'Rate limit approaching', source: 'api-gateway' },
          { id: '3', timestamp: '2024-01-20 14:30:22', level: 'ERROR', message: 'Database connection timeout', source: 'db-service' },
          { id: '4', timestamp: '2024-01-20 14:29:10', level: 'INFO', message: 'Cache cleared successfully', source: 'cache-service' },
        ]}
        columns={[
          { key: 'timestamp', label: 'Timestamp' },
          { key: 'level', label: 'Level' },
          { key: 'message', label: 'Message' },
          { key: 'source', label: 'Source' },
        ] as TableColumn<{ id: string; timestamp: string; level: string; message: string; source: string }>[]}
        rowKey="id"
      />
    )
  }
}

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
    const [searchValue, setSearchValue] = useState('')
    const [filters, setFilters] = useState<TableFilters>({})
    const [sortBy, setSortBy] = useState<string | undefined>()
    const [sortDirection, setSortDirection] = useState<SortDirection | undefined>()

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
    ]

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
    }

    // Filter devices based on search and filters
    const filteredDevices = sampleDevices.filter((device) => {
      // Search filter
      const matchesSearch =
        searchValue === '' ||
        device.name.toLowerCase().includes(searchValue.toLowerCase()) ||
        device.type.toLowerCase().includes(searchValue.toLowerCase())

      // Status filter
      const statusFilter = filters.status || []
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(device.status)

      // Type filter
      const typeFilter = filters.type || []
      const matchesType = typeFilter.length === 0 || typeFilter.includes(device.type)

      return matchesSearch && matchesStatus && matchesType
    })

    // Sort devices
    const sortedDevices = [...filteredDevices].sort((a, b) => {
      if (!sortBy) return 0

      const aValue = a[sortBy as keyof Device]
      const bValue = b[sortBy as keyof Device]

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    const handleSort = (column: string, direction: SortDirection) => {
      setSortBy(column)
      setSortDirection(direction)
    }

    return (
      <ListPageLayout
        title="Devices"
        headerActions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" leftIcon={<RefreshCw className="w-4 h-4" />}>
              Refresh
            </Button>
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
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
        <Table
          data={sortedDevices}
          columns={deviceColumns}
          onFilterChange={setFilters}
          rowKey="id"
          emptyMessage="No devices match your criteria."
        />
      </ListPageLayout>
    )
  },
}
