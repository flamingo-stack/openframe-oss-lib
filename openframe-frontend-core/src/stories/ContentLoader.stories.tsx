import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { ContentLoader, CardLoader, FormLoader, DetailLoader, ListLoader } from '../components/ui/content-loader';

const meta = {
  title: 'UI/ContentLoader',
  component: ContentLoader,
  argTypes: {
    variant: {
      control: 'select',
      options: ['card', 'form', 'detail', 'list'],
    },
    items: {
      control: { type: 'number', min: 1, max: 12 },
    },
    showTitle: { control: 'boolean' },
  },
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof ContentLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Card skeleton - default variant for card-based layouts.
 */
export const Card: Story = {
  args: {
    variant: 'card',
    items: 4,
    showTitle: true,
  },
};

/**
 * Form skeleton - for form loading states.
 */
export const Form: Story = {
  args: {
    variant: 'form',
    items: 4,
    showTitle: true,
  },
};

/**
 * Detail skeleton - for detail page layouts with sidebar.
 */
export const Detail: Story = {
  args: {
    variant: 'detail',
    items: 4,
    showTitle: true,
  },
};

/**
 * List skeleton - for list-based layouts with avatars.
 */
export const List: Story = {
  args: {
    variant: 'list',
    items: 4,
    showTitle: true,
  },
};

/**
 * Without title skeleton.
 */
export const WithoutTitle: Story = {
  args: {
    variant: 'card',
    items: 4,
    showTitle: false,
  },
};

/**
 * Many items - stress test with 8 items.
 */
export const ManyItems: Story = {
  args: {
    variant: 'list',
    items: 8,
    showTitle: true,
  },
};

/**
 * Single item.
 */
export const SingleItem: Story = {
  args: {
    variant: 'card',
    items: 1,
    showTitle: true,
  },
};

/**
 * With custom container class.
 */
export const CustomContainer: Story = {
  args: {
    variant: 'form',
    items: 3,
    showTitle: true,
    containerClassName: 'bg-bg-card rounded-lg',
  },
};

/**
 * All variants displayed together.
 */
export const AllVariants: Story = {
  args: {
    variant: 'card',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Card</h3>
        <CardLoader items={3} showTitle />
      </div>
      <div>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Form</h3>
        <FormLoader items={3} showTitle />
      </div>
      <div>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>Detail</h3>
        <DetailLoader items={3} showTitle />
      </div>
      <div>
        <h3 style={{ marginBottom: '0.5rem', fontWeight: 600 }}>List</h3>
        <ListLoader items={3} showTitle />
      </div>
    </div>
  ),
};

/**
 * Shortcut components - CardLoader, FormLoader, DetailLoader, ListLoader.
 */
export const ShortcutComponents: Story = {
  args: {
    variant: 'card',
  },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <CardLoader items={2} />
      <FormLoader items={2} />
      <DetailLoader items={2} />
      <ListLoader items={2} />
    </div>
  ),
};
