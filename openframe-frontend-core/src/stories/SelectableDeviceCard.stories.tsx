import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { SelectableDeviceCard } from '../components/ui/selectable-device-card'
import { Monitor } from 'lucide-react'

const meta = {
  title: 'UI/SelectableDeviceCard',
  component: SelectableDeviceCard,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A selectable card component for displaying device options with title, subtitle, and device type icon.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'The main title of the card',
    },
    subtitle: {
      control: 'text',
      description: 'Optional subtitle displayed below the title',
    },
    type: {
      control: 'select',
      options: ['desktop', 'laptop', 'mobile', 'tablet', 'server'],
      description: 'Device type for automatic icon selection',
    },
    selected: {
      control: 'boolean',
      description: 'Whether the card is selected',
    },
    onSelect: {
      action: 'selected',
      description: 'Callback when the card is clicked',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '320px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SelectableDeviceCard>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default unselected state.
 */
export const Default: Story = {
  args: {
    title: 'MacBook Pro',
    type: 'laptop',
  },
}

/**
 * Selected state with highlight styling.
 */
export const Selected: Story = {
  args: {
    title: 'MacBook Pro',
    type: 'laptop',
    selected: true,
  },
}

/**
 * Card with subtitle.
 */
export const WithSubtitle: Story = {
  args: {
    title: 'Production Server',
    subtitle: '192.168.1.100',
    type: 'server',
  },
}

/**
 * Selected card with subtitle.
 */
export const SelectedWithSubtitle: Story = {
  args: {
    title: 'Production Server',
    subtitle: '192.168.1.100',
    type: 'server',
    selected: true,
  },
}

/**
 * Desktop device type.
 */
export const DesktopType: Story = {
  args: {
    title: 'Office Desktop',
    subtitle: 'Engineering Team',
    type: 'desktop',
  },
}

/**
 * Server device type.
 */
export const ServerType: Story = {
  args: {
    title: 'Ubuntu Server',
    subtitle: 'DevOps',
    type: 'server',
  },
}

/**
 * Card with custom icon.
 */
export const WithCustomIcon: Story = {
  args: {
    title: 'Custom Device',
    subtitle: 'Using custom icon',
    icon: <Monitor className="size-6" />,
  },
}

/**
 * Interactive example with toggle selection.
 */
export const Interactive: Story = {
  args: {
    title: 'Click to select',
    type: 'laptop',
  },
  render: (args) => {
    const [selected, setSelected] = useState(false)
    return (
      <SelectableDeviceCard
        {...args}
        selected={selected}
        onSelect={() => setSelected(!selected)}
      />
    )
  },
}

/**
 * Multiple cards for selection.
 */
export const SelectionGroup: Story = {
  args: {
    title: 'Device',
    type: 'laptop',
  },
  decorators: [
    () => {
      const [selectedId, setSelectedId] = useState<string | null>(null)

      const devices = [
        { id: '1', title: 'MacBook Pro', subtitle: 'Engineering', type: 'laptop' as const },
        { id: '2', title: 'Office Desktop', subtitle: 'Sales', type: 'desktop' as const },
        { id: '3', title: 'Production Server', subtitle: 'DevOps', type: 'server' as const },
      ]

      return (
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {devices.map((device) => (
            <SelectableDeviceCard
              key={device.id}
              title={device.title}
              subtitle={device.subtitle}
              type={device.type}
              selected={selectedId === device.id}
              onSelect={() => setSelectedId(device.id)}
            />
          ))}
        </div>
      )
    },
  ],
}
