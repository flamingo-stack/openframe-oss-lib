import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Smile } from 'lucide-react';
import { Tag } from '../components/ui/tag';

const meta = {
  title: 'UI/Tag',
  component: Tag,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'outline', 'success', 'warning', 'error', 'critical', 'grey'],
    },
  },
} satisfies Meta<typeof Tag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary', children: 'Tag' },
};

export const Outline: Story = {
  args: { variant: 'outline', children: 'Tag' },
};

export const Success: Story = {
  args: { variant: 'success', children: 'Tag' },
};

export const Warning: Story = {
  args: { variant: 'warning', children: 'Tag' },
};

export const Error: Story = {
  args: { variant: 'error', children: 'Tag' },
};

export const Critical: Story = {
  args: { variant: 'critical', children: 'Tag' },
};

export const Grey: Story = {
  args: { variant: 'grey', children: 'Tag' },
};

export const WithIcon: Story = {
  args: {
    variant: 'primary',
    children: 'Tag',
    icon: <Smile className="size-5" />,
  },
};

export const WithCloseButton: Story = {
  args: {
    variant: 'primary',
    children: 'Tag',
    onClose: () => alert('close'),
  },
};

export const WithIconAndClose: Story = {
  args: {
    variant: 'success',
    children: 'Tag',
    icon: <Smile className="size-5" />,
    onClose: () => alert('close'),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary">Primary</Tag>
      <Tag variant="outline">Outline</Tag>
      <Tag variant="success">Success</Tag>
      <Tag variant="warning">Warning</Tag>
      <Tag variant="error">Error</Tag>
      <Tag variant="critical">Critical</Tag>
      <Tag variant="grey">Grey</Tag>
    </div>
  ),
};

export const AllWithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary" icon={<Smile className="size-5" />}>Primary</Tag>
      <Tag variant="outline" icon={<Smile className="size-5" />}>Outline</Tag>
      <Tag variant="success" icon={<Smile className="size-5" />}>Success</Tag>
      <Tag variant="warning" icon={<Smile className="size-5" />}>Warning</Tag>
      <Tag variant="error" icon={<Smile className="size-5" />}>Error</Tag>
      <Tag variant="critical" icon={<Smile className="size-5" />}>Critical</Tag>
      <Tag variant="grey" icon={<Smile className="size-5" />}>Grey</Tag>
    </div>
  ),
};

export const AllWithClose: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary" onClose={() => {}}>Primary</Tag>
      <Tag variant="outline" onClose={() => {}}>Outline</Tag>
      <Tag variant="success" onClose={() => {}}>Success</Tag>
      <Tag variant="warning" onClose={() => {}}>Warning</Tag>
      <Tag variant="error" onClose={() => {}}>Error</Tag>
      <Tag variant="critical" onClose={() => {}}>Critical</Tag>
      <Tag variant="grey" onClose={() => {}}>Grey</Tag>
    </div>
  ),
};

export const AllWithIconAndClose: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary" icon={<Smile className="size-5" />} onClose={() => {}}>Primary</Tag>
      <Tag variant="outline" icon={<Smile className="size-5" />} onClose={() => {}}>Outline</Tag>
      <Tag variant="success" icon={<Smile className="size-5" />} onClose={() => {}}>Success</Tag>
      <Tag variant="warning" icon={<Smile className="size-5" />} onClose={() => {}}>Warning</Tag>
      <Tag variant="error" icon={<Smile className="size-5" />} onClose={() => {}}>Error</Tag>
      <Tag variant="critical" icon={<Smile className="size-5" />} onClose={() => {}}>Critical</Tag>
      <Tag variant="grey" icon={<Smile className="size-5" />} onClose={() => {}}>Grey</Tag>
    </div>
  ),
};
