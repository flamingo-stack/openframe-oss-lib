import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../components/ui/button'
import { MobileFilterModal, type FilterGroup, type SortConfig } from '../components/ui/mobile-filter-sheet'
import type { TableFilters } from '../components/ui/table/types'

const meta = {
  title: 'UI/MobileFilterModal',
  component: MobileFilterModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A centered modal for filtering options. Displays filter groups with checkboxes, counts, and action buttons.',
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
} satisfies Meta<typeof MobileFilterModal>

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
 * Default MobileFilterModal with status filters (matching Figma design).
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
      setIsOpen(false)
      console.log('Applied filters:', filters)
    }

    const getActiveFilterCount = () => {
      return Object.values(currentFilters).flat().length
    }

    return (
      <div className="flex flex-col items-center gap-4">
        <Button onClick={() => setIsOpen(true)} variant="outline">
          Open Filters Modal ({getActiveFilterCount()} active)
        </Button>
        <MobileFilterModal
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
 * Multiple filter groups example.
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
      {
        id: 'permissions',
        title: 'Permissions',
        options: [
          { id: 'read', label: 'Read', count: 1500 },
          { id: 'write', label: 'Write', count: 800 },
        ],
      },
    ],
    currentFilters: {
      statuses: ['active'],
      types: ['desktop', 'laptop'],
      os: ['windows'],
      locations: ['usa'],
      departments: ['hr'],
      roles: ['admin'],
      permissions: ['read']
    },
    onFilterChange: fn(),
    onClose: fn(),
  },
}

/**
 * Without counts - simple filter list.
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
 * Sorting only - no filters.
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
      setIsOpen(false)
      console.log('Applied filters:', filters)
      console.log('Applied sort:', sortBy, sortDirection)
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
          Open Sort & Filters Modal ({getActiveFilterCount()} active)
        </Button>
        <div className="text-sm text-ods-text-secondary">
          Current sort: {sortBy} ({sortDirection})
        </div>
        <MobileFilterModal
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
