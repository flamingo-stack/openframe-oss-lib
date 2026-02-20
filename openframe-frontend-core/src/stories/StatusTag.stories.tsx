import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Circle, Wifi, WifiOff } from 'lucide-react';
import { StatusTag } from '../components/ui/status-tag';

const meta = {
  title: 'UI/StatusTag',
  component: StatusTag,
  argTypes: {
    variant: {
      control: 'select',
      options: ['success', 'warning', 'error', 'critical', 'info', 'active', 'inactive', 'offline'],
    },
    isMobile: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof StatusTag>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: { label: 'Success', variant: 'success' },
};

export const Warning: Story = {
  args: { label: 'Warning', variant: 'warning' },
};

export const Error: Story = {
  args: { label: 'Error', variant: 'error' },
};

export const Critical: Story = {
  args: { label: 'Critical', variant: 'critical' },
};

export const Info: Story = {
  args: { label: 'Info', variant: 'info' },
};

export const Active: Story = {
  args: { label: 'Active', variant: 'active' },
};

export const Inactive: Story = {
  args: { label: 'Inactive', variant: 'inactive' },
};

export const Offline: Story = {
  args: { label: 'Offline', variant: 'offline' },
};

export const Mobile: Story = {
  args: { label: 'Mobile', variant: 'success', isMobile: true },
};

export const WithLeftIcon: Story = {
  args: {
    label: 'Online',
    variant: 'active',
    leftIcon: <Wifi className="size-4" />,
  },
};

export const WithRightIcon: Story = {
  args: {
    label: 'Offline',
    variant: 'offline',
    rightIcon: <WifiOff className="size-4" />,
  },
};

export const WithBothIcons: Story = {
  args: {
    label: 'Active',
    variant: 'success',
    leftIcon: <Circle className="size-4" />,
    rightIcon: <Wifi className="size-4" />,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusTag label="Success" variant="success" />
      <StatusTag label="Warning" variant="warning" />
      <StatusTag label="Error" variant="error" />
      <StatusTag label="Critical" variant="critical" />
      <StatusTag label="Info" variant="info" />
      <StatusTag label="Active" variant="active" />
      <StatusTag label="Inactive" variant="inactive" />
      <StatusTag label="Offline" variant="offline" />
    </div>
  ),
};

export const AllVariantsMobile: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusTag label="Success" variant="success" isMobile />
      <StatusTag label="Warning" variant="warning" isMobile />
      <StatusTag label="Error" variant="error" isMobile />
      <StatusTag label="Critical" variant="critical" isMobile />
      <StatusTag label="Info" variant="info" isMobile />
      <StatusTag label="Active" variant="active" isMobile />
      <StatusTag label="Inactive" variant="inactive" isMobile />
      <StatusTag label="Offline" variant="offline" isMobile />
    </div>
  ),
};

export const AllWithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusTag label="Success" variant="success" leftIcon={<Circle className="size-4" />} />
      <StatusTag label="Warning" variant="warning" leftIcon={<Circle className="size-4" />} />
      <StatusTag label="Error" variant="error" leftIcon={<Circle className="size-4" />} />
      <StatusTag label="Critical" variant="critical" leftIcon={<Circle className="size-4" />} />
      <StatusTag label="Info" variant="info" leftIcon={<Circle className="size-4" />} />
      <StatusTag label="Active" variant="active" leftIcon={<Circle className="size-4" />} />
      <StatusTag label="Inactive" variant="inactive" leftIcon={<Circle className="size-4" />} />
      <StatusTag label="Offline" variant="offline" leftIcon={<Circle className="size-4" />} />
    </div>
  ),
};
