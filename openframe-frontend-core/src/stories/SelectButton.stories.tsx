import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { SelectButton } from '../components/features/select-button'
import { Smile, Monitor, Globe, Zap } from 'lucide-react'

const meta = {
  title: 'Features/SelectButton',
  component: SelectButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
    selected: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof SelectButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Option',
    description: 'Description text',
    selected: false,
  },
}

export const Selected: Story = {
  args: {
    title: 'Option',
    description: 'Description text',
    selected: true,
  },
}

export const WithIcon: Story = {
  args: {
    title: 'Option',
    description: 'Description text',
    icon: <Smile size={24} />,
  },
}

export const WithIconSelected: Story = {
  args: {
    title: 'Option',
    description: 'Description text',
    icon: <Smile size={24} />,
    selected: true,
  },
}

export const WithImage: Story = {
  args: {
    title: 'Option',
    description: 'Description text',
    image: {
      src: 'https://placehold.co/40x40/212121/fafafa?text=Img',
      alt: 'Sample',
    },
  },
}

export const WithImageSelected: Story = {
  args: {
    title: 'Option',
    description: 'Description text',
    image: {
      src: 'https://placehold.co/40x40/212121/fafafa?text=Img',
      alt: 'Sample',
    },
    selected: true,
  },
}

export const NoDescription: Story = {
  args: {
    title: 'Title Only',
  },
}

export const Disabled: Story = {
  args: {
    title: 'Disabled',
    description: 'Cannot select',
    disabled: true,
  },
}

export const IconWithTitleOnly: Story = {
  args: {
    title: 'Option',
    icon: <Smile size={24} />,
  },
}

export const InteractiveGroup = {
  render: () => {
    const [selectedId, setSelectedId] = useState<string | null>('monitor')

    const options = [
      { id: 'monitor', title: 'Monitor', description: 'System monitoring', icon: <Monitor size={24} /> },
      { id: 'web', title: 'Web App', description: 'Browser based', icon: <Globe size={24} /> },
      { id: 'api', title: 'API', description: 'REST endpoints', icon: <Zap size={24} /> },
    ]

    return (
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <SelectButton
            key={option.id}
            title={option.title}
            description={option.description}
            icon={option.icon}
            selected={selectedId === option.id}
            onClick={() => setSelectedId(option.id)}
          />
        ))}
      </div>
    )
  },
}

export const InteractiveIconTitleOnly = {
  render: () => {
    const [selectedId, setSelectedId] = useState<string | null>('monitor')

    const options = [
      { id: 'monitor', title: 'Monitor', icon: <Monitor size={24} /> },
      { id: 'web', title: 'Web App', icon: <Globe size={24} /> },
      { id: 'api', title: 'API', icon: <Zap size={24} /> },
    ]

    return (
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <SelectButton
            key={option.id}
            title={option.title}
            icon={option.icon}
            selected={selectedId === option.id}
            onClick={() => setSelectedId(option.id)}
          />
        ))}
      </div>
    )
  },
}
