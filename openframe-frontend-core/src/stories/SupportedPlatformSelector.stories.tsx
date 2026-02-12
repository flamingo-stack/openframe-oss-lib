import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { SupportedPlatformSelector } from '../components/features/supported-platform-selector'
import { CheckboxBlock } from '../components/ui/checkbox-block'
import type { OSPlatformId } from '../utils/os-platforms'

const meta = {
  title: 'Features/SupportedPlatformSelector',
  component: SupportedPlatformSelector,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A multi-select platform toggle for choosing supported operating systems. Each platform can be toggled independently. Responsive: compact on mobile, full-size on tablet+. Combine with CheckboxBlock for additional options.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SupportedPlatformSelector>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Default tablet/desktop view with one platform selected.
 */
export const Default: Story = {
  args: {
    value: ['linux'],
    onValueChange: () => {},
  },
  render: () => {
    const [platforms, setPlatforms] = useState<OSPlatformId[]>(['linux'])
    return (
      <div style={{ width: '700px' }}>
        <SupportedPlatformSelector
          value={platforms}
          onValueChange={setPlatforms}
          label="Supported Platform"
        />
      </div>
    )
  },
}

/**
 * All platforms selected.
 */
export const AllSelected: Story = {
  args: {
    value: ['windows', 'darwin', 'linux'],
    onValueChange: () => {},
  },
  render: () => {
    const [platforms, setPlatforms] = useState<OSPlatformId[]>(['windows', 'darwin', 'linux'])
    return (
      <div style={{ width: '700px' }}>
        <SupportedPlatformSelector
          value={platforms}
          onValueChange={setPlatforms}
          label="Supported Platform"
        />
      </div>
    )
  },
}

/**
 * Mobile viewport (398px) — compact h-12 buttons with smaller text.
 */
export const Mobile: Story = {
  args: {
    value: ['linux'],
    onValueChange: () => {},
  },
  render: () => {
    const [platforms, setPlatforms] = useState<OSPlatformId[]>(['linux'])
    return (
      <div style={{ width: '398px' }}>
        <SupportedPlatformSelector
          value={platforms}
          onValueChange={setPlatforms}
          label="Supported Platform"
        />
      </div>
    )
  },
}

/**
 * Composed with CheckboxBlock for a full form row (as shown in Figma desktop).
 */
export const WithCheckboxBlock: Story = {
  args: {
    value: ['linux'],
    onValueChange: () => {},
  },
  render: () => {
    const [platforms, setPlatforms] = useState<OSPlatformId[]>(['linux'])
    const [runAsUser, setRunAsUser] = useState(false)
    return (
      <div style={{ width: '1100px' }}>
        <span className="text-ods-text-primary text-[18px] font-medium mb-2 block">
          Supported Platform
        </span>
        <div className="flex gap-4">
          <SupportedPlatformSelector
            value={platforms}
            onValueChange={setPlatforms}
            className="flex-[3]"
          />
          <CheckboxBlock
            label="Run as User"
            description="Windows Only"
            checked={runAsUser}
            onCheckedChange={setRunAsUser}
            className="flex-1"
          />
        </div>
      </div>
    )
  },
}

/**
 * No platforms selected.
 */
export const NoneSelected: Story = {
  args: {
    value: [],
    onValueChange: () => {},
  },
  render: () => {
    const [platforms, setPlatforms] = useState<OSPlatformId[]>([])
    return (
      <div style={{ width: '700px' }}>
        <SupportedPlatformSelector value={platforms} onValueChange={setPlatforms} />
      </div>
    )
  },
}

/**
 * With a disabled platform (Linux cannot be toggled).
 */
export const WithDisabledPlatform: Story = {
  args: {
    value: ['windows'],
    onValueChange: () => {},
    disabledPlatforms: ['linux'],
  },
  render: () => {
    const [platforms, setPlatforms] = useState<OSPlatformId[]>(['windows'])
    return (
      <div style={{ width: '700px' }}>
        <SupportedPlatformSelector
          value={platforms}
          onValueChange={setPlatforms}
          disabledPlatforms={['linux']}
        />
      </div>
    )
  },
}
