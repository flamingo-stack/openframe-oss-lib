import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Bell, ChevronDown, ChevronRight, Download, ExternalLink as ExternalLinkIcon, Heart, Menu, MessageSquare, Plus, Search, Settings, ShoppingCart, Trash2, X } from 'lucide-react';
import React from 'react';
import { Button } from '../components/ui/button';

const meta = {
  title: 'UI/Button',
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['accent', 'outline', 'transparent', 'destructive'],
    },
    size: {
      control: 'select',
      options: ['default', 'small', 'icon'],
    },
    fullWidth: { control: 'boolean' },
    disabled: { control: 'boolean' },
    loading: { control: 'boolean' },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// === Surface variants ===

export const Accent: Story = {
  args: { children: 'Button', variant: 'accent' },
};

export const Outline: Story = {
  args: { children: 'Button', variant: 'outline' },
};

export const Transparent: Story = {
  args: { children: 'Button', variant: 'transparent' },
};

export const Destructive: Story = {
  args: { children: 'Delete', variant: 'destructive', leftIcon: <Trash2 /> },
};

// === Sizes ===

export const SizeDefault: Story = {
  args: { children: 'Button', size: 'default' },
};

export const SizeSmall: Story = {
  args: { children: 'Button', size: 'small' },
};

// === Icon-only ===

export const IconOnly: Story = {
  args: { leftIcon: <Settings />, size: 'icon', variant: 'outline' },
};

// === With icons ===

export const WithLeftIcon: Story = {
  args: { children: 'Add Item', leftIcon: <Plus /> },
};

export const WithRightIcon: Story = {
  args: { children: 'Next', rightIcon: <ChevronRight /> },
};

export const WithBothIcons: Story = {
  args: { children: 'Download', leftIcon: <Download />, rightIcon: <ChevronRight /> },
};

// === States ===

export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
};

export const Loading: Story = {
  args: { children: 'Loading...', loading: true },
};

export const FullWidth: Story = {
  args: { children: 'Full Width', fullWidth: true },
};

// === SplitIcon (single click target with visual divider) ===

export const SplitIcon: Story = {
  args: { children: 'Save', splitIcon: <ChevronDown /> },
}

export const SplitIconOutline: Story = {
  args: { children: 'Open', variant: 'outline', splitIcon: <ExternalLinkIcon /> },
}

export const SplitIconAsLink: Story = {
  args: { children: 'Documentation', href: '/docs', splitIcon: <ExternalLinkIcon /> },
}

export const SplitIconSmall: Story = {
  args: { children: 'Save', size: 'small', splitIcon: <ChevronDown /> },
}

// === As link ===

export const AsLink: Story = {
  args: { children: 'Go to Home', href: '/' },
};

export const ExternalLink: Story = {
  args: { children: 'External Link', href: 'https://example.com', openInNewTab: true },
};

// === Showcase ===

export const AllVariants: Story = {
  args: { children: 'Button' },
  render: () => {
    const variants = ['accent', 'outline', 'transparent', 'destructive'] as const
    const labels: Record<typeof variants[number], string> = {
      accent: 'Accent',
      outline: 'Outline',
      transparent: 'Transparent',
      destructive: 'Destructive',
    }
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gap: '1rem', alignItems: 'center', justifyItems: 'start' }}>
        {variants.map((variant) => (
          <React.Fragment key={variant}>
            <Button variant={variant}>{labels[variant]}</Button>
            <Button variant={variant} disabled>{labels[variant]}</Button>
            <Button variant={variant} loading>{labels[variant]}</Button>
          </React.Fragment>
        ))}
      </div>
    )
  },
};

export const AllSizes: Story = {
  args: { children: 'Button' },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button size="small-legacy">Small</Button>
      <Button size="default">Default</Button>
      <Button size="icon" leftIcon={<Settings />} aria-label="Settings" />
    </div>
  ),
};

export const IconButtonGrid: Story = {
  args: { children: 'Icon' },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button variant="accent" size="icon" leftIcon={<Plus />} aria-label="Add" />
      <Button variant="outline" size="icon" leftIcon={<Settings />} aria-label="Settings" />
      <Button variant="transparent" size="icon" leftIcon={<Menu />} aria-label="Menu" />
      <Button variant="destructive" size="icon" leftIcon={<Trash2 />} aria-label="Delete" />
    </div>
  ),
};

export const WithIconsShowcase: Story = {
  args: { children: 'Button' },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
      <Button leftIcon={<Plus />}>Add Item</Button>
      <Button variant="outline" rightIcon={<ChevronRight />}>Continue</Button>
      <Button leftIcon={<Download />} rightIcon={<ChevronRight />}>Download All</Button>
      <Button variant="destructive" leftIcon={<Trash2 />}>Delete</Button>
      <Button variant="outline" leftIcon={<Search />}>Search</Button>
    </div>
  ),
};

export const StatesShowcase: Story = {
  args: { children: 'Button' },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>
      <Button>Normal</Button>
      <Button disabled>Disabled</Button>
      <Button loading>Loading</Button>
    </div>
  ),
};

export const NotificationCounters: Story = {
  args: { children: 'Counter' },
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <Button variant="outline" leftIcon={<Bell />}>3</Button>
      <Button variant="outline" leftIcon={<MessageSquare />}>12</Button>
      <Button variant="accent" leftIcon={<ShoppingCart />}>5</Button>
      <Button variant="transparent" leftIcon={<Heart />}>99</Button>
    </div>
  ),
};
