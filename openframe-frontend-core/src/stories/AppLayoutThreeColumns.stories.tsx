import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { MingoChatHistorySection } from '../components/chat/mingo-chat-history-section';
import type { DialogItem } from '../components/chat/types/component.types';
import {
  ActivityIcon,
  AlertTriangleIcon,
  BellIcon,
  BookBookmarkIcon,
  BracketCurlyEllipsisVrIcon,
  BracketCurlyIcon,
  ClipboardListIcon,
  ClockHistoryIcon,
  CloudIcon,
  FolderShieldIcon,
  HeadsetIcon,
  IdCardIcon,
  LaptopMobileIcon,
  LightningIcon,
  ListBulletIcon,
  MonitorIcon,
  Parcel02Icon,
  PlusCircleIcon,
  QuestionCircleIcon,
  Settings02Icon,
  SidebarIcon,
  TagIcon,
  TimerIcon,
  UsersIcon,
} from '../components/icons-v2-generated';
import { AppColumnHeader } from '../components/navigation/app-column-header';
import { AppLayout } from '../components/navigation/app-layout';
import type { AppLayoutWorkAreaMode } from '../components/navigation/app-layout-work-area';
import { NavigationSidebarActionRow } from '../components/navigation/navigation-sidebar-grouped';
import type { NavigationSidebarItem } from '../types/navigation';

/** The right navigation of the three-column shell (Figma "chat variations", `nav/item`). */
const NAV_ITEMS: NavigationSidebarItem[] = [
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
    id: 'fleet',
    label: 'Fleet',
    icon: <LaptopMobileIcon />,
    children: [
      { id: 'customers', label: 'Customers', icon: <IdCardIcon />, path: '/customers' },
      { id: 'devices', label: 'Devices', icon: <MonitorIcon />, path: '/devices' },
      { id: 'software', label: 'Software', icon: <Parcel02Icon />, path: '/software' },
      { id: 'users', label: 'Users', icon: <UsersIcon />, path: '/settings/employees' },
      { id: 'tenants', label: 'Cloud Tenants', icon: <CloudIcon />, path: '/cloud-tenants' },
    ],
  },
  {
    id: 'monitor',
    label: 'Monitor',
    icon: <ActivityIcon />,
    children: [
      { id: 'incidents', label: 'Incidents', icon: <AlertTriangleIcon />, path: '/incidents' },
      { id: 'logs', label: 'Logs', icon: <ClipboardListIcon />, path: '/logs' },
    ],
  },
  {
    id: 'skills',
    label: 'Skills',
    icon: <LightningIcon />,
    children: [
      { id: 'scripts', label: 'Scripts', icon: <BracketCurlyIcon />, path: '/scripts' },
      { id: 'schedules', label: 'Scheduled Scripts', icon: <TimerIcon />, path: '/scripts/schedules' },
      { id: 'policies', label: 'Policies', icon: <FolderShieldIcon />, path: '/monitoring?tab=policies' },
      { id: 'queries', label: 'Queries', icon: <BracketCurlyEllipsisVrIcon />, path: '/monitoring?tab=queries' },
    ],
  },
  { id: 'kb', label: 'Knowledge Base', icon: <BookBookmarkIcon />, path: '/knowledge-base', section: 'secondary' },
  { id: 'help', label: 'Help Center', icon: <QuestionCircleIcon />, path: '/help-center', section: 'secondary' },
  { id: 'settings', label: 'Settings', icon: <Settings02Icon />, path: '/settings', section: 'secondary' },
];

const HOUR = 60 * 60 * 1000;
const CHATS: DialogItem[] = [
  'Check devices',
  'Migrating clients from on-prem Exchange',
  'Intune compliance policy for BYOD devices',
  'Automating patch reports with PowerShell',
  'RMM alert tuning to reduce noise',
  'Conditional Access rollout without lockouts',
  'Veeam backup job failing on VSS errors',
].map((title, i) => ({ id: `chat-${i}`, title, timestamp: new Date(Date.now() - i * 9 * HOUR) }));

