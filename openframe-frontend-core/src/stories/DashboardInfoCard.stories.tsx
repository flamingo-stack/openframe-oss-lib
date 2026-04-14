import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DashboardInfoCard } from '../components/ui/dashboard-info-card'

const meta = {
  title: 'UI/DashboardInfoCard',
  component: DashboardInfoCard,
  parameters: {
    docs: {
      description: {
        component:
          'A compact info card for dashboards showing a title, value, optional percentage, progress indicator, and tooltip. Supports navigation via href using Next.js Link.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text', description: 'Card title' },
    value: { control: 'text', description: 'Primary value to display' },
    percentage: { control: 'number', description: 'Optional percentage value' },
    showProgress: { control: 'boolean', description: 'Show circular progress indicator' },
    progressColor: { control: 'color', description: 'Color of the circular progress' },
    href: { control: 'text', description: 'Navigation URL — renders as a Next.js Link with pointer cursor' },
    tooltip: { control: 'text', description: 'Tooltip content for the question-mark icon' },
    valueClassName: { control: 'text', description: 'Override className for the value text' },
  },
} satisfies Meta<typeof DashboardInfoCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default card with a title and numeric value.
 */
export const Default: Story = {
  args: {
    title: 'Total Devices',
    value: 1284,
  },
}

/**
 * Card with a string value.
 */
export const StringValue: Story = {
  args: {
    title: 'Status',
    value: 'Healthy',
  },
}

/**
 * Card displaying a percentage alongside the value.
 */
export const WithPercentage: Story = {
  args: {
    title: 'Uptime',
    value: 342,
    percentage: 97,
  },
}

/**
 * Card with circular progress indicator.
 */
export const WithProgress: Story = {
  args: {
    title: 'Storage Used',
    value: '128 GB',
    percentage: 64,
    showProgress: true,
  },
}

/**
 * Card with a custom progress color.
 */
export const CustomProgressColor: Story = {
  args: {
    title: 'CPU Usage',
    value: '78%',
    percentage: 78,
    showProgress: true,
    progressColor: '#FF6B6B',
  },
}

/**
 * Card with a tooltip on the value.
 */
export const WithTooltip: Story = {
  args: {
    title: 'Active Users',
    value: 56,
    tooltip: 'Users who logged in within the last 30 days',
  },
}

/**
 * Clickable card with href — renders as a Link with pointer cursor and hover accent.
 */
export const WithHref: Story = {
  args: {
    title: 'Open Tickets',
    value: 23,
    href: '/tickets',
  },
}

/**
 * Card without href — no pointer cursor, no hover accent.
 */
export const NonClickable: Story = {
  args: {
    title: 'Total Revenue',
    value: '$12,400',
  },
}

/**
 * Card with all features enabled.
 */
export const FullyLoaded: Story = {
  args: {
    title: 'Compliance Score',
    value: 92,
    percentage: 92,
    showProgress: true,
    progressColor: '#00D4AA',
    tooltip: 'Based on the latest audit results',
    href: '/compliance',
  },
}

/**
 * Multiple cards in a dashboard grid layout.
 */
export const CardGrid: Story = {
  args: {
    title: 'Devices',
    value: 120,
  },
  decorators: [
    () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', width: '900px' }}>
        <DashboardInfoCard title="Total Devices" value={1284} href="/devices" />
        <DashboardInfoCard title="Active" value={1180} percentage={92} />
        <DashboardInfoCard title="Offline" value={104} percentage={8} showProgress progressColor="#FF6B6B" />
        <DashboardInfoCard title="Tickets" value={23} href="/tickets" />
        <DashboardInfoCard title="Alerts" value={7} tooltip="Unresolved alerts from the last 24h" />
        <DashboardInfoCard title="Uptime" value="99.2%" percentage={99} showProgress />
      </div>
    ),
  ],
}
