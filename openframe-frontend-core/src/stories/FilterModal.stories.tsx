import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../components/ui/button'
import { FilterModal, type FilterGroup, type SortConfig } from '../components/ui/filter-modal'
import type { TableFilters } from '../components/ui/table/types'

const meta = {
  title: 'UI/FilterModal',
  component: FilterModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A modal for filtering and sorting options. Displays filter groups with checkboxes, counts, sort columns, and action buttons.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    isOpen: {
      control: 'boolean',
      description: 'Whether the modal is open',
    },
    title: {
      control: 'text',
      description: 'Title displayed at the top of the modal',
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
} satisfies Meta<typeof FilterModal>

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
 * Default FilterModal with status filters.
 */
export const Default: Story = {
  args: {
    isOpen: true,
    title: 'Sort and Filter',
    filterGroups: defaultFilterGroups,
    currentFilters: defaultCurrentFilters,
    onFilterChange: fn(),
    onClose: fn(),
    resetButtonText: 'Reset Filters',
    applyButtonText: 'Apply Filters',
  },
}

/**
 * Interactive example with state management.
 */
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [isOpen, setIsOpen] = useState(false)
    const [currentFilters, setCurrentFilters] = useState<TableFilters>(defaultCurrentFilters)

    const handleFilterChange = (filters: TableFilters) => {
      setCurrentFilters(filters)
    }

    const getActiveFilterCount = () => {
      return Object.values(currentFilters).flat().length
    }

    return (
      <div className="flex flex-col items-center gap-4">
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open Filters ({getActiveFilterCount()} active)
        </Button>
        <FilterModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          filterGroups={defaultFilterGroups}
          currentFilters={currentFilters}
          onFilterChange={handleFilterChange}
        />
      </div>
    )
  },
  args: {
    isOpen: false,
    filterGroups: defaultFilterGroups,
    currentFilters: {},
    onFilterChange: fn(),
    onClose: fn(),
  },
}

/**
 * Multiple filter groups.
 */
export const MultipleGroups: Story = {
  args: {
    isOpen: true,
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
        id: 'os',
        title: 'Operating System',
        options: [
          { id: 'windows', label: 'Windows' },
          { id: 'macos', label: 'macOS' },
          { id: 'linux', label: 'Linux' },
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
        id: 'os',
        title: 'Operating System',
        options: [
          { id: 'windows', label: 'Windows' },
          { id: 'macos', label: 'macOS' },
          { id: 'linux', label: 'Linux' },
        ],
      },
    ],
    currentFilters: {
      statuses: ['active'],
      types: ['desktop', 'laptop'],
    },
    onFilterChange: fn(),
    onClose: fn(),
  },
}

/**
 * Without counts — simple filter list.
 */
export const WithoutCounts: Story = {
  args: {
    isOpen: true,
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
    onClose: fn(),
  },
}

/**
 * With sorting and filter groups combined.
 */
export const WithSorting: Story = {
  args: {
    isOpen: true,
    title: 'Sort and Filter',
    filterGroups: defaultFilterGroups,
    currentFilters: defaultCurrentFilters,
    onFilterChange: fn(),
    onClose: fn(),
    sortConfig: defaultSortConfig,
    onSort: fn(),
  },
}

/**
 * Sorting only — no filter groups.
 */
export const SortingOnly: Story = {
  args: {
    isOpen: true,
    title: 'Sort',
    filterGroups: [],
    currentFilters: {},
    onFilterChange: fn(),
    onClose: fn(),
    sortConfig: defaultSortConfig,
    onSort: fn(),
  },
}

/**
 * Interactive example with sorting and filters.
 */
export const InteractiveWithSorting: Story = {
  render: function InteractiveWithSortingStory() {
    const [isOpen, setIsOpen] = useState(false)
    const [currentFilters, setCurrentFilters] = useState<TableFilters>(defaultCurrentFilters)
    const [sortBy, setSortBy] = useState<string>('name')
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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
    }

    const handleSort = (column: string, direction: 'asc' | 'desc') => {
      setSortBy(column)
      setSortDirection(direction)
    }

    const getActiveFilterCount = () => {
      return Object.values(currentFilters).flat().length
    }

    return (
      <div className="flex flex-col items-center gap-4">
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Sort & Filter ({getActiveFilterCount()} active)
        </Button>
        <div className="text-sm text-ods-text-secondary">
          Sort: {sortBy} ({sortDirection})
        </div>
        <FilterModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          filterGroups={defaultFilterGroups}
          currentFilters={currentFilters}
          onFilterChange={handleFilterChange}
          sortConfig={sortConfig}
          onSort={handleSort}
        />
      </div>
    )
  },
  args: {
    isOpen: false,
    filterGroups: defaultFilterGroups,
    currentFilters: {},
    onFilterChange: fn(),
    onClose: fn(),
  },
}

/**
 * Empty state — no filters selected.
 */
export const EmptyFilters: Story = {
  args: {
    isOpen: true,
    title: 'Sort and Filter',
    filterGroups: defaultFilterGroups,
    currentFilters: {},
    onFilterChange: fn(),
    onClose: fn(),
  },
}
