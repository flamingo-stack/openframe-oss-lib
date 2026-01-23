import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../components/ui/button'
import {
  MobileFilterSheet,
  type FilterGroup,
  type SortConfig,
  type SortDirection,
} from '../components/ui/mobile-filter-sheet'
import type { TableFilters } from '../components/ui/table/types'

const meta = {
  title: 'UI/MobileFilterSheet',
  component: MobileFilterSheet,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A mobile-friendly slide-in sheet for filtering options. Displays filter groups with checkboxes, counts, and action buttons.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    open: {
      control: 'boolean',
      description: 'Whether the sheet is open',
    },
    title: {
      control: 'text',
      description: 'Title displayed at the top of the sheet',
    },
    resetButtonText: {
      control: 'text',
      description: 'Text for reset button',
    },
    applyButtonText: {
      control: 'text',
      description: 'Text for apply button',
    },
  },
} satisfies Meta<typeof MobileFilterSheet>

export default meta
type Story = StoryObj<typeof meta>

const defaultFilterGroups: FilterGroup[] = [
  {
    id: 'statuses',
    title: 'Statuses',
    options: [
      { id: 'active', label: 'Active', count: 2975 },
      { id: 'inactive', label: 'Inactive', count: 245 },
      { id: 'maintenance', label: 'Maintenance', count: 105 },
      { id: 'decommissioned', label: 'Decommissioned', count: 175 },
    ],
  },
]

const defaultCurrentFilters: TableFilters = {
  statuses: ['active', 'inactive', 'decommissioned']
}

/**
 * Default MobileFilterSheet with status filters (matching Figma design).
 */
export const Default: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Sort and Filter',
    filterGroups: defaultFilterGroups,
    currentFilters: defaultCurrentFilters,
    onFilterChange: fn(),
    resetButtonText: 'Reset Filters',
    applyButtonText: 'Apply Filters',
  },
}

/**
 * Interactive example with state management.
 */
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [open, setOpen] = useState(false)
    const [currentFilters, setCurrentFilters] = useState<TableFilters>(defaultCurrentFilters)

    const handleFilterChange = (filters: TableFilters) => {
      setCurrentFilters(filters)
      setOpen(false)
      console.log('Applied filters:', filters)
    }

    const getActiveFilterCount = () => {
      return Object.values(currentFilters).flat().length
    }

    return (
      <div className="flex flex-col items-center gap-4">
        <Button onClick={() => setOpen(true)} variant="outline">
          Open Filters ({getActiveFilterCount()} active)
        </Button>
        <MobileFilterSheet
          open={open}
          onOpenChange={setOpen}
          filterGroups={defaultFilterGroups}
          currentFilters={currentFilters}
          onFilterChange={handleFilterChange}
        />
      </div>
    )
  },
  args: {
    open: false,
    onOpenChange: fn(),
    filterGroups: defaultFilterGroups,
    currentFilters: {},
    onFilterChange: fn(),
  },
}

/**
 * Multiple filter groups example.
 */
export const MultipleGroups: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Sort and Filter',
    filterGroups: [
      {
        id: 'statuses',
        title: 'Statuses',
        options: [
          { id: 'active', label: 'Active', count: 2975 },
          { id: 'inactive', label: 'Inactive', count: 245 },
        ],
      },
      {
        id: 'types',
        title: 'Device Types',
        options: [
          { id: 'desktop', label: 'Desktop', count: 1500 },
          { id: 'laptop', label: 'Laptop', count: 800 },
          { id: 'mobile', label: 'Mobile', count: 350 },
        ],
      },
      {
        id: 'os',
        title: 'Operating System',
        options: [
          { id: 'windows', label: 'Windows' },
          { id: 'macos', label: 'macOS' },
          { id: 'linux', label: 'Linux' },
        ],
      },
      {
        id: 'locations',
        title: 'Locations',
        options: [
          { id: 'usa', label: 'USA', count: 1500 },
          { id: 'canada', label: 'Canada', count: 800 },
          { id: 'uk', label: 'UK', count: 350 },
        ],
      },
      {
        id: 'departments',
        title: 'Departments',
        options: [
          { id: 'hr', label: 'HR', count: 1500 },
          { id: 'engineering', label: 'Engineering', count: 800 },
          { id: 'marketing', label: 'Marketing', count: 350 },
        ],
      },
      {
        id: 'roles',
        title: 'Roles',
        options: [
          { id: 'admin', label: 'Admin', count: 1500 },
          { id: 'user', label: 'User', count: 800 },
        ],
      },
    ],
    currentFilters: {
      statuses: ['active'],
      types: ['desktop', 'laptop'],
      os: ['windows'],
      locations: ['usa'],
      departments: ['hr'],
      roles: ['admin']
    },
    onFilterChange: fn(),
  },
}

