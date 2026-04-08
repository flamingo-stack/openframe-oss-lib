import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { TableColumnFilterDropdown } from '../components/ui/table/table-column-filter-dropdown'
import type { FilterOption, TableFilters } from '../components/ui/table/types'

const meta = {
  title: 'UI/Table/TableColumnFilterDropdown',
  component: TableColumnFilterDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A compact filter icon button for table column headers. Shows a FiltersDropdown with checkbox options. The icon highlights when filters are active.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    placement: {
      control: 'select',
      options: ['bottom-start', 'bottom-end', 'bottom'],
    },
  },
} satisfies Meta<typeof TableColumnFilterDropdown>

export default meta
type Story = StoryObj<typeof meta>

const statusOptions: FilterOption[] = [
  { id: 'active', label: 'Active', value: 'active' },
  { id: 'inactive', label: 'Inactive', value: 'inactive' },
  { id: 'maintenance', label: 'Maintenance', value: 'maintenance' },
  { id: 'decommissioned', label: 'Decommissioned', value: 'decommissioned' },
]

/**
 * Default state — no active filters. Icon is subtle.
 */
export const Default: Story = {
  args: {
    columnKey: 'status',
    columnLabel: 'Status',
    filterOptions: statusOptions,
    filters: {},
    onFilterChange: fn(),
  },
}

/**
 * With active filters — icon is highlighted with accent color.
 */
export const WithActiveFilters: Story = {
  args: {
    columnKey: 'status',
    columnLabel: 'Status',
    filterOptions: statusOptions,
    filters: { status: ['active', 'inactive'] },
    onFilterChange: fn(),
  },
}

/**
 * Simulates placement inside a table header row.
 */
export const InTableHeaderContext: Story = {
  decorators: [
    (Story) => (
      <div className="flex items-center gap-4 px-4 py-3 bg-ods-bg border-b border-ods-border">
        <span className="font-medium text-[12px] leading-[16px] text-ods-text-secondary uppercase">
          Status
        </span>
        <Story />
      </div>
    ),
  ],
  args: {
    columnKey: 'status',
    columnLabel: 'Status',
    filterOptions: statusOptions,
    filters: { status: ['active'] },
    onFilterChange: fn(),
  },
}

/**
 * Multiple columns side by side, as in a real table header.
 */
export const MultipleColumns: Story = {
  render: function MultipleColumnsStory() {
    const [filters, setFilters] = useState<TableFilters>({
      status: ['active'],
    })

    const typeOptions: FilterOption[] = [
      { id: 'desktop', label: 'Desktop', value: 'desktop' },
      { id: 'laptop', label: 'Laptop', value: 'laptop' },
      { id: 'mobile', label: 'Mobile', value: 'mobile' },
    ]

    return (
      <div className="flex items-center gap-8 px-4 py-3 bg-ods-bg border-b border-ods-border rounded">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[12px] text-ods-text-secondary uppercase">Status</span>
          <TableColumnFilterDropdown
            columnKey="status"
            columnLabel="Status"
            filterOptions={statusOptions}
            filters={filters}
            onFilterChange={setFilters}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-[12px] text-ods-text-secondary uppercase">Type</span>
          <TableColumnFilterDropdown
            columnKey="type"
            columnLabel="Type"
            filterOptions={typeOptions}
            filters={filters}
            onFilterChange={setFilters}
          />
        </div>
        <div className="ml-auto text-xs text-ods-text-secondary">
          Active filters: {JSON.stringify(filters)}
        </div>
      </div>
    )
  },
  args: {
    columnKey: 'status',
    columnLabel: 'Status',
    filterOptions: statusOptions,
    onFilterChange: fn(),
  },
}

/**
 * Interactive — full state management.
 */
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [filters, setFilters] = useState<TableFilters>({})

    return (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-medium text-[12px] text-ods-text-secondary uppercase">Status</span>
          <TableColumnFilterDropdown
            columnKey="status"
            columnLabel="Status"
            filterOptions={statusOptions}
            filters={filters}
            onFilterChange={setFilters}
          />
        </div>
        <div className="text-xs text-ods-text-secondary">
          {filters.status?.length
            ? `Filtered by: ${filters.status.join(', ')}`
            : 'No filters applied'}
        </div>
      </div>
    )
  },
  args: {
    columnKey: 'status',
    columnLabel: 'Status',
    filterOptions: statusOptions,
    onFilterChange: fn(),
  },
}
