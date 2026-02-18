import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Braces, Monitor, History, Settings, Users, Shield, Bell, FileText } from 'lucide-react';
import { TabNavigation, type TabItem } from '../components/ui/tab-navigation';

const meta = {
  title: 'UI/TabNavigation',
  component: TabNavigation,
  decorators: [
    (Story) => (
      <div style={{ background: '#161616', minHeight: '200px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TabNavigation>;

export default meta;
type Story = StoryObj<typeof meta>;

const defaultTabs: TabItem[] = [
  { id: 'scripts', label: 'Scheduled Scripts', icon: Braces },
  { id: 'devices', label: 'Assigned Devices', icon: Monitor },
  { id: 'history', label: 'Execution History', icon: History },
];

/**
 * Default tab navigation matching the Figma design.
 * Third tab is active by default.
 */
export const Default: Story = {
  args: {
    tabs: defaultTabs,
    activeTab: 'history',
  },
};

/**
 * First tab selected.
 */
export const FirstTabActive: Story = {
  args: {
    tabs: defaultTabs,
    activeTab: 'scripts',
  },
};

/**
 * Interactive example with tab switching.
 */
export const Interactive: Story = {
  args: {
    tabs: defaultTabs,
  },
  render: (args) => {
    const [activeTab, setActiveTab] = useState('history');
    return (
      <TabNavigation
        {...args}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    );
  },
};

/**
 * Two tabs only.
 */
export const TwoTabs: Story = {
  args: {
    tabs: [
      { id: 'settings', label: 'General', icon: Settings },
      { id: 'security', label: 'Security', icon: Shield },
    ],
    activeTab: 'settings',
  },
};

/**
 * Many tabs with horizontal scroll.
 */
export const ManyTabs: Story = {
  args: {
    tabs: [
      { id: 'scripts', label: 'Scheduled Scripts', icon: Braces },
      { id: 'devices', label: 'Assigned Devices', icon: Monitor },
      { id: 'history', label: 'Execution History', icon: History },
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'security', label: 'Security', icon: Shield },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'logs', label: 'Audit Logs', icon: FileText },
    ],
    activeTab: 'history',
  },
};

/**
 * Tab with alert indicator (warning).
 */
export const WithAlerts: Story = {
  args: {
    tabs: [
      { id: 'scripts', label: 'Scheduled Scripts', icon: Braces },
      { id: 'devices', label: 'Assigned Devices', icon: Monitor, hasAlert: true, alertType: 'warning' },
      { id: 'history', label: 'Execution History', icon: History, hasAlert: true, alertType: 'error' },
    ],
    activeTab: 'scripts',
  },
};

/**
 * Tab navigation with content rendered via children render prop.
 */
export const WithContent: Story = {
  args: {
    tabs: defaultTabs,
  },
  render: (args) => {
    const [activeTab, setActiveTab] = useState('scripts');
    return (
      <TabNavigation
        {...args}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {(tab) => (
          <div className="p-6 text-ods-text-secondary">
            Active tab: <span className="text-ods-text-primary font-medium">{tab}</span>
          </div>
        )}
      </TabNavigation>
    );
  },
};
