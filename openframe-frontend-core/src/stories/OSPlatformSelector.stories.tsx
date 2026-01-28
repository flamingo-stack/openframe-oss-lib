import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { OSPlatformSelector } from '../components/features/os-platform-selector'
import type { OSPlatformId } from '../utils/os-platforms'

const meta = {
  title: 'Features/OSPlatformSelector',
  component: OSPlatformSelector,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A tab-style selector for choosing operating system platform. Supports disabled states with badges and consistent ODS styling.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: 'select',
      options: ['windows', 'darwin', 'linux'],
      description: 'Currently selected platform',
    },
    label: {
      control: 'text',
      description: 'Label displayed above the selector',
    },
    disabledPlatforms: {
      control: 'object',
      description: 'Array of disabled platform IDs',
    },
    iconSize: {
      control: 'text',
      description: 'Icon size class (default: w-5 h-5)',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for the container',
    },
  },
} satisfies Meta<typeof OSPlatformSelector>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Interactive wrapper for stories that need state management.
 */
const InteractiveSelector = ({
  initialValue = 'darwin',
  ...props
}: Omit<React.ComponentProps<typeof OSPlatformSelector>, 'value' | 'onValueChange'> & {
  initialValue?: OSPlatformId
}) => {
  const [value, setValue] = useState<OSPlatformId>(initialValue)
  return <OSPlatformSelector value={value} onValueChange={setValue} {...props} />
}

/**
 * Default OSPlatformSelector with macOS selected.
 */
export const Default: Story = {
  args: {
    value: 'darwin',
    onValueChange: () => {},
  },
  render: (args) => <InteractiveSelector initialValue={args.value} />,
}

/**
 * Selector with a label.
 */
export const WithLabel: Story = {
  args: {
    value: 'darwin',
    label: 'Select Platform',
    onValueChange: () => {},
  },
  render: (args) => <InteractiveSelector initialValue={args.value} label={args.label} />,
}

/**
 * Selector with Windows selected.
 */
export const WindowsSelected: Story = {
  args: {
    value: 'windows',
    onValueChange: () => {},
  },
  render: (args) => <InteractiveSelector initialValue={args.value} />,
}

/**
 * Selector with Linux selected.
 */
export const LinuxSelected: Story = {
  args: {
    value: 'linux',
    onValueChange: () => {},
  },
  render: (args) => <InteractiveSelector initialValue={args.value} />,
}

/**
 * Selector with Linux disabled.
 */
export const WithDisabledPlatform: Story = {
  args: {
    value: 'darwin',
    disabledPlatforms: ['linux'],
    onValueChange: () => {},
  },
  render: (args) => (
    <InteractiveSelector initialValue={args.value} disabledPlatforms={args.disabledPlatforms} />
  ),
}

/**
 * Selector with custom options including a "Coming Soon" badge.
 */
export const WithBadge: Story = {
  args: {
    value: 'darwin',
    onValueChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState<OSPlatformId>('darwin')
    return (
      <OSPlatformSelector
        value={value}
        onValueChange={setValue}
        label="Select Platform"
        options={[
          { platformId: 'windows' },
          { platformId: 'darwin' },
          { platformId: 'linux', disabled: true, badge: { text: 'Coming Soon', colorScheme: 'cyan' } },
        ]}
      />
    )
  },
}

/**
 * Selector with multiple disabled platforms and badges.
 */
export const MultipleBadges: Story = {
  args: {
    value: 'windows',
    onValueChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState<OSPlatformId>('windows')
    return (
      <OSPlatformSelector
        value={value}
        onValueChange={setValue}
        label="Choose OS"
        options={[
          { platformId: 'windows' },
          { platformId: 'darwin', disabled: true, badge: { text: 'Beta', colorScheme: 'yellow' } },
          { platformId: 'linux', disabled: true, badge: { text: 'Coming Soon', colorScheme: 'cyan' } },
        ]}
      />
    )
  },
}

/**
 * Selector with larger icons.
 */
export const LargeIcons: Story = {
  args: {
    value: 'darwin',
    iconSize: 'w-6 h-6',
    onValueChange: () => {},
  },
  render: (args) => <InteractiveSelector initialValue={args.value} iconSize={args.iconSize} />,
}

/**
 * Selector with smaller icons.
 */
export const SmallIcons: Story = {
  args: {
    value: 'darwin',
    iconSize: 'w-4 h-4',
    onValueChange: () => {},
  },
  render: (args) => <InteractiveSelector initialValue={args.value} iconSize={args.iconSize} />,
}

/**
 * Full width selector in a container.
 */
export const FullWidth: Story = {
  args: {
    value: 'darwin',
    onValueChange: () => {},
  },
  render: () => {
    const [value, setValue] = useState<OSPlatformId>('darwin')
    return (
      <div style={{ width: '500px' }}>
        <OSPlatformSelector
          value={value}
          onValueChange={setValue}
          label="Select Your Operating System"
        />
      </div>
    )
  },
}
