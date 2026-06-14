import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Database, FileText, Inbox, Plus, Search, Settings, Sparkles, Upload, Zap } from 'lucide-react';
import React from 'react';
import { Button } from '../components/ui/button';
import { NoData, NoDataAction, NoDataActions, NoDataMessage } from '../components/ui/no-data';

const meta = {
  title: 'UI/EmptyState',
  component: NoData,
  argTypes: {
    icon: { control: false },
    actions: { control: false },
    button: { control: false },
    buttonIcon: { control: false },
    onButtonClick: { control: false },
    buttonProps: { control: false },
    title: { control: 'text' },
    description: { control: 'text' },
    buttonLabel: { control: 'text' },
  },
} satisfies Meta<typeof NoData>;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};

const defaultActions = [
  { icon: <Zap />, label: 'Feature Description', onClick: noop },
  { icon: <Sparkles />, label: 'Feature Description', onClick: noop },
  { icon: <Database />, label: 'Feature Description', onClick: noop },
];

// === Full composition ===

export const Default: Story = {
  args: {
    icon: <Inbox />,
    title: 'No data available',
    description: 'Start by adding an item',
    actions: defaultActions,
    buttonLabel: 'Ask Mingo about Item',
    buttonIcon: <Sparkles />,
    onButtonClick: noop,
  },
};

// === Reduced message ===

export const MessageTitleOnly: Story = {
  args: {
    icon: <Search />,
    title: 'No results found',
  },
};

// === Without one region ===

export const WithoutActions: Story = {
  args: {
    icon: <Inbox />,
    title: 'No data available',
    description: 'Start by adding an item',
    buttonLabel: 'Add item',
    buttonIcon: <Plus />,
    onButtonClick: noop,
  },
};

export const WithoutButton: Story = {
  args: {
    icon: <Inbox />,
    title: 'No data available',
    description: 'Start by adding an item',
    actions: defaultActions,
  },
};

// === Dynamic block count ===

export const TwoActions: Story = {
  args: {
    icon: <Database />,
    title: 'No data available',
    description: 'Start by adding an item',
    actions: [
      { icon: <Zap />, label: 'Feature Description', onClick: noop },
      { icon: <Sparkles />, label: 'Feature Description', onClick: noop },
    ],
    buttonLabel: 'Ask Mingo about Item',
    buttonIcon: <Sparkles />,
    onButtonClick: noop,
  },
};

export const FourActions: Story = {
  args: {
    icon: <Database />,
    title: 'No data available',
    description: 'Start by adding an item',
    actions: [
      { icon: <Zap />, label: 'Real-time sync', onClick: noop },
      { icon: <Sparkles />, label: 'Smart suggestions', onClick: noop },
      { icon: <Database />, label: 'Unlimited storage', onClick: noop },
      { icon: <FileText />, label: 'Export anywhere', onClick: noop },
    ],
    buttonLabel: 'Ask Mingo about Item',
    buttonIcon: <Sparkles />,
    onButtonClick: noop,
  },
};

// === Disabled blocks ===

export const DisabledActions: Story = {
  args: {
    icon: <Inbox />,
    title: 'No data available',
    description: 'Some actions are unavailable',
    actions: [
      { icon: <Zap />, label: 'Available', onClick: noop },
      { icon: <Sparkles />, label: 'Disabled', onClick: noop, disabled: true },
      { icon: <Database />, label: 'Disabled', onClick: noop, disabled: true },
    ],
    buttonLabel: 'Ask Mingo about Item',
    buttonIcon: <Sparkles />,
    onButtonClick: noop,
  },
};

// === Footer button variations ===

export const ButtonAsLink: Story = {
  args: {
    icon: <Upload />,
    title: 'No data available',
    description: 'Import your first dataset',
    buttonLabel: 'View docs',
    buttonIcon: <FileText />,
    buttonProps: { href: '/docs' },
  },
};

export const CustomButton: Story = {
  args: {
    icon: <Settings />,
    title: 'No data available',
    description: 'Configure a source to get started',
    // `button` is the escape hatch — pass any node.
    button: (
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button variant="outline" leftIcon={<Plus />}>Connect source</Button>
        <Button variant="transparent" leftIcon={<FileText />}>View docs</Button>
      </div>
    ),
  },
};

// === Standalone parts ===

export const StandaloneActions: Story = {
  args: { title: '' },
  render: () => (
    <NoDataActions>
      <NoDataAction icon={<Zap />} label="Clickable block" onClick={noop} />
      <NoDataAction icon={<Sparkles />} label="Clickable block" onClick={noop} />
      <NoDataAction icon={<Database />} label="Disabled block" onClick={noop} disabled />
    </NoDataActions>
  ),
};

export const StandaloneMessage: Story = {
  args: { title: '' },
  render: () => (
    <NoDataMessage
      icon={<Search />}
      title="No results found"
      description="Try adjusting your filters"
    />
  ),
};

// === Showcase ===

export const Showcase: Story = {
  args: { title: '' },
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem', alignItems: 'stretch' }}>
      <NoData
        icon={<Inbox />}
        title="No data available"
        description="Start by adding an item"
        actions={defaultActions}
        buttonLabel="Ask Mingo about Item"
        buttonIcon={<Sparkles />}
        onButtonClick={noop}
      />
      <NoData icon={<Search />} title="No results found" description="Try a different search" />
      <NoData
        icon={<Database />}
        title="No data available"
        description="Start by adding an item"
        actions={defaultActions}
      />
    </div>
  ),
};
