import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DeviceCard, type Device } from '../components/ui/device-card'

const meta = {
  title: 'UI/DeviceCard',
  component: DeviceCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A card component for displaying device information including name, OS type, organization, status, and custom actions.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    device: {
      control: 'object',
      description: 'Device data object',
    },
    actions: {
      control: 'object',
      description: 'Action button configurations',
    },
    statusBadgeComponent: {
      control: false,
      description: 'Custom status badge component',
    },
    onDeviceClick: {
      action: 'deviceClicked',
      description: 'Callback when device card is clicked',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeviceCard>

export default meta
type Story = StoryObj<typeof meta>

const baseDevice: Device = {
  id: '1',
  name: 'MacBook Pro',
  operatingSystem: 'darwin',
  organization: 'Engineering Team',
  status: 'active',
  lastSeen: new Date().toISOString(),
}

/**
 * Default device card with basic information.
 */
export const Default: Story = {
  args: {
    device: baseDevice,
  },
}

/**
 * Windows device.
 */
export const WindowsDevice: Story = {
  args: {
    device: {
      ...baseDevice,
      id: '2',
      name: 'Dell XPS 15',
      operatingSystem: 'windows',
      organization: 'Sales Team',
    },
  },
}

/**
 * Linux device.
 */
export const LinuxDevice: Story = {
  args: {
    device: {
      ...baseDevice,
      id: '3',
      name: 'Ubuntu Server',
      operatingSystem: 'linux',
      organization: 'DevOps',
    },
  },
}

/**
 * Device with tags.
 */
export const WithTags: Story = {
  args: {
    device: {
      ...baseDevice,
      tags: ['Production', 'Critical', 'Monitored'],
    },
  },
}

/**
 * Device with custom action buttons.
 */
export const WithCustomActions: Story = {
  args: {
    device: baseDevice,
    actions: {
      moreButton: { visible: true },
      customActions: [
        { label: 'Remote Access', visible: true },
        { label: 'Run Script', visible: true },
      ],
    },
  },
}

/**
 * Device without more button.
 */
export const NoMoreButton: Story = {
  args: {
    device: baseDevice,
    actions: {
      moreButton: { visible: false },
    },
  },
}

/**
 * Clickable device card.
 */
export const Clickable: Story = {
  args: {
    device: baseDevice,
    onDeviceClick: (device) => console.log('Device clicked:', device),
  },
}

/**
 * Device with status badge.
 */
export const WithStatusBadge: Story = {
  args: {
    device: baseDevice,
    statusBadgeComponent: (
      <div className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-sm font-medium">
        Online
      </div>
    ),
  },
}

/**
 * Device with warning status badge.
 */
export const WithWarningStatus: Story = {
  args: {
    device: {
      ...baseDevice,
      status: 'warning',
    },
    statusBadgeComponent: (
      <div className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded text-sm font-medium">
        Warning
      </div>
    ),
  },
}

/**
 * Device with offline status.
 */
export const OfflineDevice: Story = {
  args: {
    device: {
      ...baseDevice,
      status: 'offline',
      lastSeen: new Date(Date.now() - 86400000 * 7).toISOString(), // 7 days ago
    },
    statusBadgeComponent: (
      <div className="bg-gray-500/20 text-gray-500 px-2 py-1 rounded text-sm font-medium">
        Offline
      </div>
    ),
  },
}

/**
 * Minimal device card with just name and OS.
 */
export const Minimal: Story = {
  args: {
    device: {
      name: 'Test Device',
      operatingSystem: 'windows',
    },
    actions: {
      moreButton: { visible: false },
    },
  },
}

/**
 * Device with all information.
 */
export const FullyLoaded: Story = {
  args: {
    device: {
      id: 'full-1',
      machineId: 'machine-abc-123',
      name: 'Production Server 01',
      type: 'server',
      operatingSystem: 'linux',
      organization: 'Infrastructure Team',
      status: 'active',
      lastSeen: new Date().toISOString(),
      tags: ['Production', 'Critical', 'Auto-Managed'],
      ipAddress: '192.168.1.100',
      version: '22.04 LTS',
      location: 'US-East-1',
    },
    actions: {
      moreButton: { visible: true },
      customActions: [
        { label: 'SSH', visible: true },
        { label: 'Logs', visible: true },
        { label: 'Restart', visible: true },
      ],
    },
    statusBadgeComponent: (
      <div className="bg-green-500/20 text-green-500 px-2 py-1 rounded text-sm font-medium">
        Healthy
      </div>
    ),
    onDeviceClick: (device) => console.log('Device clicked:', device),
  },
}

/**
 * Multiple device cards in a grid.
 */
export const CardGrid: Story = {
  args: {
    device: baseDevice,
  },
  decorators: [
    () => (
      <div style={{ width: '850px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
        <DeviceCard
          device={{
            name: 'MacBook Pro',
            operatingSystem: 'darwin',
            organization: 'Engineering',
            lastSeen: new Date().toISOString(),
          }}
        />
        <DeviceCard
          device={{
            name: 'Dell XPS 15',
            operatingSystem: 'windows',
            organization: 'Sales',
            lastSeen: new Date().toISOString(),
          }}
        />
        <DeviceCard
          device={{
            name: 'Ubuntu Server',
            operatingSystem: 'linux',
            organization: 'DevOps',
            lastSeen: new Date().toISOString(),
            tags: ['Production'],
          }}
        />
        <DeviceCard
          device={{
            name: 'Windows Server',
            operatingSystem: 'windows',
            organization: 'IT',
            lastSeen: new Date(Date.now() - 3600000).toISOString(),
          }}
        />
      </div>
    ),
  ],
}
