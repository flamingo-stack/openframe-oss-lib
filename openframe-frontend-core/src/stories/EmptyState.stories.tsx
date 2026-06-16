import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Database, FileText, Inbox, Plus, Search, Settings, Sparkles, Upload, Zap } from 'lucide-react';
import React from 'react';
import { MingoIcon } from '../components/icons';
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

const mingoButtonIcon = (
  <MingoIcon className="size-5" eyesColor="var(--ods-flamingo-cyan-base)" cornerColor="var(--ods-flamingo-cyan-base)" />
);

const defaultActions = [
  { icon: <Zap />, label: 'Feature Description' },
  { icon: <Sparkles />, label: 'Feature Description' },
  { icon: <Database />, label: 'Feature Description' },
];

// === Full composition ===

export const Default: Story = {
  args: {
    icon: <Inbox />,
    title: 'No data available',
    description: 'Start by adding an item',
    actions: defaultActions,
    buttonLabel: 'Ask Mingo about Item',
    buttonIcon: mingoButtonIcon,
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
      { icon: <Zap />, label: 'Feature Description' },
      { icon: <Sparkles />, label: 'Feature Description' },
    ],
    buttonLabel: 'Ask Mingo about Item',
    buttonIcon: mingoButtonIcon,
    onButtonClick: noop,
  },
};

export const FourActions: Story = {
  args: {
    icon: <Database />,
    title: 'No data available',
    description: 'Start by adding an item',
    actions: [
      { icon: <Zap />, label: 'Real-time sync' },
      { icon: <Sparkles />, label: 'Smart suggestions' },
      { icon: <Database />, label: 'Unlimited storage' },
      { icon: <FileText />, label: 'Export anywhere' },
    ],
    buttonLabel: 'Ask Mingo about Item',
    buttonIcon: mingoButtonIcon,
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
      <div className="flex gap-2">
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
      <NoDataAction icon={<Zap />} label="Info block" />
      <NoDataAction icon={<Sparkles />} label="Info block" />
      <NoDataAction icon={<Database />} label="Info block" />
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
    <div className="flex flex-col items-stretch gap-12">
      <NoData
        icon={<Inbox />}
        title="No data available"
        description="Start by adding an item"
        actions={defaultActions}
        buttonLabel="Ask Mingo about Item"
        buttonIcon={mingoButtonIcon}
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
