import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Home, Settings, Users, Bell, Shield } from 'lucide-react';

import { TabNavigation, TabItem } from '../components/ui/tab-navigation';

const defaultTabs: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const tabsWithIndicators: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: Home, indicator: 'good' },
  { id: 'users', label: 'Users', icon: Users, indicator: 'warning' },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell, indicator: 'error' },
  { id: 'security', label: 'Security', icon: Shield },
];

const meta = {
  title: 'UI/TabNavigation',
  component: TabNavigation,
  parameters: {
    layout: 'padded',
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/test',
        query: {},
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    urlSync: {
      control: 'boolean',
      description: 'Enable URL synchronization for tabs',
    },
    defaultTab: {
      control: 'text',
      description: 'Default active tab id',
    },
    className: {
      control: 'text',
    },
  },
} satisfies Meta<typeof TabNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Controlled mode — tab state managed via `activeTab` and `onTabChange` props.
 */
export const Controlled: Story = {
  render: () => {
    const [active, setActive] = useState('overview');
    return (
      <TabNavigation
        tabs={defaultTabs}
        activeTab={active}
        onTabChange={setActive}
      />
    );
  },
  args: { tabs: defaultTabs },
};

/**
 * Controlled mode with children render prop showing active tab content.
 */
export const WithContent: Story = {
  render: () => {
    const [active, setActive] = useState('overview');
    return (
      <TabNavigation
        tabs={defaultTabs}
        activeTab={active}
        onTabChange={setActive}
      >
        {(activeTab) => (
          <div style={{ padding: '1.5rem' }}>
            Active tab: <strong>{activeTab}</strong>
          </div>
        )}
      </TabNavigation>
    );
  },
  args: { tabs: defaultTabs },
};

/**
 * Tabs with good, warning and error indicators.
 */
export const WithIndicators: Story = {
  render: () => {
    const [active, setActive] = useState('overview');
    return (
      <TabNavigation
        tabs={tabsWithIndicators}
        activeTab={active}
        onTabChange={setActive}
      />
    );
  },
  args: { tabs: tabsWithIndicators },
};

/**
 * URL sync mode — active tab is driven by a URL search param.
 * `@storybook/nextjs-vite` automatically mocks `next/navigation`.
 */
export const UrlSync: Story = {
  args: {
    tabs: defaultTabs,
    urlSync: true,
    defaultTab: 'overview',
    onTabChange: fn(),
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/test',
        query: { tab: 'users' },
      },
    },
  },
};

/**
 * URL sync with a custom param name.
 */
export const UrlSyncCustomParam: Story = {
  args: {
    tabs: defaultTabs,
    urlSync: { paramName: 'section', replaceState: true },
    defaultTab: 'overview',
    onTabChange: fn(),
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/test',
        query: { section: 'settings' },
      },
    },
  },
};

/**
 * Only two tabs.
 */
export const TwoTabs: Story = {
  render: () => {
    const tabs: TabItem[] = [
      { id: 'overview', label: 'Overview', icon: Home },
      { id: 'settings', label: 'Settings', icon: Settings },
    ];
    const [active, setActive] = useState('overview');
    return (
      <TabNavigation tabs={tabs} activeTab={active} onTabChange={setActive} />
    );
  },
  args: { tabs: defaultTabs },
};

/**
 * Default tab set to a non-first tab.
 */
export const DefaultTabOverride: Story = {
  render: () => {
    const [active, setActive] = useState('settings');
    return (
      <TabNavigation
        tabs={defaultTabs}
        activeTab={active}
        onTabChange={setActive}
      />
    );
  },
  args: { tabs: defaultTabs },
};

/**
 * Custom className on the container.
 */
export const CustomClassName: Story = {
  render: () => {
    const [active, setActive] = useState('overview');
    return (
      <TabNavigation
        tabs={defaultTabs}
        activeTab={active}
        onTabChange={setActive}
        className="bg-ods-card rounded-t-lg"
      />
    );
  },
  args: { tabs: defaultTabs },
};
