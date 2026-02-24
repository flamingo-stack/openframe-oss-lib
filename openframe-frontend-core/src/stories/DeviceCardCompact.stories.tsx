import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DeviceCardCompact } from '../components/ui/device-card-compact'

const meta = {
  title: 'UI/DeviceCardCompact',
  component: DeviceCardCompact,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Compact device card variant for table cells. Shows device name and organization in a stacked layout.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    deviceName: {
      control: 'text',
      description: 'Device name to display',
    },
    organization: {
      control: 'text',
      description: 'Organization name to display',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '300px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DeviceCardCompact>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default compact card with both name and organization.
 */
export const Default: Story = {
  args: {
    deviceName: 'MacBook Pro',
    organization: 'Engineering Team',
  },
}

/**
 * Card showing only the device name.
 */
export const NameOnly: Story = {
  args: {
    deviceName: 'Dell XPS 15',
  },
}

/**
 * Card showing only the organization.
 */
export const OrganizationOnly: Story = {
  args: {
    organization: 'Infrastructure Team',
  },
}

/**
 * Returns empty fragment when both values are missing.
 */
export const Empty: Story = {
  args: {},
}

/**
 * Returns empty fragment for null values.
 */
export const NullValues: Story = {
  args: {
    deviceName: null,
    organization: null,
  },
}

/**
 * Returns empty fragment for dash placeholder values.
 */
export const DashValues: Story = {
  args: {
    deviceName: '-',
    organization: '-',
  },
}

/**
 * Returns empty fragment for string 'null' values.
 */
export const StringNullValues: Story = {
  args: {
    deviceName: 'null',
    organization: 'null',
  },
}

/**
 * Device with a long name that truncates.
 */
export const LongName: Story = {
  args: {
    deviceName: 'Production Server US-East-1 Region Primary Database Host',
    organization: 'Cloud Infrastructure & Platform Engineering',
  },
}

/**
 * Multiple compact cards as they would appear in a table.
 */
export const InTableContext: Story = {
  args: {
    deviceName: 'MacBook Pro',
    organization: 'Engineering',
  },
  decorators: [
    () => (
      <div style={{ width: '400px', display: 'flex', flexDirection: 'column', border: '1px solid var(--ods-border, #e5e7eb)' }}>
        <div style={{ padding: '0 16px', borderBottom: '1px solid var(--ods-border, #e5e7eb)' }}>
          <DeviceCardCompact deviceName="MacBook Pro" organization="Engineering" />
        </div>
        <div style={{ padding: '0 16px', borderBottom: '1px solid var(--ods-border, #e5e7eb)' }}>
          <DeviceCardCompact deviceName="Dell XPS 15" organization="Sales" />
        </div>
        <div style={{ padding: '0 16px', borderBottom: '1px solid var(--ods-border, #e5e7eb)' }}>
          <DeviceCardCompact deviceName="Ubuntu Server" organization="DevOps" />
        </div>
        <div style={{ padding: '0 16px' }}>
          <DeviceCardCompact deviceName="Windows Server" organization="IT" />
        </div>
      </div>
    ),
  ],
}
