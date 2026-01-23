import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'

import {
  BracketCurlyIcon,
  ChartDonutIcon,
  IdCardIcon,
  MonitorIcon,
  Settings02Icon
} from '../components/icons-v2-generated'
import { AppLayout } from '../components/navigation/app-layout'
import { NavigationSidebarConfig } from '../types/navigation'

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
]

const secondaryNavigationItems: NavigationSidebarConfig['items'] = [
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings02Icon size={24} />,
    path: '/settings',
    section: 'secondary',
  },
]

const allNavigationItems: NavigationSidebarConfig['items'] = [
  ...defaultNavigationItems,
  ...secondaryNavigationItems,
]

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
        `
      }
    }
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
        <h1 className="text-2xl font-semibold text-ods-text-primary mb-4">Main Content</h1>
        <p className="text-ods-text-secondary">This is where your page content goes.</p>
      </div>
    ),
  },
} satisfies Meta<typeof AppLayout>

export default meta
type Story = StoryObj<typeof meta>

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
  render: (args) => {
    const [items, setItems] = useState(args.sidebarConfig.items)

    const handleNavigate = (path: string) => {
      fn()(path)
      setItems(prevItems =>
        prevItems.map(item => ({
          ...item,
          isActive: item.path === path,
        }))
      )
    }

    return (
      <AppLayout
        {...args}
        sidebarConfig={{
          ...args.sidebarConfig,
          items,
          onNavigate: handleNavigate,
        }}
      />
    )
  },
}

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
        <h1 className="text-2xl font-semibold text-ods-text-primary mb-4">Header User Only</h1>
        <p className="text-ods-text-secondary">This layout uses user info from headerProps for the sidebar.</p>
      </div>
    ),
  },
}

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
        <h1 className="text-2xl font-semibold text-ods-text-primary mb-4">Dashboard</h1>
        <p className="text-ods-text-secondary">Welcome back! Here&apos;s your overview.</p>
      </div>
    ),
  },
}

/**
 * Layout with custom loading fallback for Suspense.
 */
export const WithLoadingFallback: Story = {
  args: {
    mobileBurgerMenuProps: {
      user: {
        userName: 'Alex Developer',
        userEmail: 'alex@openframe.dev',
        userAvatarUrl: 'https://github.com/shadcn.png',
        userRole: 'Admin',
      },
    },
    loadingFallback: (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ods-accent" />
      </div>
    ),
    children: (
      <div className="p-4">
        <h1 className="text-2xl font-semibold text-ods-text-primary mb-4">Content Loaded</h1>
        <p className="text-ods-text-secondary">The loading spinner appears during Suspense.</p>
      </div>
    ),
  },
}

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
        <h1 className="text-2xl font-semibold text-ods-text-primary mb-4">Custom Background</h1>
        <p className="text-ods-text-secondary">The main content area has a custom background color.</p>
      </div>
    ),
  },
}

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
        <h1 className="text-2xl font-semibold text-ods-text-primary mb-4">Wider Content Area</h1>
        <p className="text-ods-text-secondary">The sidebar starts minimized, giving more horizontal space.</p>
      </div>
    ),
  },
}

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
    const [items, setItems] = useState(allNavigationItems)
    const [currentPage, setCurrentPage] = useState('Dashboard')

    const handleNavigate = (path: string) => {
      const pageName = path.replace('/', '').replace(/-/g, ' ')
      const formattedName = pageName.charAt(0).toUpperCase() + pageName.slice(1) || 'Dashboard'
      setCurrentPage(formattedName)
      setItems(prevItems =>
        prevItems.map(item => ({
          ...item,
          isActive: item.path === path,
        }))
      )
    }

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
          <h1 className="text-2xl font-semibold text-ods-text-primary mb-4">{currentPage}</h1>
          <p className="text-ods-text-secondary">
            Click on sidebar items to navigate. The sidebar can be collapsed using the toggle at the bottom.
          </p>
          <div className="mt-6 p-4 bg-ods-bg-card rounded-lg border border-ods-border">
            <h2 className="text-lg font-medium text-ods-text-primary mb-2">Current Route</h2>
            <code className="text-sm text-ods-accent">
              /{currentPage.toLowerCase().replace(/ /g, '-')}
            </code>
          </div>
        </div>
      </AppLayout>
    )
  },
}

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
          <p className="text-ods-text-secondary mt-1">Welcome back! Here&apos;s what&apos;s happening.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Devices', value: '1,234' },
            { label: 'Active Users', value: '567' },
            { label: 'Scripts Run', value: '89' },
          ].map((stat) => (
            <div key={stat.label} className="p-4 bg-ods-bg-card rounded-lg border border-ods-border">
              <p className="text-sm text-ods-text-secondary">{stat.label}</p>
              <p className="text-2xl font-semibold text-ods-text-primary mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="p-4 bg-ods-bg-card rounded-lg border border-ods-border">
          <h2 className="text-lg font-medium text-ods-text-primary mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {[
              { action: 'Script executed', target: 'backup-daily.sh', time: '2 min ago' },
              { action: 'Device added', target: 'MacBook-Pro-15', time: '15 min ago' },
              { action: 'User invited', target: 'sarah@company.com', time: '1 hour ago' },
            ].map((activity, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b border-ods-border last:border-0">
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
}
