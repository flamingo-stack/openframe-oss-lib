import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { OSTypeBadgeGroup } from '../components/features/os-type-badge-group'

const meta = {
  title: 'Features/OSTypeBadgeGroup',
  component: OSTypeBadgeGroup,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Displays multiple OS type badges in a horizontal group. Used for showing supported platforms in scripts and other multi-OS contexts.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    osTypes: {
      control: 'object',
      description: 'Array of OS type strings (case-insensitive, handles aliases)',
    },
    iconSize: {
      control: 'text',
      description: 'Icon size class (default: w-5 h-5)',
    },
    maxDisplay: {
      control: 'number',
      description: 'Maximum number of badges to display before showing "+N more"',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes',
    },
  },
} satisfies Meta<typeof OSTypeBadgeGroup>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default with all three OS types.
 */
export const Default: Story = {
  args: {
    osTypes: ['windows', 'darwin', 'linux'],
  },
}

/**
 * Windows and macOS only.
 */
export const WindowsAndMac: Story = {
  args: {
    osTypes: ['windows', 'macos'],
  },
}

/**
 * Single OS type.
 */
export const SingleOS: Story = {
  args: {
    osTypes: ['linux'],
  },
}

/**
 * Using OS aliases - they normalize to the correct icons.
 */
export const WithAliases: Story = {
  args: {
    osTypes: ['Darwin', 'Ubuntu', 'win32'],
  },
}

/**
 * With maxDisplay limit showing "+N more".
 */
export const WithMaxDisplay: Story = {
  args: {
    osTypes: ['windows', 'darwin', 'linux'],
    maxDisplay: 2,
  },
}

/**
 * Many OS types with maxDisplay.
 */
export const ManyOSWithLimit: Story = {
  args: {
    osTypes: ['windows', 'darwin', 'linux', 'ubuntu', 'fedora'],
    maxDisplay: 3,
  },
}

/**
 * Smaller icons.
 */
export const SmallIcons: Story = {
  args: {
    osTypes: ['windows', 'darwin', 'linux'],
    iconSize: 'w-4 h-4',
  },
}

/**
 * Larger icons.
 */
export const LargeIcons: Story = {
  args: {
    osTypes: ['windows', 'darwin', 'linux'],
    iconSize: 'w-6 h-6',
  },
}

/**
 * Empty array - renders nothing.
 */
export const Empty: Story = {
  args: {
    osTypes: [],
  },
}

/**
 * Comparison of different configurations.
 */
export const Comparison: Story = {
  args: {
    osTypes: ['windows', 'darwin', 'linux'],
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>All platforms:</div>
        <OSTypeBadgeGroup osTypes={['windows', 'darwin', 'linux']} />
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>With maxDisplay=2:</div>
        <OSTypeBadgeGroup osTypes={['windows', 'darwin', 'linux']} maxDisplay={2} />
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>Small icons:</div>
        <OSTypeBadgeGroup osTypes={['windows', 'darwin', 'linux']} iconSize="w-4 h-4" />
      </div>
      <div>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '0.5rem' }}>Large icons:</div>
        <OSTypeBadgeGroup osTypes={['windows', 'darwin', 'linux']} iconSize="w-6 h-6" />
      </div>
    </div>
  ),
}