const meta = {
  title: 'Navigation/AppLayout three columns',
  component: AppLayout,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppLayout>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The left sidebar's footer (Figma `user`): one 56px row expanded — avatar, name and
 * three 32px icon buttons, all on one centre line; in the rail a column, each
 * centred: avatar, Worktime, bell, collapse.
 */
function ChatsFooter({ minimized, onCollapse }: { minimized: boolean; onCollapse: () => void }) {
  const button =
    'flex size-8 shrink-0 items-center justify-center rounded-md text-ods-text-panel-secondary hover:bg-ods-bg-hover hover:text-ods-text-primary';
  const cells = (
    <>
      <button type="button" className={button} aria-label="Worktime">
        <ClockHistoryIcon size={20} />
      </button>
      <button type="button" className={button} aria-label="Notifications">
        <BellIcon size={20} />
      </button>
      <button
        type="button"
        className={button}
        aria-label={minimized ? 'Show chats' : 'Hide chats'}
        onClick={onCollapse}
      >
        <SidebarIcon size={20} />
      </button>
    </>
  );
  const avatar = (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ods-flamingo-cyan text-ods-text-on-accent text-badge">
      RS
    </span>
  );
  if (minimized) {
    return (
      <div className="flex flex-col items-center gap-[var(--spacing-system-xsf)] py-[var(--spacing-system-sf)]">
        <span className="flex size-8 items-center justify-center">{avatar}</span>
        {cells}
      </div>
    );
  }
  return (
    <div className="flex h-14 items-center gap-[var(--spacing-system-xsf)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xsf)]">
      {avatar}
      <span className="min-w-0 flex-1 truncate text-ods-text-primary text-shell-body">Roman Smith</span>
      <span className="flex items-center">{cells}</span>
    </div>
  );
}

/**
 * The chats on the left, the chat and the page in the middle, the navigation on
 * the right. A chat opens in the chat column; a navigation entry opens its page
 * beside it; each column's header takes its side full screen or closes it.
 */
function ThreeColumns({ initialMode, squeezeFloor }: { initialMode: AppLayoutWorkAreaMode; squeezeFloor?: number }) {
  const [mode, setMode] = useState<AppLayoutWorkAreaMode>(initialMode);
  const [chat, setChat] = useState<DialogItem | null>(initialMode === 'page' ? null : CHATS[0]);
  const [path, setPath] = useState(initialMode === 'chat' ? null : '/devices');
  const [chatsCollapsed, setChatsCollapsed] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [scope, setScope] = useState<'my' | 'all'>('my');
  const page = NAV_ITEMS.flatMap(item => item.children ?? [item]).find(item => item.path === path);

  const openChat = (dialog: DialogItem | null) => {
    setChat(dialog);
    setMode(path ? 'split' : 'chat');
  };

  return (
    <AppLayout
      sidebarConfig={{
        variant: 'grouped',
        items: [],
        surface: 'panel',
        expandedWidth: 280,
        resizable: { minWidth: 200, maxWidth: 480, storageKey: 'storybook.chats-width' },
        toggle: 'none',
        footerInset: false,
        sectionDivider: false,
        collapsed: chatsCollapsed,
        onCollapsedChange: setChatsCollapsed,
        // No tablet rail between md and lg: the sidebars close only with their button.
        desktopFromMd: true,
        topSlot: ({ minimized }) => (
          <NavigationSidebarActionRow
            size="sectioned"
            label="Start Work"
            icon={<PlusCircleIcon />}
            active={chat === null && mode !== 'page'}
            minimized={minimized}
            onClick={() => openChat(null)}
          />
        ),
        sectionSlot: ({ minimized }) =>
          minimized ? (
            <NavigationSidebarActionRow
              size="sectioned"
              label="Chats"
              icon={<ListBulletIcon />}
              minimized
              onClick={() => setChatsCollapsed(false)}
            />
          ) : (
            <MingoChatHistorySection
              density="compact"
              dialogs={CHATS}
              activeDialogId={mode !== 'page' ? chat?.id : undefined}
              onSelectDialog={id => openChat(CHATS.find(dialog => dialog.id === id) ?? null)}
              onSearchChange={() => undefined}
              onOpenArchive={() => undefined}
              onRequestRename={() => undefined}
              onRequestArchive={() => undefined}
              scope={scope}
              onScopeChange={setScope}
            />
          ),
        footerSlot: ({ minimized }) => (
          <ChatsFooter minimized={minimized} onCollapse={() => setChatsCollapsed(!chatsCollapsed)} />
        ),
      }}
      endSidebarConfig={{
        variant: 'sectioned',
        surface: 'panel',
        items: NAV_ITEMS,
        header: false,
        toggle: 'icon',
        expandedWidth: 200,
        collapsed: navCollapsed,
        onCollapsedChange: setNavCollapsed,
        desktopFromMd: true,
        currentPath: mode === 'chat' ? undefined : (path ?? undefined),
        onNavigate: next => {
          setPath(next);
          setMode(mode === 'chat' ? 'split' : mode);
        },
      }}
      headerProps={{}}
      desktopHeader={false}
      mobileBurgerMenuProps={{}}
      animateSidebars
      pageHeader={
        <AppColumnHeader
          title={page?.label ?? 'Page'}
          layoutAction={mode === 'split' ? 'fullscreen' : chat ? 'restore-split' : undefined}
          onLayoutAction={() => setMode(mode === 'split' ? 'page' : 'split')}
          onClose={() => {
            setPath(null);
            setMode('chat');
          }}
          closeLabel="Close page"
        />
      }
      workAreaMode={mode}
      workAreaStorageKey={squeezeFloor ? 'storybook.work-area-squeeze' : 'storybook.work-area'}
      workAreaSqueezeFloor={squeezeFloor}
      chatColumn={
        <div className="flex h-full flex-col">
          <AppColumnHeader
            title={chat?.title ?? 'Start Work'}
            layoutAction={mode === 'split' ? 'fullscreen' : path && chat ? 'restore-split' : undefined}
            onLayoutAction={() => setMode(mode === 'split' ? 'chat' : 'split')}
            onClose={chat ? () => (path ? (setChat(null), setMode('page')) : setChat(null)) : undefined}
            closeLabel="Close chat"
          />
          <div className="flex flex-1 items-center justify-center text-ods-text-secondary text-h6">
            {chat ? `Thread of “${chat.title}”` : 'Good morning — what needs doing today?'}
          </div>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-l)] text-ods-text-secondary text-h6">
          <p>Content of {page?.label}</p>
          {/* Three blocks across: squeezed below the column's min width, they keep it and scroll sideways. */}
          <div className="grid grid-cols-3 gap-[var(--spacing-system-xsf)]">
            {['Online', 'Offline', 'Pending'].map(label => (
              <div key={label} className="rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]">
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

const placeholderArgs = {
  children: null,
  sidebarConfig: { items: [] },
  headerProps: {},
  mobileBurgerMenuProps: {},
};

export const Split: Story = { args: placeholderArgs, render: () => <ThreeColumns initialMode="split" /> };
export const ChatFullScreen: Story = { args: placeholderArgs, render: () => <ThreeColumns initialMode="chat" /> };
export const PageFullScreen: Story = { args: placeholderArgs, render: () => <ThreeColumns initialMode="page" /> };
/** `workAreaSqueezeFloor` 0.3: drag the divider past a column's 360px; it folds to 108px, scrolls sideways, a shadow marks it. */
export const SplitSqueezable: Story = {
  args: placeholderArgs,
  render: () => <ThreeColumns initialMode="split" squeezeFloor={0.3} />,
};
