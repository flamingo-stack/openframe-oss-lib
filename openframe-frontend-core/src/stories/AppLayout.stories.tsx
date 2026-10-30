import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { NotificationsProvider } from '../components/features/notifications/notifications-context';
import type { Notification } from '../components/features/notifications/types';
import {
  BracketCurlyIcon,
  ChartDonutIcon,
  ClockHistoryIcon,
  IdCardIcon,
  MonitorIcon,
  SendIcon,
  Settings02Icon,
} from '../components/icons-v2-generated';
import { AppLayout } from '../components/navigation/app-layout';
import { NotificationsBellButton } from '../components/navigation/notifications-bell-button';
import { Button, Input, PageLayout } from '../components/ui';
import type { NavigationSidebarConfig } from '../types/navigation';

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
    badge: 'Beta',
  },
];

const secondaryNavigationItems: NavigationSidebarConfig['items'] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings02Icon size={24} />,
    path: '/settings',
    section: 'secondary',
  },
];

const allNavigationItems: NavigationSidebarConfig['items'] = [...defaultNavigationItems, ...secondaryNavigationItems];

const meta = {
  title: 'Navigation/AppLayout',
  component: AppLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
A unified application layout component that combines the NavigationSidebar, AppHeader, and main content area.

## Layout Structure
\`\`\`
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────────────────────────────────┐ │
│ │          │ │              App Header                     │ │
│ │          │ ├─────────────────────────────────────────────┤ │
│ │ Sidebar  │ │                                             │ │
│ │          │ │            Main Content Area                │ │
│ │          │ │           (with Suspense)                   │ │
│ │          │ │                                             │ │
│ └──────────┘ └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
\`\`\`

## Key Features
- **Responsive Sidebar**: Collapsible navigation with mobile overlay support
- **Configurable Header**: Optional header with user menu, notifications, search
- **Suspense Integration**: Built-in loading state support for main content
- **Flexible Styling**: Customizable via className props
        `,
      },
    },
  },
  tags: ['autodocs'],
  args: {
    sidebarConfig: {
      items: allNavigationItems,
      onNavigate: fn(),
      onToggleMinimized: fn(),
    },
    headerProps: {
      showNotifications: true,
      showUser: true,
      userName: 'John Doe',
      userEmail: 'john@example.com',
      onProfile: fn(),
      onLogout: fn(),
    },
    children: (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-semibold text-ods-text-primary">Main Content</h1>
        <p className="text-ods-text-secondary">This is where your page content goes.</p>
      </div>
    ),
  },
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default layout with sidebar, header, and main content area.
 */
export const Default: Story = {
  args: {
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
    },
  },
  render: args => {
    const [items, setItems] = useState(args.sidebarConfig.items);

    const handleNavigate = (path: string) => {
      fn()(path);
      setItems(prevItems =>
        prevItems.map(item => ({
          ...item,
          isActive: item.path === path,
        })),
      );
    };

    return (
      <AppLayout
        {...args}
        sidebarConfig={{
          ...args.sidebarConfig,
          items,
          onNavigate: handleNavigate,
        }}
      />
    );
  },
};

/**
 * Layout without custom user info - using only headerProps user data.
 */
export const WithHeaderUserOnly: Story = {
  args: {
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
    },
    children: (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-semibold text-ods-text-primary">Header User Only</h1>
        <p className="text-ods-text-secondary">This layout uses user info from headerProps for the sidebar.</p>
      </div>
    ),
  },
};

/**
 * Layout with header showing search and organization selector.
 */
export const WithSearchAndOrganizations: Story = {
  args: {
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
    },
    headerProps: {
      showSearch: true,
      onSearch: fn(),
      showOrganizations: true,
      organizations: [
        { id: '1', name: 'Acme Corp' },
        { id: '2', name: 'Tech Startup' },
        { id: '3', name: 'Enterprise Inc' },
      ],
      selectedOrgId: '1',
      onOrgChange: fn(),
      showNotifications: true,
      showUser: true,
      userName: 'Jane Smith',
      userEmail: 'jane@acme.com',
      onProfile: fn(),
      onLogout: fn(),
    },
    children: (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-semibold text-ods-text-primary">Dashboard</h1>
        <p className="text-ods-text-secondary">Welcome back! Here&apos;s your overview.</p>
      </div>
    ),
  },
};

/**
 * Layout with custom main content styling.
 */
export const WithCustomMainClassName: Story = {
  args: {
    mainClassName: 'bg-ods-bg-card',
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
    },
    children: (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-semibold text-ods-text-primary">Custom Background</h1>
        <p className="text-ods-text-secondary">The main content area has a custom background color.</p>
      </div>
    ),
  },
};

/**
 * Layout with minimized sidebar by default.
 */
