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
import { NavigationSidebarConfig } from '../types/navigation'

const navigationItems: NavigationSidebarConfig['items'] = [
  { id: 'dashboard', label: 'Dashboard', icon: <ChartDonutIcon size={24} />, path: '/dashboard', isActive: true },
  { id: 'customers', label: 'Customers', icon: <IdCardIcon size={24} />, path: '/customers' },
  { id: 'devices', label: 'Devices', icon: <MonitorIcon size={24} />, path: '/devices' },
  { id: 'scripts', label: 'Scripts', icon: <BracketCurlyIcon size={24} />, path: '/scripts' },
  { id: 'settings', label: 'Settings', icon: <Settings02Icon size={24} />, path: '/settings', section: 'secondary' },
]

const meta = {
  title: 'Navigation/AppLayoutSidebar',
  component: AppLayout,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
\`AppLayout\` wired so the **Mingo AI** header button toggles a right-side,
in-layout sidebar (an \`AppLayoutDrawer\`). The sidebar renders inside the
main content area — the navigation sidebar and header stay visible and
interactive while it is open.

The header button reflects the open state via \`isMingoAIActive\`, and the
sidebar is persistent: clicks on the header/sidebar/overlay do not close it
(use the X button or Escape).
        `,
      },
    },
  },
  tags: ['autodocs'],
  args: {
    children: null,
    sidebarConfig: { items: navigationItems, onNavigate: fn(), onToggleMinimized: fn() },
    headerProps: {},
    mobileBurgerMenuProps: {},
  },
} satisfies Meta<typeof AppLayout>

export default meta
type Story = StoryObj<typeof meta>

function DashboardChildren() {
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
      <p className="text-ods-text-secondary">
        Click <span className="font-medium text-ods-text-primary">Mingo AI</span> in the header to open the chat sidebar.
      </p>
    </div>
  )
}

/**
 * Mingo AI header button toggles the right-side chat sidebar.
 */
export const Default: Story = {
  render: function Render() {
    const [open, setOpen] = useState(false)
    return (
      <AppLayout
        sidebarConfig={{ items: navigationItems, onNavigate: fn(), onToggleMinimized: fn() }}
        headerProps={{
          showNotifications: true,
          showMingoAI: true,
          onMingoAI: () => setOpen((prev) => !prev),
          isMingoAIActive: open,
          showUser: true,
          userName: 'Alex Developer',
          userEmail: 'alex@openframe.dev',
          onProfile: fn(),
          onLogout: fn(),
        }}
        mobileBurgerMenuProps={{
          user: {
            userName: 'Alex Developer',
            userEmail: 'alex@openframe.dev',
            userRole: 'Admin',
          },
        }}
        drawer={
          <AppLayoutDrawer open={open} onOpenChange={setOpen}>
            <AppLayoutDrawerContent side="right">
              <AppLayoutDrawerHeader>
                <AppLayoutDrawerTitle>Mingo AI</AppLayoutDrawerTitle>
                <AppLayoutDrawerDescription>
                  Ask Mingo about your devices, tickets, and scripts.
                </AppLayoutDrawerDescription>
              </AppLayoutDrawerHeader>
              <AppLayoutDrawerBody>
                <p className="text-sm text-ods-text-secondary">Chat content goes here.</p>
              </AppLayoutDrawerBody>
            </AppLayoutDrawerContent>
          </AppLayoutDrawer>
        }
      >
        <DashboardChildren />
      </AppLayout>
    )
  },
}

/**
 * Resizable chat sidebar — drag the inside edge to resize. Starts open.
 */
export const Resizable: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <AppLayout
        sidebarConfig={{ items: navigationItems, onNavigate: fn(), onToggleMinimized: fn() }}
        headerProps={{
          showNotifications: true,
          showMingoAI: true,
          onMingoAI: () => setOpen((prev) => !prev),
          isMingoAIActive: open,
          showUser: true,
          userName: 'Alex Developer',
          userEmail: 'alex@openframe.dev',
          onProfile: fn(),
          onLogout: fn(),
        }}
        mobileBurgerMenuProps={{
          user: {
            userName: 'Alex Developer',
            userEmail: 'alex@openframe.dev',
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
              storageKey="storybook:app-layout-sidebar:mingo"
            >
              <AppLayoutDrawerHeader>
                <AppLayoutDrawerTitle>Mingo AI</AppLayoutDrawerTitle>
              </AppLayoutDrawerHeader>
              <AppLayoutDrawerBody>
                <p className="text-sm text-ods-text-secondary">
                  Drag the grip on the left edge to resize the chat sidebar.
                </p>
              </AppLayoutDrawerBody>
            </AppLayoutDrawerContent>
          </AppLayoutDrawer>
        }
      >
        <DashboardChildren />
      </AppLayout>
    )
  },
}
