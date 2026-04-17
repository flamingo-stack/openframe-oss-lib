import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'
import { Button } from '../components/ui/button'
import { FiltersDropdown, type FilterSection } from '../components/features/filters-dropdown'

const meta = {
  title: 'Features/FiltersDropdown',
  component: FiltersDropdown,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'An inline dropdown with checkbox/radio filter sections, "Select All", Reset and Apply buttons. Supports responsive mobile layout and auto-placement.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    triggerLabel: { control: 'text', description: 'Label for default trigger button' },
    placement: {
      control: 'select',
      options: ['bottom-start', 'bottom-end', 'bottom'],
      description: 'Dropdown placement relative to trigger',
    },
    responsive: { control: 'boolean', description: 'Enable responsive mobile behavior' },
  },
} satisfies Meta<typeof FiltersDropdown>

export default meta
type Story = StoryObj<typeof meta>

const statusSections: FilterSection[] = [
  {
    id: 'status',
    title: 'Status',
    type: 'checkbox',
    options: [
      { id: 'active', label: 'Active', value: 'active', count: 2975 },
      { id: 'inactive', label: 'Inactive', value: 'inactive', count: 245 },
      { id: 'maintenance', label: 'Maintenance', value: 'maintenance', count: 105 },
      { id: 'decommissioned', label: 'Decommissioned', value: 'decommissioned', count: 175 },
    ],
    allowSelectAll: true,
  },
]

/**
 * Default dropdown with a single checkbox section.
 */
export const Default: Story = {
  args: {
    triggerLabel: 'STATUS',
    sections: statusSections,
    onApply: fn(),
    onReset: fn(),
    currentFilters: { status: ['active', 'inactive'] },
  },
}

/**
 * Multiple filter sections.
 */
export const MultipleSections: Story = {
  args: {
    triggerLabel: 'Filters',
    sections: [
      ...statusSections,
      {
        id: 'type',
        title: 'Device Type',
        type: 'checkbox',
        options: [
          { id: 'desktop', label: 'Desktop', value: 'desktop' },
          { id: 'laptop', label: 'Laptop', value: 'laptop' },
          { id: 'mobile', label: 'Mobile', value: 'mobile' },
          { id: 'tablet', label: 'Tablet', value: 'tablet' },
        ],
        allowSelectAll: true,
      },
    ],
    onApply: fn(),
    onReset: fn(),
    currentFilters: { status: ['active'], type: ['desktop'] },
  },
}

/**
 * Radio section — single selection.
 */
export const RadioSection: Story = {
  args: {
    triggerLabel: 'Sort Order',
    sections: [
      {
        id: 'sort',
        title: 'Sort By',
        type: 'radio',
        options: [
          { id: 'name', label: 'Name', value: 'name' },
          { id: 'date', label: 'Date Created', value: 'date' },
          { id: 'status', label: 'Status', value: 'status' },
        ],
        defaultSelected: ['name'],
      },
    ],
    onApply: fn(),
    onReset: fn(),
    currentFilters: { sort: ['name'] },
  },
}

/**
 * With a separator between option groups.
 */
export const WithSeparator: Story = {
  args: {
    triggerLabel: 'Platform',
    sections: [
      {
        id: 'platform',
        title: 'Platform',
        type: 'checkbox',
        options: [
          { id: 'openframe', label: 'OpenFrame', value: 'openframe' },
          { id: 'openmsp', label: 'OpenMSP', value: 'openmsp' },
          { id: 'sep', label: '', value: '', type: 'separator' },
          { id: 'flamingo', label: 'Flamingo', value: 'flamingo' },
        ],
        allowSelectAll: true,
      },
    ],
    onApply: fn(),
    onReset: fn(),
  },
}

/**
 * Custom trigger element instead of default text button.
 */
export const CustomTrigger: Story = {
  args: {
    triggerElement: (
      <Button variant="outline" size="sm">
        Open Filters
      </Button>
    ),
    sections: statusSections,
    onApply: fn(),
    onReset: fn(),
    currentFilters: { status: ['active'] },
  },
}

/**
 * Placement variants — bottom-end alignment.
 */