export const MinimizedSidebar: Story = {
  args: {
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
    },
    sidebarConfig: {
      items: allNavigationItems,
      minimized: true,
      onNavigate: fn(),
      onToggleMinimized: fn(),
    },
    children: (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-semibold text-ods-text-primary">Wider Content Area</h1>
        <p className="text-ods-text-secondary">The sidebar starts minimized, giving more horizontal space.</p>
      </div>
    ),
  },
};

/**
 * Interactive example with working navigation.
 */
export const Interactive: Story = {
  args: {
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
    },
  },
  render: function InteractiveStory() {
    const [items, setItems] = useState(allNavigationItems);
    const [currentPage, setCurrentPage] = useState('Dashboard');

    const handleNavigate = (path: string) => {
      const pageName = path.replace('/', '').replace(/-/g, ' ');
      const formattedName = pageName.charAt(0).toUpperCase() + pageName.slice(1) || 'Dashboard';
      setCurrentPage(formattedName);
      setItems(prevItems =>
        prevItems.map(item => ({
          ...item,
          isActive: item.path === path,
        })),
      );
    };

    return (
      <AppLayout
        mobileBurgerMenuProps={{
          user: {
            userName: 'Alex Developer',
            userEmail: 'alex@openframe.dev',
            userAvatarUrl: 'https://github.com/shadcn.png',
            userRole: 'Admin',
          },
        }}
        sidebarConfig={{
          items,
          onNavigate: handleNavigate,
        }}
        headerProps={{
          showNotifications: true,
          unreadCount: 3,
          showUser: true,
          userName: 'Alex Developer',
          userEmail: 'alex@openframe.dev',
          onProfile: () => alert('Profile clicked'),
          onLogout: () => alert('Logout clicked'),
        }}
      >
        <div className="p-4">
          <h1 className="mb-4 text-2xl font-semibold text-ods-text-primary">{currentPage}</h1>
          <p className="text-ods-text-secondary">
            Click on sidebar items to navigate. The sidebar can be collapsed using the toggle at the bottom.
          </p>
          <div className="bg-ods-bg-card mt-6 rounded-lg border border-ods-border p-4">
            <h2 className="mb-2 text-lg font-medium text-ods-text-primary">Current Route</h2>
            <code className="text-sm text-ods-accent">/{currentPage.toLowerCase().replace(/ /g, '-')}</code>
          </div>
        </div>
      </AppLayout>
    );
  },
};

/**
 * Disabled state - only the mobile burger menu toggle and the sidebar collapse/expand
 * button remain interactive. All other navigation, header controls, and main content
 * are visually dimmed and cannot be interacted with.
 */
export const Disabled: Story = {
  args: {
    disabled: true,
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
      onSearchUser: fn(),
      onEditProfile: fn(),
      onLogout: fn(),
    },
    headerProps: {
      showSearch: true,
      onSearch: fn(),
      showOrganizations: true,
      organizations: [
        { id: '1', name: 'Acme Corp' },
        { id: '2', name: 'Tech Startup' },
      ],
      selectedOrgId: '1',
      onOrgChange: fn(),
      showNotifications: true,
      unreadCount: 3,
      showUser: true,
      userName: 'Alex Developer',
      userEmail: 'alex@openframe.dev',
      onProfile: fn(),
      onLogout: fn(),
    },
    children: (
      <div className="p-4">
        <h1 className="mb-4 text-2xl font-semibold text-ods-text-primary">Disabled Layout</h1>
        <p className="mb-2 text-ods-text-secondary">
          Try clicking nav items, search, organizations, the user menu, or any content here — they are all inert.
        </p>
        <p className="text-ods-text-secondary">
          Only the burger menu (mobile) and the sidebar collapse/expand toggle at the bottom of the sidebar remain
          interactive.
        </p>
      </div>
    ),
  },
};

/**
 * Example mimicking a typical dashboard page.
 */
