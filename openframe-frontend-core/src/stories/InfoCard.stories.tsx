import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { InfoCard } from '../components'

const meta = {
  title: 'UI/InfoCard',
  component: InfoCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A dark-themed info card showing a title, optional subtitle, label/value rows with dotted leaders, optional copy buttons, and an optional progress bar.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof InfoCard>

export default meta
type Story = StoryObj<typeof meta>

export const DiskC: Story = {
  args: {
    data: {
      title: 'C:',
      subtitle: 'SSD Drive',
      items: [
        { label: 'Current Usage', value: '42.6%' },
        { label: 'Capacity', value: '931 GB' },
      ],
      progress: { value: 42.6 },
    },
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <InfoCard {...args} />
    </div>
  ),
}

export const DiskD: Story = {
  args: {
    data: {
      title: 'D:',
      subtitle: 'HDD Drive',
      items: [
        { label: 'Current Usage', value: '62.3%' },
        { label: 'Capacity', value: '931 GB' },
      ],
      progress: { value: 62.3, warningThreshold: 60, criticalThreshold: 85 },
    },
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <InfoCard {...args} />
    </div>
  ),
}

export const PhysicalRAM: Story = {
  args: {
    data: {
      title: 'Physical RAM',
      subtitle: 'DDR4-3200',
      items: [
        { label: 'Current Usage', value: '57.5%' },
        { label: 'Capacity', value: '32 GB' },
      ],
      progress: { value: 57.5 },
    },
  },
  render: (args) => (
    <div style={{ width: 320 }}>
      <InfoCard {...args} />
    </div>
  ),
}

export const WithCopyableValues: Story = {
  args: {
    data: {
      title: 'Network',
      subtitle: 'Primary interface',
      items: [
        { label: 'Hostname', value: 'srv-prod-01', copyable: true },
        { label: 'IPv4', value: '192.168.1.100', copyable: true },
        { label: 'MAC', value: '00:1A:2B:3C:4D:5E', copyable: true },
      ],
    },
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <InfoCard {...args} />
    </div>
  ),
}

export const Grid: Story = {
  args: { data: { items: [] } },
  render: () => (
    <div className="grid grid-cols-3 gap-4" style={{ width: 1000 }}>
      <InfoCard
        data={{
          title: 'C:',
          subtitle: 'SSD Drive',
          items: [
            { label: 'Current Usage', value: '42.6%' },
            { label: 'Capacity', value: '931 GB' },
          ],
          progress: { value: 42.6 },
        }}
      />
      <InfoCard
        data={{
          title: 'D:',
          subtitle: 'HDD Drive',
          items: [
            { label: 'Current Usage', value: '62.3%' },
            { label: 'Capacity', value: '931 GB' },
          ],
          progress: { value: 62.3 },
        }}
      />
      <InfoCard
        data={{
          title: 'E:',
          subtitle: 'USB Drive',
          items: [
            { label: 'Current Usage', value: '15.0%' },
            { label: 'Capacity', value: '64 GB' },
          ],
          progress: { value: 15 },
        }}
      />
    </div>
  ),
}