export const PlacementBottomEnd: Story = {
  decorators: [
    (Story) => (
      <div className="flex justify-end w-[500px]">
        <Story />
      </div>
    ),
  ],
  args: {
    triggerLabel: 'Filters',
    sections: statusSections,
    onApply: fn(),
    onReset: fn(),
    placement: 'bottom-end',
  },
}

/**
 * Empty state — no active filters.
 */
export const NoActiveFilters: Story = {
  args: {
    triggerLabel: 'STATUS',
    sections: statusSections,
    onApply: fn(),
    onReset: fn(),
    currentFilters: {},
  },
}

/**
 * Many options — demonstrates scrollable dropdown when content exceeds max height.
 */
export const ManyOptions: Story = {
  args: {
    triggerLabel: 'Filters',
    sections: [
      {
        id: 'country',
        title: 'Country',
        type: 'checkbox',
        options: [
          { id: 'us', label: 'United States', value: 'us' },
          { id: 'uk', label: 'United Kingdom', value: 'uk' },
          { id: 'de', label: 'Germany', value: 'de' },
          { id: 'fr', label: 'France', value: 'fr' },
          { id: 'jp', label: 'Japan', value: 'jp' },
          { id: 'au', label: 'Australia', value: 'au' },
          { id: 'ca', label: 'Canada', value: 'ca' },
          { id: 'br', label: 'Brazil', value: 'br' },
          { id: 'in', label: 'India', value: 'in' },
          { id: 'kr', label: 'South Korea', value: 'kr' },
          { id: 'mx', label: 'Mexico', value: 'mx' },
          { id: 'it', label: 'Italy', value: 'it' },
          { id: 'es', label: 'Spain', value: 'es' },
          { id: 'nl', label: 'Netherlands', value: 'nl' },
          { id: 'se', label: 'Sweden', value: 'se' },
        ],
        allowSelectAll: true,
      },
      {
        id: 'department',
        title: 'Department',
        type: 'checkbox',
        options: [
          { id: 'engineering', label: 'Engineering', value: 'engineering' },
          { id: 'design', label: 'Design', value: 'design' },
          { id: 'product', label: 'Product', value: 'product' },
          { id: 'marketing', label: 'Marketing', value: 'marketing' },
          { id: 'sales', label: 'Sales', value: 'sales' },
          { id: 'support', label: 'Support', value: 'support' },
          { id: 'hr', label: 'Human Resources', value: 'hr' },
          { id: 'finance', label: 'Finance', value: 'finance' },
          { id: 'legal', label: 'Legal', value: 'legal' },
          { id: 'operations', label: 'Operations', value: 'operations' },
        ],
        allowSelectAll: true,
      },
      {
        id: 'role',
        title: 'Role',
        type: 'checkbox',
        options: [
          { id: 'admin', label: 'Admin', value: 'admin' },
          { id: 'manager', label: 'Manager', value: 'manager' },
          { id: 'developer', label: 'Developer', value: 'developer' },
          { id: 'designer', label: 'Designer', value: 'designer' },
          { id: 'analyst', label: 'Analyst', value: 'analyst' },
          { id: 'intern', label: 'Intern', value: 'intern' },
        ],
        allowSelectAll: true,
      },
    ],
    onApply: fn(),
    onReset: fn(),
    currentFilters: { country: ['us', 'uk'], department: ['engineering'] },
  },
}

/**
 * Interactive example with state management.
 */
export const Interactive: Story = {
  render: function InteractiveStory() {
    const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>({
      status: ['active'],
    })

    const activeCount = Object.values(appliedFilters).flat().length

    return (
      <div className="flex flex-col items-center gap-4">
        <FiltersDropdown
          triggerLabel={`STATUS (${activeCount})`}
          sections={statusSections}
          onApply={setAppliedFilters}
          onReset={() => setAppliedFilters({})}
          currentFilters={appliedFilters}
        />
        <div className="text-xs text-ods-text-secondary">
          Applied: {JSON.stringify(appliedFilters)}
        </div>
      </div>
    )
  },
  args: {
    sections: statusSections,
    onApply: fn(),
  },
}
