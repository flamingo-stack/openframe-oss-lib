import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from '../components/ui/button'
import { Table, type TableColumn } from '../components/ui/table'

interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'pending'
  department: string
  lastLogin: string
  createdAt: string
}

const sampleUsers: User[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Admin',
    status: 'active',
    department: 'Engineering',
    lastLogin: '2024-01-20',
    createdAt: '2023-01-15'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane.smith@example.com',
    role: 'Developer',
    status: 'active',
    department: 'Engineering',
    lastLogin: '2024-01-19',
    createdAt: '2023-03-22'
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob.johnson@example.com',
    role: 'Designer',
    status: 'inactive',
    department: 'Design',
    lastLogin: '2024-01-10',
    createdAt: '2023-06-10'
  },
  {
    id: '4',
    name: 'Alice Williams',
    email: 'alice.w@example.com',
    role: 'Manager',
    status: 'active',
    department: 'Product',
    lastLogin: '2024-01-20',
    createdAt: '2023-02-18'
  },
  {
    id: '5',
    name: 'Charlie Brown',
    email: 'charlie.b@example.com',
    role: 'Developer',
    status: 'pending',
    department: 'Engineering',
    lastLogin: '2024-01-18',
    createdAt: '2024-01-01'
  }
]

const meta = {
  title: 'UI/Table',
  component: Table<User>,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'A responsive table component with support for sorting, filtering, selection, and responsive column visibility using Tailwind breakpoints.'
      }
    }
  },
  tags: ['autodocs']
} satisfies Meta<typeof Table<User>>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Basic table with all columns visible on all screen sizes.
 */
export const Basic: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' }
    ] as TableColumn<User>[],
    rowKey: 'id'
  }
}

/**
 * Table demonstrating responsive column visibility with hideAt property.
 * Resize your browser window to see columns hide at different breakpoints.
 *
 * - Name & Email: Always visible
 * - Role: Hidden on very small screens (< 640px)
 * - Status: Hidden on mobile/tablet (< 768px)
 * - Department: Hidden below desktop (< 1024px)
 * - Last Login: Hidden below large desktop (< 1280px)
 * - Created: Only visible on very large screens (>= 1280px)
 */
export const ResponsiveColumns: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'name', label: 'Name', hideAt: 'xl' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', hideAt: 'sm' },
      { key: 'status', label: 'Status', hideAt: 'md' },
      { key: 'department', label: 'Department', hideAt: 'lg' },
      { key: 'lastLogin', label: 'Last Login', hideAt: 'lg' },
    ] as TableColumn<User>[],
    rowKey: 'id',
    renderRowActions: (item) => (
      <div>
        <Button variant="outline" size="sm">
          Edit
        </Button>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'This example demonstrates progressive disclosure of information. The most important columns (Name, Email) are always visible, while additional details appear as screen size increases. Try resizing your browser window to see the columns show/hide at different breakpoints.'
      }
    }
  }
}

/**
 * Table with multiple breakpoint hiding for specific columns.
 * The ID column is hidden on md and lg breakpoints, but visible on sm, xl, and 2xl.
 */
export const MultipleBreakpoints: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'id', label: 'ID', hideAt: ['md', 'lg'], width: 'w-20' },
      { key: 'name', label: 'Name', width: 'min-w-[150px]' },
      { key: 'email', label: 'Email', width: 'min-w-[200px]' },
      { key: 'role', label: 'Role', width: 'min-w-[120px]' }
    ] as TableColumn<User>[],
    rowKey: 'id'
  },
  parameters: {
    docs: {
      description: {
        story: 'The ID column uses hideAt with an array of breakpoints, making it visible on sm (640px+), hidden on md and lg, then visible again on xl (1280px+) and 2xl (1536px+).'
      }
    }
  }
}

/**
 * Loading state with skeleton rows.
 */
export const Loading: Story = {
  args: {
    data: [],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', hideAt: 'md' },
      { key: 'status', label: 'Status', hideAt: 'lg' }
    ] as TableColumn<User>[],
    rowKey: 'id',
    loading: true,
    skeletonRows: 5
  }
}

/**
 * Empty state.
 */
export const Empty: Story = {
  args: {
    data: [],
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'status', label: 'Status' }
    ] as TableColumn<User>[],
    rowKey: 'id',
    emptyMessage: 'No users found'
  }
}

/**
 * Table with row selection enabled.
 */
export const Selectable: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', hideAt: 'md' },
      { key: 'status', label: 'Status', hideAt: 'lg' }
    ] as TableColumn<User>[],
    rowKey: 'id',
    selectable: true,
    selectedRows: []
  }
}

/**
 * Table with sortable columns.
 */
export const Sortable: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'name', label: 'Name', sortable: true },
      { key: 'email', label: 'Email', sortable: true },
      { key: 'role', label: 'Role', sortable: true, hideAt: 'md' },
      { key: 'status', label: 'Status', sortable: true, hideAt: 'lg' }
    ] as TableColumn<User>[],
    rowKey: 'id',
    sortBy: 'name',
    sortDirection: 'asc'
  }
}

/**
 * Table with clickable rows.
 */
export const Clickable: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role', hideAt: 'md' },
      { key: 'status', label: 'Status', hideAt: 'lg' }
    ] as TableColumn<User>[],
    rowKey: 'id'
  }
}

/**
 * Mobile-first responsive table.
 * Shows only essential columns on mobile, progressively adding more on larger screens.
 */
export const MobileFirst: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'name', label: 'Name', width: 'min-w-[150px]' },
      { key: 'status', label: 'Status', hideAt: 'sm' },
      { key: 'email', label: 'Email', hideAt: 'md', width: 'min-w-[200px]' },
      { key: 'role', label: 'Role', hideAt: 'lg', width: 'min-w-[120px]' },
      { key: 'department', label: 'Department', hideAt: 'xl', width: 'min-w-[130px]' }
    ] as TableColumn<User>[],
    rowKey: 'id'
  },
  parameters: {
    docs: {
      description: {
        story: 'This table starts with just the Name column on very small screens and progressively reveals more columns as the viewport grows.'
      }
    }
  }
}

/**
 * Tablet-optimized table that shows only sortable/filterable columns on tablet (768px-1024px).
 * On tablet, only Name (sortable) and Status (filterable) columns are visible in the header.
 * All other columns appear only on desktop (1024px+).
 */
export const TabletOptimized: Story = {
  args: {
    data: sampleUsers,
    columns: [
      { key: 'name', label: 'Name', sortable: true, width: 'min-w-[150px]' },
      { key: 'email', label: 'Email', width: 'min-w-[200px]' },
      { key: 'role', label: 'Role', width: 'min-w-[120px]' },
      {
        key: 'status',
        label: 'Status',
        filterable: true,
        filterOptions: [
          { id: 'active', label: 'Active', value: 'active' },
          { id: 'inactive', label: 'Inactive', value: 'inactive' },
          { id: 'pending', label: 'Pending', value: 'pending' }
        ]
      },
      { key: 'department', label: 'Department', width: 'min-w-[130px]' }
    ] as TableColumn<User>[],
    rowKey: 'id',
    sortBy: 'name',
    sortDirection: 'asc',
    onFilterChange: (filters) => {
      console.log(filters)
    }
  },
  parameters: {
    docs: {
      description: {
        story: 'On tablet screens (768px-1024px), only columns with sorting or filtering enabled are visible in the header. This reduces visual clutter while keeping interactive columns accessible. Resize to tablet width to see the effect.'
      }
    }
  }
}
