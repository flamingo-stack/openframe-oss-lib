import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'

import {
  BracketCurlyIcon,
  ChartDonutIcon,
  IdCardIcon,
  MonitorIcon,
  Settings02Icon,
} from '../components/icons-v2-generated'
import {
  AppLayout,
  AppLayoutDrawer,
  AppLayoutDrawerBody,
  AppLayoutDrawerContent,
  AppLayoutDrawerDescription,
  AppLayoutDrawerHeader,
  AppLayoutDrawerTitle,
} from '../components/navigation'
import { Button } from '../components/ui/button'
import { NavigationSidebarConfig } from '../types/navigation'

const navigationItems: NavigationSidebarConfig['items'] = [
  { id: 'dashboard', label: 'Dashboard', icon: <ChartDonutIcon size={24} />, path: '/dashboard', isActive: true },
  { id: 'customers', label: 'Customers', icon: <IdCardIcon size={24} />, path: '/customers' },
  { id: 'devices', label: 'Devices', icon: <MonitorIcon size={24} />, path: '/devices' },
  { id: 'scripts', label: 'Scripts', icon: <BracketCurlyIcon size={24} />, path: '/scripts' },
  { id: 'settings', label: 'Settings', icon: <Settings02Icon size={24} />, path: '/settings', section: 'secondary' },
]

const meta = {
  title: 'Navigation/AppLayoutDrawer',
  component: AppLayoutDrawer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
A Drawer variant that renders **inside** AppLayout's main content area
instead of as a viewport-level overlay. The sidebar and header remain
visible and interactive while it is open.

## When to use
- Side panels (chat, details, filters) that should not cover the global
  chrome (header, sidebar).
- Anything that conceptually belongs to the current page rather than the
  whole app.

For an overlay that covers the entire viewport (e.g. notifications,
auth modals), use the standard \`Drawer\` from \`components/ui\` instead.
        `,
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AppLayoutDrawer>

export default meta
type Story = StoryObj<typeof meta>

function DashboardChildren({ onOpenDrawer }: { onOpenDrawer: () => void }) {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-ods-text-primary">Devices Overview</h1>
        <p className="text-ods-text-secondary mt-1">8,250 Devices in Total</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Active Devices', value: '6,930' },
          { label: 'Active Tickets', value: '136' },
          { label: 'Resolved Tickets', value: '825' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 bg-ods-card rounded-lg border border-ods-border">
            <p className="text-sm text-ods-text-secondary">{stat.label}</p>
            <p className="text-2xl font-semibold text-ods-text-primary mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
      <Button onClick={onOpenDrawer}>Open in-layout drawer</Button>
    </div>
  )
}

/**
 * Right-side in-layout drawer, passed via the `drawer` slot prop.
 * The drawer is persistent — clicks on the overlay/header/sidebar
 * do NOT close it; use the X button or Escape.
 */
export const Right: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <AppLayout
        sidebarConfig={{ items: navigationItems, onNavigate: fn(), onToggleMinimized: fn() }}
        headerProps={{
          showNotifications: true,
          showUser: true,
          userName: 'Mingo AI',
          userEmail: 'mingo@openframe.dev',
          onProfile: fn(),
          onLogout: fn(),
        }}
        mobileBurgerMenuProps={{
          user: {
            userName: 'Mingo AI',
            userEmail: 'mingo@openframe.dev',
            userRole: 'Admin',
          },
        }}
        drawer={
          <AppLayoutDrawer open={open} onOpenChange={setOpen}>
            <AppLayoutDrawerContent side="right">
              <AppLayoutDrawerHeader>
                <AppLayoutDrawerTitle>Current Chats</AppLayoutDrawerTitle>
                <AppLayoutDrawerDescription>
                  Persistent: clicks on AppLayout chrome don&apos;t close this.
                </AppLayoutDrawerDescription>
              </AppLayoutDrawerHeader>
              <AppLayoutDrawerBody>
                <p className="text-sm text-ods-text-secondary">Chat content goes here.</p>
              </AppLayoutDrawerBody>
            </AppLayoutDrawerContent>
          </AppLayoutDrawer>
        }
      >
        <DashboardChildren onOpenDrawer={() => setOpen(true)} />
      </AppLayout>
    )
  },
}

/**
 * Resizable variant — drag the inside edge to resize. Clamped to the
 * AppLayout main-area dimensions (not the viewport).
 */
export const ResizableRight: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <AppLayout
        sidebarConfig={{ items: navigationItems, onNavigate: fn(), onToggleMinimized: fn() }}
        headerProps={{
          showNotifications: true,
          showUser: true,
          userName: 'Mingo AI',
          userEmail: 'mingo@openframe.dev',
          onProfile: fn(),
          onLogout: fn(),
        }}
        mobileBurgerMenuProps={{
          user: {
            userName: 'Mingo AI',
            userEmail: 'mingo@openframe.dev',
            userRole: 'Admin',
          },
        }}
        drawer={
          <AppLayoutDrawer open={open} onOpenChange={setOpen}>
            <AppLayoutDrawerContent
              side="right"
              resizable
              minSize={360}
              defaultSize={560}
              storageKey="storybook:app-layout-drawer:right"
            >
              <AppLayoutDrawerHeader>
                <AppLayoutDrawerTitle>Resizable Drawer</AppLayoutDrawerTitle>
              </AppLayoutDrawerHeader>
              <AppLayoutDrawerBody>
                <p className="text-sm text-ods-text-secondary">
                  Drag the grip on the left edge to resize. The panel can extend all
                  the way to the container edge (minus a 16px symmetric gap).
                </p>
              </AppLayoutDrawerBody>
            </AppLayoutDrawerContent>
          </AppLayoutDrawer>
        }
      >
        <DashboardChildren onOpenDrawer={() => setOpen(true)} />
      </AppLayout>
    )
  },
}

/**
 * Left-side variant.
 */
export const Left: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <AppLayout
        sidebarConfig={{ items: navigationItems, onNavigate: fn(), onToggleMinimized: fn() }}
        headerProps={{
          showNotifications: true,
          showUser: true,
          userName: 'Mingo AI',
          userEmail: 'mingo@openframe.dev',
          onProfile: fn(),
          onLogout: fn(),
        }}
        mobileBurgerMenuProps={{
          user: {
            userName: 'Mingo AI',
            userEmail: 'mingo@openframe.dev',
            userRole: 'Admin',
          },
        }}
        drawer={
          <AppLayoutDrawer open={open} onOpenChange={setOpen}>
            <AppLayoutDrawerContent side="left">
              <AppLayoutDrawerHeader>
                <AppLayoutDrawerTitle>Filters</AppLayoutDrawerTitle>
              </AppLayoutDrawerHeader>
              <AppLayoutDrawerBody>
                <p className="text-sm text-ods-text-secondary">Left-side drawer content.</p>
              </AppLayoutDrawerBody>
            </AppLayoutDrawerContent>
          </AppLayoutDrawer>
        }
      >
        <DashboardChildren onOpenDrawer={() => setOpen(true)} />
      </AppLayout>
    )
  },
}
