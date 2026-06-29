import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { InfoCard } from '../components'
import { ShieldCheckIcon } from '../components/icons-v2-generated/security'
import { FlamingoLogo } from '../components/icons'

const meta = {
  title: 'UI/InfoCard',
  component: InfoCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A dark-themed info card showing a title, optional subtitle, label/value rows with dotted leaders, optional copy buttons, an optional progress bar, and an optional footer with an icon, text, trailing logo, and external link, separated by a divider line.',
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
    <div className="w-80">
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
    <div className="w-80">
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
    <div className="w-80">
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
      footer: {
        icon: <ShieldCheckIcon size={24} className="text-ods-success" />,
        text: 'Signed by Flamingo',
        logo: <FlamingoLogo width={24} height={24} />,
        link: { href: 'https://github.com/flamingo-ai/fleetdm' },
      },
    },
  },
  render: (args) => (
    <div className="w-96">
      <InfoCard {...args} />
    </div>
  ),
}

export const WithItemIcon: Story = {
  args: {
    data: {
      items: [
        { label: 'toolEventId', value: 'fleet_67890abcdef123456' },
        { label: 'ingestDay', value: '2024-01-20' },
        {
          label: 'toolType',
          value: 'Fleet',
          icon: <ShieldCheckIcon size={16} className="text-ods-text-secondary" />,
        },
        { label: 'severity', value: 'ERROR' },
      ],
    },
  },
  render: (args) => (
    <div className="w-96">
      <InfoCard {...args} />
    </div>
  ),
}

export const WithFooter: Story = {
  args: {
    data: {
      title: 'Fleet',
      items: [
        { label: 'Status', value: 'ONLINE' },
        { label: 'Last seen', value: '06/11/26 9:35 AM' },
        { label: 'ID', value: '7', copyable: true },
        { label: 'Version', value: '0.1.8' },
      ],
      footer: {
        icon: <ShieldCheckIcon size={24} className="text-ods-success" />,
        text: 'Signed by Flamingo',
        logo: <FlamingoLogo width={24} height={24} />,
        link: { href: 'https://github.com/flamingo-ai/fleetdm' },
      },
    },
  },
  render: (args) => (
    <div className="w-96">
      <InfoCard {...args} />
    </div>
  ),
}

export const WithFooterWithoutLink: Story = {
  args: {
    data: {
      title: 'Fleet',
      items: [
        { label: 'Status', value: 'ONLINE' },
        { label: 'Version', value: '0.1.8' },
      ],
      footer: {
        icon: <ShieldCheckIcon size={24} className="text-ods-success" />,
        text: 'Signed by Flamingo',
        logo: <FlamingoLogo width={24} height={24} />,
      },
    },
  },
  render: (args) => (
    <div className="w-96">
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