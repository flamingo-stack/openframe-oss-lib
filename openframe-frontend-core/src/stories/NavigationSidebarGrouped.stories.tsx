import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';

import {
  ActivityIcon,
  AlertTriangleIcon,
  BookBookmarkIcon,
  BracketCurlyEllipsisVrIcon,
  BracketCurlyIcon,
  BracketSquareCheckIcon,
  ChartDonutIcon,
  ClipboardListIcon,
  ClockHistoryIcon,
  FolderShieldIcon,
  HeadsetIcon,
  IdCardIcon,
  LaptopMobileIcon,
  Logout02Icon,
  MonitorIcon,
  Parcel02Icon,
  QuestionCircleIcon,
  Settings02Icon,
  TagIcon,
  TimerIcon,
} from '../components/icons-v2-generated';
import { AccountPopover, type AccountPopoverEntry } from '../components/navigation/account-popover';
import { MobileBurgerMenu } from '../components/navigation/mobile-burger-menu';
import { NavigationSidebar } from '../components/navigation/navigation-sidebar';
import type { NavigationSidebarConfig, NavigationSidebarItem } from '../types/navigation';

/** The Figma `navigation-sidebar` tree, with the app's real routes. */
const GROUPED_ITEMS: NavigationSidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <ChartDonutIcon />, path: '/dashboard' },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: <LaptopMobileIcon />,
    children: [
      { id: 'customers', label: 'Customers', icon: <IdCardIcon />, path: '/customers' },
      { id: 'devices', label: 'Devices', icon: <MonitorIcon />, path: '/devices', unreadCount: 3 },
      { id: 'software', label: 'Software', icon: <Parcel02Icon />, path: '/software', badge: 'Beta' },
    ],
  },
  {
    id: 'service-desk',
    label: 'Service Desk',
    icon: <HeadsetIcon />,
    children: [
      { id: 'tickets', label: 'Tickets', icon: <TagIcon />, path: '/tickets' },
      { id: 'worktime', label: 'Worktime', icon: <ClockHistoryIcon />, path: '/worktime' },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    icon: <BracketCurlyIcon />,
    children: [
      { id: 'scripts', label: 'Scripts', icon: <BracketCurlyIcon />, path: '/scripts' },
      { id: 'schedules', label: 'Schedules', icon: <TimerIcon />, path: '/scripts/schedules' },
      {
        id: 'policies',
        label: 'Policies',
        icon: <FolderShieldIcon />,
        path: '/monitoring?tab=policies',
        match: [{ path: '/monitoring', exact: true, query: { tab: 'policies' } }, '/monitoring/policy'],
      },
      {
        id: 'queries',
        label: 'Queries',
        icon: <BracketCurlyEllipsisVrIcon />,
        path: '/monitoring?tab=queries',
        match: [{ path: '/monitoring', exact: true, query: { tab: ['queries', null] } }, '/monitoring/query'],
      },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    icon: <ActivityIcon />,
    children: [
      { id: 'incidents', label: 'Incidents', icon: <AlertTriangleIcon />, path: '/incidents', badge: 'Beta' },
      {
        id: 'vulnerabilities',
        label: 'Vulnerabilities',
        icon: <BracketSquareCheckIcon />,
        path: '/software/vulnerabilities',
      },
      {
        id: 'logs',
        label: 'Logs',
        icon: <ClipboardListIcon />,
        path: '/logs-page',
        match: ['/logs-page', '/log-details'],
      },
    ],
  },
  { id: 'kb', label: 'Knowledge Base', icon: <BookBookmarkIcon />, path: '/knowledge-base', section: 'secondary' },
  { id: 'help', label: 'Help Center', icon: <QuestionCircleIcon />, path: '/help-center', section: 'secondary' },
  { id: 'settings', label: 'Settings', icon: <Settings02Icon />, path: '/settings', section: 'secondary' },
];

const ACCOUNT_ITEMS: AccountPopoverEntry[] = [
  { id: 'settings', label: 'Settings', icon: <Settings02Icon />, href: '/settings' },
  { id: 'help', label: 'Help Center', icon: <QuestionCircleIcon />, href: '/help-center' },
  { type: 'divider', id: 'divider' },
  { id: 'logout', label: 'Log out', icon: <Logout02Icon />, onSelect: fn(), tone: 'danger' },
];

/** Stand-in for the chat history the app passes as `sectionSlot`. */
function ChatHistoryPlaceholder() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)] border-t border-ods-border pt-[var(--spacing-system-s)]">
      <span className="px-[var(--spacing-system-xsf)] text-ods-text-secondary text-h5">Chat history</span>
      {Array.from({ length: 24 }, (_, i) => (
        <span key={i} className="truncate px-[var(--spacing-system-xsf)] py-[var(--spacing-system-xxs)] text-h6">
          Chat about device #{i + 1}
        </span>
      ))}
    </div>
  );
}

/** A router stand-in: `onNavigate` commits the path at once. */
function GroupedHost({ initialPath, config }: { initialPath: string; config?: Partial<NavigationSidebarConfig> }) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  return (
    <div className="flex h-screen bg-ods-bg">
      <NavigationSidebar
        config={{
          variant: 'grouped',
          items: GROUPED_ITEMS,
          currentPath,
          onNavigate: setCurrentPath,
          ...config,
        }}
      />
      <main className="flex-1 p-[var(--spacing-system-l)] text-ods-text-primary">
        <p className="text-h4">{currentPath}</p>
      </main>
    </div>
  );
}

