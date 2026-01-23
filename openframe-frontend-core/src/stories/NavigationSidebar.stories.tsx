import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import {
  BracketCurlyIcon,
  ChartDonutIcon,
  IdCardIcon,
  MonitorIcon,
  Settings02Icon
} from '../components/icons-v2-generated';
import { NavigationSidebar } from '../components/navigation/navigation-sidebar';
import { NavigationSidebarConfig } from '../types/navigation';

// Mock navigation items
const defaultNavigationItems: NavigationSidebarConfig['items'] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <ChartDonutIcon size={24} />,
    path: '/dashboard',
    isActive: true,
  },
  {
    id: 'organizations',
    label: 'Organizations',
    icon: <IdCardIcon size={24} />,
    path: '/organizations',
  },
  {
    id: 'devices',
    label: 'Devices',
    icon: <MonitorIcon size={24} />,
    path: '/devices',
  },
  {
    id: 'scripts',
    label: 'Scripts',
    icon: <BracketCurlyIcon size={24} />,
    path: '/scripts',
  },
];

const secondaryNavigationItems: NavigationSidebarConfig['items'] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings02Icon />,
    path: '/settings',
    section: 'secondary',
  },
];

const allNavigationItems: NavigationSidebarConfig['items'] = [
  ...defaultNavigationItems,
  ...secondaryNavigationItems,
];

const meta = {
  title: 'Navigation/NavigationSidebar',
  component: NavigationSidebar,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'A responsive navigation sidebar component with collapsible functionality, mobile overlay support, and customizable navigation items.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', height: '100vh', width: '100%' }}>
        <Story />
        <div style={{ flex: 1, padding: '2rem', backgroundColor: 'var(--ods-bg-card)' }}>
          <h1 style={{ marginBottom: '1rem' }}>Main Content Area</h1>
          <p>This is where your main content would go. The sidebar will remain fixed on the left.</p>
        </div>
      </div>
    ),
  ],
  args: {
    config: {
      items: allNavigationItems,
      onNavigate: fn(),
      onToggleMinimized: fn(),
    },
  },
} satisfies Meta<typeof NavigationSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default expanded sidebar with primary and secondary navigation sections.
 */
export const Default: Story = {
  render: (args) => {
    const [items, setItems] = useState(args.config.items);

    const handleNavigate = (path: string) => {
      fn()(path);
      setItems(prevItems =>
        prevItems.map(item => ({
          ...item,
          isActive: item.path === path,
        }))
      );
    };

    return (
      <NavigationSidebar
        config={{
          ...args.config,
          items,
          onNavigate: handleNavigate,
        }}
      />
    );
  },
  args: {
    config: {
      items: allNavigationItems,
      onNavigate: fn(),
      onToggleMinimized: fn(),
    },
  },
};