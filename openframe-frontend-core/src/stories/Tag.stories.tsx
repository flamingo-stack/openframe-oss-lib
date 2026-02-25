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
  args: { variant: 'primary', label: 'Tag' },
};

export const Outline: Story = {
  args: { variant: 'outline', label: 'Tag' },
};

export const Success: Story = {
  args: { variant: 'success', label: 'Tag' },
};

export const Warning: Story = {
  args: { variant: 'warning', label: 'Tag' },
};

export const Error: Story = {
  args: { variant: 'error', label: 'Tag' },
};

export const Critical: Story = {
  args: { variant: 'critical', label: 'Tag' },
};

export const Grey: Story = {
  args: { variant: 'grey', label: 'Tag' },
};

export const WithIcon: Story = {
  args: {
    variant: 'primary',
    label: 'Tag',
    icon: <Smile className="size-5" />,
  },
};

export const WithCloseButton: Story = {
  args: {
    variant: 'primary',
    label: 'Tag',
    onClose: () => alert('close'),
  },
};

export const WithIconAndClose: Story = {
  args: {
    variant: 'success',
    label: 'Tag',
    icon: <Smile className="size-5" />,
    onClose: () => alert('close'),
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary" label="Primary" />
      <Tag variant="outline" label="Outline" />
      <Tag variant="success" label="Success" />
      <Tag variant="warning" label="Warning" />
      <Tag variant="error" label="Error" />
      <Tag variant="critical" label="Critical" />
      <Tag variant="grey" label="Grey" />
    </div>
  ),
};

export const AllWithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary" icon={<Smile className="size-5" />} label="Primary" />
      <Tag variant="outline" icon={<Smile className="size-5" />} label="Outline" />
      <Tag variant="success" icon={<Smile className="size-5" />} label="Success" />
      <Tag variant="warning" icon={<Smile className="size-5" />} label="Warning" />
      <Tag variant="error" icon={<Smile className="size-5" />} label="Error" />
      <Tag variant="critical" icon={<Smile className="size-5" />} label="Critical" />
      <Tag variant="grey" icon={<Smile className="size-5" />} label="Grey" />
    </div>
  ),
};

export const AllWithClose: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary" onClose={() => {}} label="Primary" />
      <Tag variant="outline" onClose={() => {}} label="Outline" />
      <Tag variant="success" onClose={() => {}} label="Success" />
      <Tag variant="warning" onClose={() => {}} label="Warning" />
      <Tag variant="error" onClose={() => {}} label="Error" />
      <Tag variant="critical" onClose={() => {}} label="Critical" />
      <Tag variant="grey" onClose={() => {}} label="Grey" />
    </div>
  ),
};

export const AllWithIconAndClose: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Tag variant="primary" icon={<Smile className="size-5" />} onClose={() => {}} label="Primary" />
      <Tag variant="outline" icon={<Smile className="size-5" />} onClose={() => {}} label="Outline" />
      <Tag variant="success" icon={<Smile className="size-5" />} onClose={() => {}} label="Success" />
      <Tag variant="warning" icon={<Smile className="size-5" />} onClose={() => {}} label="Warning" />
      <Tag variant="error" icon={<Smile className="size-5" />} onClose={() => {}} label="Error" />
      <Tag variant="critical" icon={<Smile className="size-5" />} onClose={() => {}} label="Critical" />
      <Tag variant="grey" icon={<Smile className="size-5" />} onClose={() => {}} label="Grey" />
    </div>
  ),
};
