import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useMemo } from 'react'
import { type ColumnDef, DataTable, type Row, useDataTable } from '../components/ui/data-table'
import { EntityImage } from '../components/ui/entity-image'
import { StackedRowsPanel } from '../components/ui/stacked-rows-panel'
import { Tag } from '../components/ui/tag'

const meta = {
  title: 'UI/StackedRowsPanel',
  component: StackedRowsPanel,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A single bordered card that stacks rows inside it. Each row can be one full-width element ' +
          '(title + subtitle), several columns (value + label, optionally a tag/avatar), or an arbitrary ' +
          'node such as a nested table. The container handles all rounding: one row rounds every corner, ' +
          'while many rows round only the first row’s top corners and the last row’s bottom corners.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StackedRowsPanel>

export default meta
type Story = StoryObj<typeof meta>

/** Header card: a full-width title/description row followed by a columns row. */
export const HeaderCard: Story = {
  args: {
    rows: [
      {
        id: 'title',
        columns: [
          {
            key: 'title',
            value: 'Monitors sustained high processor utilization indicating performance bottlenecks',
            label: 'Description',
          },
        ],
      },
      {
        id: 'meta',
        columns: [
          { key: 'severity', value: 'Critical', label: 'Severity' },
          { key: 'status', value: <Tag label="Failing" variant="error" />, label: 'Status' },
          { key: 'author', value: 'Jane Doe', label: 'Author' },
        ],
      },
    ],
  },
}

/** Standard table: uniform multi-column rows (avatar + name/email, role, status tag). */
export const StandardTable: Story = {
  args: {
    rows: [
      {
        id: 'jane',
        columns: [
          {
            key: 'user',
            content: (
              <div className="flex items-center gap-[var(--spacing-system-m)] min-w-0">
                <EntityImage alt="Jane Doe" fallbackText="Jane Doe" className="size-8 rounded-full" />
                <div className="flex flex-col min-w-0">
                  <span className="text-ods-text-primary text-h4 truncate">Jane Doe</span>
                  <span className="text-ods-text-secondary text-h6 truncate">jane.doe@example.com</span>
                </div>
              </div>
            ),
          },
          { key: 'role', value: 'Admin', hideAt: 'md' },
          { key: 'status', content: <Tag label="Active" variant="success" />, align: 'right' },
        ],
      },
      {
        id: 'john',
        columns: [
          {
            key: 'user',
            content: (
              <div className="flex items-center gap-[var(--spacing-system-m)] min-w-0">
                <EntityImage alt="John Roe" fallbackText="John Roe" className="size-8 rounded-full" />
                <div className="flex flex-col min-w-0">
                  <span className="text-ods-text-primary text-h4 truncate">John Roe</span>
                  <span className="text-ods-text-secondary text-h6 truncate">john.roe@example.com</span>
                </div>
              </div>
            ),
          },
          { key: 'role', value: 'Admin', hideAt: 'md' },
          { key: 'status', content: <Tag label="Offline" variant="grey" />, align: 'right' },
        ],
      },
    ],
  },
}

/** A single row rounds all four corners. */
export const SingleRow: Story = {
  args: {
    rows: [{ id: 'only', columns: [{ key: 'only', value: 'High CPU Usage >85%', label: 'Policy' }] }],
  },
}

interface DemoDevice {
  id: string
  name: string
  status: 'NON-COMPLIANT' | 'COMPLIANT'
}

const DEMO_DEVICES: DemoDevice[] = [
  { id: '1', name: "John's Device", status: 'NON-COMPLIANT' },
  { id: '2', name: 'Workstation-04', status: 'COMPLIANT' },
]

function NestedDevicesTable() {
  const columns = useMemo<ColumnDef<DemoDevice>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'DEVICE',
        cell: ({ row }: { row: Row<DemoDevice> }) => (
          <div className="flex flex-col">
            <span className="text-ods-text-primary text-h4 truncate">{row.original.name}</span>
            <span className="text-ods-text-secondary text-h6 truncate">Last Online: 2 hours ago</span>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }: { row: Row<DemoDevice> }) => (
          <Tag label={row.original.status} variant={row.original.status === 'COMPLIANT' ? 'success' : 'error'} />
        ),
        meta: { width: 'w-[180px]' },
      },
    ],
    [],
  )

  const table = useDataTable<DemoDevice>({
    data: DEMO_DEVICES,
    columns,
    getRowId: (row: DemoDevice) => row.id,
    enableSorting: false,
  })

  return (
    <DataTable table={table}>
      <DataTable.Header />
      <DataTable.Body />
    </DataTable>
  )
}

/** A panel row can host an arbitrary node — here a nested DataTable. */
export const WithNestedTable: Story = {
  args: {
    title: 'Devices',
    rows: [{ id: 'devices', className: 'p-[var(--spacing-system-m)]', content: <NestedDevicesTable /> }],
  },
}