export const DashboardExample: Story = {
  args: {
    headerProps: {
      showSearch: false,
      onSearch: fn(),
      unreadCount: 5,
      showNotifications: false,
      showUser: true,
      showOrganizations: true,
      userName: 'Admin User',
      userEmail: 'admin@company.com',
      onProfile: fn(),
      onLogout: fn(),
    },
    mobileBurgerMenuProps: {
      user: {
        userName: 'Admin User',
        userEmail: 'admin@company.com',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
      onSearchUser: fn(),
      onEditProfile: fn(),
      onLogout: fn(),
    },
    children: (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-ods-text-primary">Dashboard</h1>
          <p className="mt-1 text-ods-text-secondary">Welcome back! Here&apos;s what&apos;s happening.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { label: 'Total Devices', value: '1,234' },
            { label: 'Active Users', value: '567' },
            { label: 'Scripts Run', value: '89' },
          ].map(stat => (
            <div key={stat.label} className="bg-ods-bg-card rounded-lg border border-ods-border p-4">
              <p className="text-sm text-ods-text-secondary">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold text-ods-text-primary">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-ods-bg-card rounded-lg border border-ods-border p-4">
          <h2 className="mb-4 text-lg font-medium text-ods-text-primary">Recent Activity</h2>
          <div className="space-y-3">
            {[
              { action: 'Script executed', target: 'backup-daily.sh', time: '2 min ago' },
              { action: 'Device added', target: 'MacBook-Pro-15', time: '15 min ago' },
              { action: 'User invited', target: 'sarah@company.com', time: '1 hour ago' },
            ].map((activity, index) => (
              <div
                key={index}
                className="flex items-center justify-between border-b border-ods-border py-2 last:border-0"
              >
                <div>
                  <p className="text-sm text-ods-text-primary">{activity.action}</p>
                  <p className="text-xs text-ods-text-secondary">{activity.target}</p>
                </div>
                <span className="text-xs text-ods-text-secondary">{activity.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
};

const SHELL_USER = {
  userName: 'Alex Developer',
  userEmail: 'alex@openframe.dev',
  userAvatarUrl: 'https://github.com/shadcn.png',
  userRole: 'Admin',
};

const SHELL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'Device alert',
    title: 'Disk space low on FIN-LAPTOP-07',
    description: 'C: has 4% free. Cleanup recommended before the next patch window.',
    severity: 'WARNING',
    createdAt: Date.now() - 5 * 60_000,
  },
];

const onMingo = fn();
const onChatHistory = fn();
const onSend = fn();

/** Stand-in for the Mingo composer: the real one is the app's, built on the chat lib. */
function ComposerDockStandIn() {
  return (
    <div className="border-t border-ods-border bg-ods-bg px-[var(--spacing-system-l)] py-[var(--spacing-system-m)]">
      <form
        className="mx-auto flex w-full max-w-[880px] items-center gap-[var(--spacing-system-xsf)]"
        onSubmit={event => {
          event.preventDefault();
          onSend();
        }}
      >
        <Input aria-label="Message Mingo" placeholder="Ask Mingo about this page" className="flex-1" />
        <Button type="submit" variant="primary" leftIcon={<SendIcon size={20} />} aria-label="Send">
          {/* A content-area variant: follows the page column, not the window. */}
          <span className="hidden content-md:inline">Send</span>
        </Button>
      </form>
    </div>
  );
}

/** A page long enough to scroll: its last row stays visible above the dock. */
function ShellPage() {
  return (
    <PageLayout title="Devices" subtitle="Scroll to the end: the last row stops above the composer.">
      <ul className="flex flex-col gap-[var(--spacing-system-xsf)]">
        {Array.from({ length: 40 }, (_, i) => (
          <li
            key={i}
            className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)] text-ods-text-primary text-h4"
          >
            Device {i + 1}
          </li>
        ))}
      </ul>
    </PageLayout>
  );
}

/**
 * The Mingo-first shell: no desktop header, the notifications bell in the
 * page column's top-right corner (`contentCorner`), the composer docked under
 * the page (`composerDock`), no side panel. The bell opens the same
 * `NotificationDrawer` the header bell does — it reads the
 * `NotificationsProvider`, not the header. Below md the phone top bar stays,
 * with a custom "Chat history" cell before the bell and the Mingo cell last.
 */
export const MingoShell: Story = {
  args: {
    mobileBurgerMenuProps: { user: SHELL_USER },
  },
  render: function MingoShellStory(args) {
    const [items, setItems] = useState(allNavigationItems);
    return (
      <NotificationsProvider initialNotifications={SHELL_NOTIFICATIONS}>
        <AppLayout
          mobileBurgerMenuProps={args.mobileBurgerMenuProps}
          sidebarConfig={{
            items,
            onNavigate: path => setItems(prev => prev.map(item => ({ ...item, isActive: item.path === path }))),
          }}
          desktopHeader={false}
          contentCorner={<NotificationsBellButton variant="floating" />}
          composerDock={<ComposerDockStandIn />}
          headerProps={{
            showNotifications: true,
            showMingoAI: true,
            onMingoAI: onMingo,
            customCells: [
              {
                id: 'chat-history',
                icon: <ClockHistoryIcon className="h-6 w-6" />,
                label: 'Chat history',
                onClick: onChatHistory,
                mobileOnly: true,
              },
            ],
          }}
        >
          <ShellPage />
        </AppLayout>
      </NotificationsProvider>
    );
  },
};

/** The Mingo-first shell on a phone: top bar (burger, logo, Chat history, bell, Mingo) and the docked composer. */
export const MingoShellMobile: Story = {
  ...MingoShell,
  globals: { viewport: { value: 'mobile', isRotated: false } },
};
