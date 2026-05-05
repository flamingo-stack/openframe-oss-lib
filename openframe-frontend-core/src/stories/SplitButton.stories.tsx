import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ChevronDown, ExternalLink, MoreVertical, Save, Trash2 } from 'lucide-react'
import React from 'react'
import { SplitButton } from '../components/ui/button'

const meta = {
  title: 'UI/SplitButton',
  component: SplitButton,
  argTypes: {
    variant: {
      control: 'select',
      options: ['accent', 'outline', 'transparent', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['default', 'small'],
    },
    fullWidth: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof SplitButton>

export default meta
type Story = StoryObj<typeof meta>

const newTabAction = {
  icon: <ExternalLink />,
  'aria-label': 'Open in new tab',
  href: 'https://example.com',
  openInNewTab: true,
}

const dropdownAction = {
  icon: <ChevronDown />,
  'aria-label': 'More options',
  onClick: () => alert('Open menu'),
}

export const Accent: Story = {
  args: {
    children: 'Open',
    variant: 'accent',
    onClick: () => alert('Main click'),
    iconAction: newTabAction,
  },
}

export const Outline: Story = {
  args: {
    children: 'Open',
    variant: 'outline',
    onClick: () => alert('Main click'),
    iconAction: newTabAction,
  },
}

export const Transparent: Story = {
  args: {
    children: 'Open',
    variant: 'transparent',
    onClick: () => alert('Main click'),
    iconAction: newTabAction,
  },
}

export const Destructive: Story = {
  args: {
    children: 'Delete',
    variant: 'destructive',
    leftIcon: <Trash2 />,
    onClick: () => alert('Delete'),
    iconAction: {
      icon: <MoreVertical />,
      'aria-label': 'More delete options',
      onClick: () => alert('Menu'),
    },
  },
}

export const SizeSmall: Story = {
  args: {
    children: 'Open',
    size: 'small',
    onClick: () => alert('Main click'),
    iconAction: newTabAction,
  },
}

export const AsLink: Story = {
  args: {
    children: 'Documentation',
    variant: 'outline',
    href: '/docs',
    iconAction: newTabAction,
  },
}

export const WithLeftIcon: Story = {
  args: {
    children: 'Save',
    leftIcon: <Save />,
    onClick: () => alert('Save'),
    iconAction: dropdownAction,
  },
}

export const Disabled: Story = {
  args: {
    children: 'Open',
    disabled: true,
    onClick: () => alert('Main'),
    iconAction: newTabAction,
  },
}

export const IconActionDisabled: Story = {
  args: {
    children: 'Save',
    onClick: () => alert('Main'),
    iconAction: { ...dropdownAction, disabled: true },
  },
}

export const AllVariants: Story = {
  args: { children: 'Button', iconAction: newTabAction },
  render: () => {
    const variants = ['accent', 'outline', 'transparent', 'destructive'] as const
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto auto', gap: '1rem', alignItems: 'center', justifyItems: 'start' }}>
        {variants.map((variant) => (
          <React.Fragment key={variant}>
            <SplitButton variant={variant} onClick={() => {}} iconAction={newTabAction}>
              {variant}
            </SplitButton>
            <SplitButton variant={variant} disabled onClick={() => {}} iconAction={newTabAction}>
              {variant}
            </SplitButton>
            <SplitButton variant={variant} size="small" onClick={() => {}} iconAction={newTabAction}>
              {variant}
            </SplitButton>
            <SplitButton variant={variant} size="small" disabled onClick={() => {}} iconAction={newTabAction}>
              {variant}
            </SplitButton>
          </React.Fragment>
        ))}
      </div>
    )
  },
}

export const TwoActions: Story = {
  args: { children: 'Two actions', iconAction: newTabAction },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
      <SplitButton
        variant="accent"
        href="/docs"
        iconAction={{
          icon: <ExternalLink />,
          'aria-label': 'Open docs in new tab',
          href: '/docs',
          openInNewTab: true,
        }}
      >
        View docs
      </SplitButton>
      <SplitButton
        variant="outline"
        onClick={() => alert('Save')}
        leftIcon={<Save />}
        iconAction={{
          icon: <ChevronDown />,
          'aria-label': 'Save options',
          onClick: () => alert('Menu'),
        }}
      >
        Save
      </SplitButton>
    </div>
  ),
}
