import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from '../components/ui/button'
import { QueryReportTable } from '../components/ui/table/query-report-table'
import type { QueryResultRow } from '../components/ui/table/query-report-table'

const sampleData: QueryResultRow[] = [
  {
    hostname: 'prod-web-01',
    ip_address: '10.0.1.12',
    os: 'Ubuntu 22.04',
    cpu_usage: 45,
    memory_gb: 16,
    status: 'healthy',
  },
  {
    hostname: 'prod-web-02',
    ip_address: '10.0.1.13',
    os: 'Ubuntu 22.04',
    cpu_usage: 78,
    memory_gb: 32,
    status: 'warning',
  },
  {
    hostname: 'prod-db-01',
    ip_address: '10.0.2.5',
    os: 'Debian 12',
    cpu_usage: 23,
    memory_gb: 64,
    status: 'healthy',
  },
  {
    hostname: 'staging-app-01',
    ip_address: '10.0.3.10',
    os: 'Rocky Linux 9',
    cpu_usage: 92,
    memory_gb: 8,
    status: 'critical',
  },
  {
    hostname: 'prod-cache-01',
    ip_address: '10.0.1.50',
    os: 'Ubuntu 24.04',
    cpu_usage: 12,
    memory_gb: 16,
    status: 'healthy',
  },
]

const manyColumnsData: QueryResultRow[] = [
  {
    device_id: 'DEV-001',
    hostname: 'prod-web-01.us-east-1.compute.internal',
    ip_address: '10.0.1.12',
    mac_address: '00:1A:2B:3C:4D:5E',
    os: 'Ubuntu 22.04 LTS',
    kernel: '5.15.0-91-generic',
    cpu_cores: 8,
    cpu_usage: 45,
    memory_gb: 16,
    disk_total_gb: 500,
    disk_used_pct: 62,
    uptime_days: 142,
    last_patch: '2026-02-10',
    status: 'healthy',
  },
  {
    device_id: 'DEV-002',
    hostname: 'prod-db-01.eu-west-1.compute.internal',
    ip_address: '10.0.2.5',
    mac_address: '00:1A:2B:3C:4D:5F',
    os: 'Debian 12',
    kernel: '6.1.0-17-amd64',
    cpu_cores: 16,
    cpu_usage: 23,
    memory_gb: 64,
    disk_total_gb: 2000,
    disk_used_pct: 41,
    uptime_days: 89,
    last_patch: '2026-02-15',
    status: 'healthy',
  },
  {
    device_id: 'DEV-003',
    hostname: 'staging-app-01.us-west-2.compute.internal',
    ip_address: '10.0.3.10',
    mac_address: '00:1A:2B:3C:4D:60',
    os: 'Rocky Linux 9',
    kernel: '5.14.0-362.el9',
    cpu_cores: 4,
    cpu_usage: 92,
    memory_gb: 8,
    disk_total_gb: 100,
    disk_used_pct: 88,
    uptime_days: 3,
    last_patch: '2026-01-28',
    status: 'critical',
  },
]

const meta = {
  title: 'UI/QueryReportTable',
  component: QueryReportTable,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A dynamic table for displaying query/report results. Columns are auto-derived from data keys, supports CSV export, custom column ordering, loading skeletons, and empty states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    columnWidth: {
      control: { type: 'number', min: 80, max: 400, step: 10 },
    },
    skeletonRows: {
      control: { type: 'number', min: 1, max: 20 },
    },
    skeletonColumns: {
      control: { type: 'number', min: 1, max: 12 },
    },
    showExport: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof QueryReportTable>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default table with auto-derived columns from data keys.
 */
export const Default: Story = {
  args: {
    title: 'Server Health Report',
    data: sampleData,
  },
}

/**
 * Loading state with skeleton rows and columns.
 */
export const Loading: Story = {
  args: {
    title: 'Server Health Report',
    data: [],
    loading: true,
    skeletonRows: 8,
    skeletonColumns: 6,
  },
}

/**
 * Empty state when no data is returned.
 */
export const Empty: Story = {
  args: {
    title: 'Server Health Report',
    data: [],
    emptyMessage: 'No results matched your query',
  },
}

/**
 * Custom column ordering — only listed keys appear first, remaining keys are appended.
 */
export const CustomColumnOrder: Story = {
  args: {
    title: 'Server Health Report',
    data: sampleData,
    columnOrder: ['status', 'hostname', 'cpu_usage', 'memory_gb'],
  },
}

/**
 * Wide column width for tables with long values.
 */
export const WideColumns: Story = {
  args: {
    title: 'Server Health Report',
    data: sampleData,
    columnWidth: 240,
  },
}

/**
 * Narrow column width for compact display.
 */
export const NarrowColumns: Story = {
  args: {
    title: 'Server Health Report',
    data: sampleData,
    columnWidth: 110,
  },
}

/**
 * Table with many columns — demonstrates horizontal scrolling and the right-edge gradient fade.
 */
export const ManyColumns: Story = {
  args: {
    title: 'Full Device Inventory',
    data: manyColumnsData,
    columnWidth: 160,
  },
}

/**
 * Export disabled — the CSV button is hidden.
 */
export const NoExport: Story = {
  args: {
    title: 'Server Health Report',
    data: sampleData,
    showExport: false,
  },
}

/**
 * Custom export filename and onExport callback.
 */
export const CustomExport: Story = {
  args: {
    title: 'Server Health Report',
    data: sampleData,
    exportFilename: 'server-health-2026-02',
    onExport: () => alert('CSV exported!'),
  },
}

/**
 * Additional header actions rendered next to the Export button.
 */
export const WithHeaderActions: Story = {
  args: {
    title: 'Server Health Report',
    data: sampleData,
    headerActions: (
      <Button variant="outline" size="sm">
        Refresh
      </Button>
    ),
  },
}

/**
 * Table with null values — displayed as dashes.
 */
export const WithNullValues: Story = {
  args: {
    title: 'Partial Results',
    data: [
      { hostname: 'prod-web-01', ip_address: '10.0.1.12', cpu_usage: 45, notes: null },
      { hostname: 'prod-web-02', ip_address: null, cpu_usage: 78, notes: 'High load' },
      { hostname: 'prod-db-01', ip_address: '10.0.2.5', cpu_usage: null, notes: null },
    ],
  },
}

/**
 * Single row of data.
 */
export const SingleRow: Story = {
  args: {
    title: 'Single Result',
    data: [sampleData[0]],
  },
}
