import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { DotsLoaderIcon } from '../components/icons-v2-generated/loaders/dots-loader-icon';

const meta = {
  title: 'UI/DotsLoaderIcon',
  component: DotsLoaderIcon,
  argTypes: {
    size: {
      control: { type: 'number', min: 12, max: 128, step: 4 },
    },
    color: {
      control: 'text',
      description: 'CSS color. Defaults to `currentColor` — pass an ODS token like `var(--ods-accent)`.',
    },
    className: { control: 'text' },
  },
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof DotsLoaderIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default — 24px, inherits text color via `currentColor`.
 * The three dots animate in an infinite loop (SMIL chain).
 */
export const Default: Story = {
  args: {
    size: 24,
  },
};

/**
 * Large size for full-page / blocking loading states.
 */
export const Large: Story = {
  args: {
    size: 64,
  },
};

/**
 * Inherits the surrounding text color through `currentColor`.
 */
export const InheritsTextColor: Story = {
  args: {
    size: 40,
  },
  render: (args) => (
    <div className="text-ods-accent">
      <DotsLoaderIcon {...args} />
    </div>
  ),
};

/**
 * Explicit ODS color tokens — never hardcode hex.
 */
export const OdsColors: Story = {
  args: {
    size: 40,
  },
  render: (args) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
      <DotsLoaderIcon {...args} color="var(--ods-text-primary)" />
      <DotsLoaderIcon {...args} color="var(--ods-text-secondary)" />
      <DotsLoaderIcon {...args} color="var(--ods-accent)" />
      <DotsLoaderIcon {...args} color="var(--ods-error)" />
    </div>
  ),
};

/**
 * Size scale.
 */
export const Sizes: Story = {
  args: {},
  render: () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
      <DotsLoaderIcon size={16} />
      <DotsLoaderIcon size={24} />
      <DotsLoaderIcon size={40} />
      <DotsLoaderIcon size={64} />
      <DotsLoaderIcon size={96} />
    </div>
  ),
};

/**
 * In context — centered inside a card, as used for inline loading.
 */
export const InCard: Story = {
  args: {
    size: 32,
  },
  render: (args) => (
    <div className="flex items-center justify-center bg-ods-card border border-ods-border rounded-lg w-64 h-40 text-ods-text-secondary">
      <DotsLoaderIcon {...args} />
    </div>
  ),
};
