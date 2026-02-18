import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { PageContainer } from '../components/layout/page-container';
import { Button } from '../components/ui/button';

const meta = {
  title: 'Layout/PageContainer',
  component: PageContainer,
  argTypes: {
    variant: {
      control: 'select',
      options: ['list', 'detail', 'form', 'content'],
    },
    padding: {
      control: 'select',
      options: ['none', 'sm', 'md', 'lg'],
    },
    background: {
      control: 'select',
      options: ['default', 'card', 'transparent'],
    },
    showHeader: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      <div style={{ minHeight: '400px', background: '#111' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

const PlaceholderContent = () => (
  <div className="bg-ods-card border border-ods-border rounded-lg p-6">
    <p className="text-ods-text-secondary">Page content goes here</p>
  </div>
);

// === Legacy Usage ===

/**
 * Legacy mode — basic container with full-width background.
 */
export const Legacy: Story = {
  args: {
    children: <PlaceholderContent />,
    className: 'px-6',
  },
};

/**
 * Legacy mode — custom background.
 */
export const LegacyCustomBackground: Story = {
  args: {
    children: <PlaceholderContent />,
    backgroundClassName: 'bg-ods-card',
    contentPadding: 'px-6 py-4',
  },
};

/**
 * Legacy mode — content-width background only.
 */
export const LegacyContentWidthBackground: Story = {
  args: {
    children: <PlaceholderContent />,
    fullWidthBackground: false,
    backgroundClassName: 'bg-ods-card',
    contentPadding: 'px-6 py-4',
  },
};

// === Advanced: List Variant ===

/**
 * List page with title and action buttons.
 */
export const ListPage: Story = {
  args: {
    variant: 'list',
    title: 'Devices',
    subtitle: '24 devices found',
    actions: [
      { label: 'Add Device', onClick: () => {}, icon: <Plus className="w-5 h-5" />, variant: 'primary' },
    ],
    children: <PlaceholderContent />,
  },
};

/**
 * List page with multiple actions.
 */
export const ListPageMultipleActions: Story = {
  args: {
    variant: 'list',
    title: 'Scripts',
    subtitle: 'Manage your scripts',
    actions: [
      { label: 'Edit', onClick: () => {}, icon: <Edit className="w-5 h-5" />, variant: 'outline' },
      { label: 'Create Script', onClick: () => {}, icon: <Plus className="w-5 h-5" />, variant: 'primary' },
    ],
    children: <PlaceholderContent />,
  },
};

// === Advanced: Detail Variant ===

/**
 * Detail page with back button.
 */
export const DetailPage: Story = {
  args: {
    variant: 'detail',
    title: 'Device Details',
    subtitle: 'MacBook Pro — Online',
    backButton: { label: 'Back to Devices', onClick: () => {} },
    children: <PlaceholderContent />,
  },
};

/**
 * Detail page with actions.
 */
export const DetailPageWithActions: Story = {
  args: {
    variant: 'detail',
    title: 'Script Details',
    subtitle: 'Last run: 2 hours ago',
    backButton: { onClick: () => {} },
    actions: [
      { label: 'Delete', onClick: () => {}, icon: <Trash2 className="w-5 h-5" />, variant: 'outline' },
      { label: 'Run Script', onClick: () => {}, variant: 'primary' },
    ],
    children: <PlaceholderContent />,
  },
};

// === Advanced: Form Variant ===

/**
 * Form page with back button and save action.
 */
export const FormPage: Story = {
  args: {
    variant: 'form',
    title: 'Create New Script',
    backButton: { label: 'Cancel', onClick: () => {} },
    actions: [
      { label: 'Save Draft', onClick: () => {}, variant: 'outline' },
      { label: 'Publish', onClick: () => {}, variant: 'primary' },
    ],
    children: (
      <div className="flex flex-col gap-6">
        <div className="bg-ods-card border border-ods-border rounded-lg p-6">
          <p className="text-ods-text-secondary">Form fields go here</p>
        </div>
        <div className="bg-ods-card border border-ods-border rounded-lg p-6">
          <p className="text-ods-text-secondary">More form fields</p>
        </div>
      </div>
    ),
  },
};

// === Advanced: Content Variant ===

/**
 * Content page — generic layout.
 */
export const ContentPage: Story = {
  args: {
    variant: 'content',
    title: 'Settings',
    children: <PlaceholderContent />,
  },
};

// === Header Variations ===

/**
 * Page with custom header content.
 */
export const CustomHeaderContent: Story = {
  args: {
    variant: 'list',
    headerContent: (
      <div className="flex items-center justify-between w-full">
        <h1 className="text-2xl font-bold text-ods-text-primary">Custom Header</h1>
        <Button variant="primary" size="sm">Action</Button>
      </div>
    ),
    children: <PlaceholderContent />,
  },
};

/**
 * Page with header actions as ReactNode.
 */
export const WithHeaderActions: Story = {
  args: {
    variant: 'list',
    title: 'Devices',
    headerActions: (
      <Button variant="outline" size="sm">Export</Button>
    ),
    actions: [
      { label: 'Add Device', onClick: () => {}, icon: <Plus className="w-5 h-5" />, variant: 'primary' },
    ],
    children: <PlaceholderContent />,
  },
};

/**
 * Page with header hidden.
 */
export const HiddenHeader: Story = {
  args: {
    variant: 'content',
    title: 'This title is hidden',
    showHeader: false,
    children: <PlaceholderContent />,
  },
};

// === Padding & Background ===

/**
 * Page with large padding and card background.
 */
export const WithPaddingAndBackground: Story = {
  args: {
    variant: 'content',
    title: 'Padded Page',
    padding: 'lg',
    background: 'card',
    children: <PlaceholderContent />,
  },
};