const meta = {
  title: 'Navigation/NavigationSidebar/Grouped',
  component: NavigationSidebar,
  parameters: {
    layout: 'fullscreen',
    // These stories read no router. Out of the app-router context they also
    // render where its RedirectBoundary throws (`useRouter` … `data`) under a
    // mismatched next / @storybook/nextjs-vite pair.
    nextjs: { appDirectory: false },
    docs: {
      description: {
        component:
          "`variant: 'grouped'` — the Figma navigation sidebar: parents open into a bordered card, one group open at a time (the one holding the current page), a closed parent goes to its first child, an open one folds. Active entries resolve from `currentPath` through `match` / `path`.",
      },
    },
  },
  args: { config: { variant: 'grouped', items: GROUPED_ITEMS } },
} satisfies Meta<typeof NavigationSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Expanded, a child active: the open card, the label-only pill, the parent in accent. */
export const ActiveChild: Story = {
  render: () => <GroupedHost initialPath="/devices" />,
};

/** Query-aware: `/monitoring?tab=policies` lights Policies, not Queries. */
export const ActiveChildByQuery: Story = {
  render: () => <GroupedHost initialPath="/monitoring?tab=policies" />,
};

/** A top-level entry active: the full-row pill, every group closed. */
export const TopLevelActive: Story = {
  render: () => <GroupedHost initialPath="/dashboard" />,
};

/** A group open with no child active — the parent matched the page itself. */
export const GroupOpenWithoutActiveChild: Story = {
  render: () => (
    <GroupedHost
      initialPath="/inventory"
      config={{
        items: GROUPED_ITEMS.map(item => (item.id === 'inventory' ? { ...item, match: '/inventory' } : item)),
      }}
    />
  ),
};

/** `groupParentClick: 'expand'` — a closed parent only opens. */
export const ExpandOnly: Story = {
  render: () => <GroupedHost initialPath="/devices" config={{ groupParentClick: 'expand' }} />,
};

/** The 56px rail (controlled): icon cells, the open group's card with its child icons on the connector. */
export const Collapsed: Story = {
  render: function CollapsedStory() {
    const [collapsed, setCollapsed] = useState(true);
    return <GroupedHost initialPath="/logs-page" config={{ collapsed, onCollapsedChange: setCollapsed }} />;
  },
};

/** The chat history below the tree (`sectionSlot`) and the account row above the toggle (`footerSlot`). */
export const WithSectionAndFooter: Story = {
  render: () => (
    <GroupedHost
      initialPath="/scripts/schedules"
      config={{
        sectionSlot: <ChatHistoryPlaceholder />,
        footerSlot: ({ minimized }) => (
          <AccountPopover
            collapsed={minimized}
            name="Ada Lovelace"
            email="ada@acme.example"
            subtitle="acme.openframe.ai"
            items={ACCOUNT_ITEMS}
          />
        ),
      }}
    />
  ),
};

/** The account menu open above the expanded row (starts open; it closes like any menu). */
export const AccountMenuOpen: Story = {
  render: function AccountMenuOpenStory() {
    const [open, setOpen] = useState(true);
    return (
      <GroupedHost
        initialPath="/devices"
        config={{
          footerSlot: ({ minimized }) => (
            <AccountPopover
              open={open}
              onOpenChange={setOpen}
              collapsed={minimized}
              name="Ada Lovelace"
              email="ada@acme.example"
              subtitle="acme.openframe.ai"
              items={ACCOUNT_ITEMS}
            />
          ),
        }}
      />
    );
  },
};

/** Collapsed: the avatar alone, and the menu opens beside the rail. */
export const CollapsedAccountMenuOpen: Story = {
  render: function CollapsedAccountMenuOpenStory() {
    const [open, setOpen] = useState(true);
    const [collapsed, setCollapsed] = useState(true);
    return (
      <GroupedHost
        initialPath="/devices"
        config={{
          collapsed,
          onCollapsedChange: setCollapsed,
          footerSlot: ({ minimized }) => (
            <AccountPopover
              open={open}
              onOpenChange={setOpen}
              collapsed={minimized}
              name="Ada Lovelace"
              email="ada@acme.example"
              subtitle="acme.openframe.ai"
              items={ACCOUNT_ITEMS}
            />
          ),
        }}
      />
    );
  },
};

/** Placeholder rows in the grouped geometry while the host resolves its entries. */
export const Loading: Story = {
  render: () => (
    <GroupedHost initialPath="/devices" config={{ loading: true, loadingRows: { primary: 5, secondary: 3 } }} />
  ),
};

/** The phone: the burger menu as a 300px drawer with the same tree and slots. */
export const MobileBurgerGrouped: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: function MobileStory() {
    const [currentPath, setCurrentPath] = useState('/tickets');
    const [open, setOpen] = useState(true);
    return (
      <div className="relative h-screen bg-ods-bg">
        <div className="flex h-14 items-center border-b border-ods-border px-[var(--spacing-system-m)]">
          <button type="button" className="text-ods-text-primary text-h6" onClick={() => setOpen(o => !o)}>
            {open ? 'Close menu' : 'Open menu'}
          </button>
        </div>
        <MobileBurgerMenu
          isOpen={open}
          onClose={() => setOpen(false)}
          config={{
            variant: 'grouped',
            items: GROUPED_ITEMS,
            currentPath,
            onNavigate: setCurrentPath,
            sectionSlot: <ChatHistoryPlaceholder />,
            footerSlot: (
              <AccountPopover
                name="Ada Lovelace"
                email="ada@acme.example"
                subtitle="acme.openframe.ai"
                items={ACCOUNT_ITEMS}
              />
            ),
          }}
        />
      </div>
    );
  },
};