/**
 * Without counts - simple filter list.
 */
export const WithoutCounts: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Filter Options',
    filterGroups: [
      {
        id: 'visibility',
        title: 'Visibility',
        options: [
          { id: 'public', label: 'Public' },
          { id: 'private', label: 'Private' },
          { id: 'internal', label: 'Internal Only' },
        ],
      },
    ],
    currentFilters: {
      visibility: ['public', 'internal']
    },
    onFilterChange: fn(),
  },
}

const defaultSortConfig: SortConfig = {
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
  ],
  sortBy: 'name',
  sortDirection: 'asc',
}

/**
 * With sorting options.
 */
export const WithSorting: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Sort and Filter',
    filterGroups: defaultFilterGroups,
    currentFilters: defaultCurrentFilters,
    onFilterChange: fn(),
    sortConfig: defaultSortConfig,
    onSort: fn(),
  },
}

/**
 * Sorting only - no filters.
 */
export const SortingOnly: Story = {
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Sort',
    filterGroups: [],
    currentFilters: {},
    onFilterChange: fn(),
    sortConfig: defaultSortConfig,
    onSort: fn(),
  },
}

/**
 * Interactive example with sorting and filters.
 */
export const InteractiveWithSorting: Story = {
  render: function InteractiveWithSortingStory() {
    const [open, setOpen] = useState(false)
    const [currentFilters, setCurrentFilters] = useState<TableFilters>(defaultCurrentFilters)
    const [sortBy, setSortBy] = useState<string | undefined>('name')
    const [sortDirection, setSortDirection] = useState<SortDirection | undefined>('asc')

    const sortConfig: SortConfig = {
      columns: [
        { key: 'name', label: 'Name' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
      ],
      sortBy,
      sortDirection,
    }

    const handleFilterChange = (filters: TableFilters) => {
      setCurrentFilters(filters)
      setOpen(false)
      console.log('Applied filters:', filters)
      console.log('Applied sort:', sortBy, sortDirection)
    }

    const handleSort = (column: string, direction: SortDirection) => {
      setSortBy(column)
      setSortDirection(direction)
    }

    const handleSortClear = () => {
      setSortBy(undefined)
      setSortDirection(undefined)
    }

    const getActiveFilterCount = () => {
      return Object.values(currentFilters).flat().length
    }

    return (
      <div className="flex flex-col items-center gap-4">
        <Button onClick={() => setOpen(true)} variant="outline">
          Open Sort & Filters ({getActiveFilterCount()} active)
        </Button>
        <div className="text-sm text-ods-text-secondary">
          Current sort: {sortBy ? `${sortBy} (${sortDirection})` : 'None'}
        </div>
        <MobileFilterSheet
          open={open}
          onOpenChange={setOpen}
          filterGroups={defaultFilterGroups}
          currentFilters={currentFilters}
          onFilterChange={handleFilterChange}
          sortConfig={sortConfig}
          onSort={handleSort}
          onSortClear={handleSortClear}
        />
      </div>
    )
  },
  args: {
    open: false,
    onOpenChange: fn(),
    filterGroups: defaultFilterGroups,
    currentFilters: {},
    onFilterChange: fn(),
  },
}
