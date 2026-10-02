import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useContext, useState } from 'react';
import { fn } from 'storybook/test';

import { EmbeddableChat } from '../components/chat/embeddable-chat';
import type { UnifiedChatMessage, UnifiedChatState } from '../components/chat/types/unified-chat-state.types';
import {
  BracketCurlyIcon,
  ChartDonutIcon,
  IdCardIcon,
  MonitorIcon,
  Settings02Icon,
} from '../components/icons-v2-generated';
import { PageLayout } from '../components/layout/page-layout';
import { AppLayout } from '../components/navigation/app-layout';
import type { AppLayoutSidePanelRenderState } from '../components/navigation/app-layout-side-panel';
import { Button } from '../components/ui/button';
import { DashboardInfoCard } from '../components/ui/dashboard-info-card';
import { type ColumnDef, DataTable, useDataTable } from '../components/ui/data-table';
import { Tag } from '../components/ui/tag';
import { type ChatRuntime, ChatRuntimeContext } from '../contexts/chat-runtime-context';
import { ContentAreaWidthContext, useContentBreakpoint } from '../hooks/ui/use-content-breakpoint';
import type { NavigationSidebarConfig } from '../types/navigation';
import { cn } from '../utils/cn';

const NAV_ITEMS: NavigationSidebarConfig['items'] = [
  { id: 'dashboard', label: 'Dashboard', icon: <ChartDonutIcon size={24} />, path: '/dashboard', isActive: true },
  { id: 'customers', label: 'Customers', icon: <IdCardIcon size={24} />, path: '/customers' },
  { id: 'devices', label: 'Devices', icon: <MonitorIcon size={24} />, path: '/devices' },
  { id: 'scripts', label: 'Scripts', icon: <BracketCurlyIcon size={24} />, path: '/scripts' },
  { id: 'settings', label: 'Settings', icon: <Settings02Icon size={24} />, path: '/settings', section: 'secondary' },
];

const CHATS = [
  'Migrating clients from on-prem Exchange to M365',
  'Intune compliance policy for BYOD devices',
  'Automating patch reports with PowerShell',
  'RMM alert tuning to reduce noise',
  'Conditional Access rollout without lockouts',
  'Veeam backup job failing on VSS errors',
];

// Chat list and conversation side by side from this panel width.
const SPLIT_WIDTH = 696;
const LIST_WIDTH = 296;

function ContentProbe() {
  const width = useContext(ContentAreaWidthContext);
  const breakpoint = useContentBreakpoint();
  return (
    <p className="text-ods-text-secondary text-h6">
      Content area {width ?? '-'}px, laid out as <span className="text-ods-accent">{breakpoint}</span>
    </p>
  );
}

function Section({ title, caption, children }: { title: string; caption: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-[var(--spacing-system-l)]">
      <div>
        <h2 className="text-ods-text-primary text-h2">{title}</h2>
        <p className="text-ods-text-secondary text-h6">{caption}</p>
      </div>
      {children}
    </section>
  );
}

function Dashboard() {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xl)] p-[var(--spacing-system-l)]">
      <ContentProbe />
      <Section title="Devices Overview" caption="8,250 Devices in Total">
        <div className="grid grid-cols-2 gap-[var(--spacing-system-m)] content-lg:grid-cols-4">
          <DashboardInfoCard
            title="Online Devices"
            value={160}
            percentage={80}
            showProgress
            progressVariant="success"
          />
          <DashboardInfoCard title="Offline Devices" value={20} percentage={10} showProgress progressVariant="error" />
          <DashboardInfoCard title="Pending Devices" value={14} percentage={7} showProgress progressVariant="warning" />
          <DashboardInfoCard title="Archived Devices" value={6} percentage={3} showProgress progressVariant="info" />
        </div>
      </Section>
      <Section title="Tickets Overview" caption="1,250 Tickets in Total">
        <div className="grid grid-cols-2 gap-[var(--spacing-system-m)] content-lg:grid-cols-4">
          <DashboardInfoCard title="AI Handling" value={75} />
          <DashboardInfoCard title="Tech Required" value={10} />
          <DashboardInfoCard title="Resolved" value={87} />
          <DashboardInfoCard title="Other Statuses" value={29} />
        </div>
      </Section>
      <Section title="Customers Overview" caption="10 Customers in Total">
        <div className="grid grid-cols-1 gap-[var(--spacing-system-m)] content-md:grid-cols-2">
          <DashboardInfoCard
            title="Active Devices"
            value="1,190"
            percentage={85}
            showProgress
            progressVariant="success"
          />
          <DashboardInfoCard title="Inactive Devices" value={210} percentage={15} showProgress progressVariant="info" />
        </div>
      </Section>
    </div>
  );
}

interface DeviceRow {
  id: string;
  hostname: string;
  ip: string;
  os: string;
  status: 'Online' | 'Offline';
  owner: string;
  lastSeen: string;
}

const DEVICES: DeviceRow[] = Array.from({ length: 12 }, (_, i) => ({
  id: `d-${i}`,
  hostname: `ACME-FIN-LAPTOP-${String(i + 1).padStart(2, '0')}`,
  ip: `10.0.4.${20 + i}`,
  os: i % 3 === 0 ? 'macOS' : i % 3 === 1 ? 'Windows' : 'Linux',
  status: i % 4 === 0 ? 'Offline' : 'Online',
  owner: ['Ada Lovelace', 'Alan Turing', 'Grace Hopper'][i % 3] ?? '',
  lastSeen: `${i + 2} min ago`,
}));

const DEVICE_COLUMNS: ColumnDef<DeviceRow>[] = [
  { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'flex-1 min-w-[200px]' } },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Tag variant={row.original.status === 'Online' ? 'success' : 'grey'} label={row.original.status} />
    ),
    meta: { width: 'w-[120px] shrink-0' },
  },
  { accessorKey: 'os', header: 'OS', meta: { width: 'w-[120px] shrink-0', hideAt: 'md' } },
  { accessorKey: 'ip', header: 'IP', meta: { width: 'w-[140px] shrink-0', hideAt: 'lg' } },
  { accessorKey: 'owner', header: 'Owner', meta: { width: 'w-[180px] shrink-0', hideAt: ['md', 'lg'] } },
  { accessorKey: 'lastSeen', header: 'Last seen', meta: { width: 'w-[140px] shrink-0', hideAt: ['md', 'lg'] } },
];

function DevicesPage() {
  const table = useDataTable<DeviceRow>({ data: DEVICES, columns: DEVICE_COLUMNS, getRowId: row => row.id });
  return (
    <PageLayout
      title="Devices"
      subtitle="12 devices"
      actions={[
        { label: 'Add Device', onClick: fn(), variant: 'primary' },
        { label: 'Export', onClick: fn(), variant: 'outline' },
      ]}
    >
      <ContentProbe />
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body />
      </DataTable>
    </PageLayout>
  );
}

function ChatList({ active, onOpen }: { active: number | null; onOpen: (index: number) => void }) {
  return (
    <nav
      aria-label="Your current chats"
      className="flex min-h-0 flex-col gap-[var(--spacing-system-xs)] p-[var(--spacing-system-xs)]"
    >
      <p className="px-[var(--spacing-system-s)] pt-[var(--spacing-system-l)] text-ods-text-secondary text-h5">
        Your current chats
      </p>
      {CHATS.map((chat, index) => (
        <Button
          key={chat}
          variant="transparent"
          size="wrap"
          fullWidth
          onClick={() => onOpen(index)}
          className={cn(
            'justify-start truncate rounded-sm px-[var(--spacing-system-s)] py-[var(--spacing-system-xs)] text-h4',
            index === active && 'bg-ods-accent/20 text-ods-accent',
          )}
        >
          <span className="truncate">{chat}</span>
        </Button>
      ))}
    </nav>
  );
}

function Conversation({ title, onShowList }: { title: string; onShowList?: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-12 items-center gap-[var(--spacing-system-s)] border-b border-ods-border px-[var(--spacing-system-m)]">
        {onShowList && (
          <Button variant="outline" size="sm" onClick={onShowList}>
            Chats
          </Button>
        )}
        <p className="truncate text-ods-text-primary text-h4">{title}</p>
      </header>
      <div className="flex flex-1 flex-col justify-end gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
        <p className="text-ods-text-primary text-h4">why is osqueryd.exe cert expiring in 3 days?</p>
        <p className="text-ods-text-secondary text-h4">
          The renewal job ran 6 hours ago but didn&apos;t complete. Chat text stays at the viewport size however narrow
          the page beside it gets.
        </p>
        <div className="rounded-md border border-ods-border px-[var(--spacing-system-m)] py-[var(--spacing-system-s)] text-ods-text-secondary text-h4">
          Enter your Request...
        </div>
      </div>
    </div>
  );
}

/** Stand-in for the Mingo panel: the list alone at its minimum, list + chat once both fit. */
function MockMingo({ width, mode }: AppLayoutSidePanelRenderState) {
  const [active, setActive] = useState<number | null>(null);
  const split = width >= SPLIT_WIDTH;
  const title = active === null ? 'New Chat' : CHATS[active];

  if (split) {
    return (
      <div className="flex min-w-0 flex-1">
        <div className="shrink-0 border-r border-ods-border" style={{ width: LIST_WIDTH }}>
          <ChatList active={active} onOpen={setActive} />
        </div>
        <Conversation title={title} />
      </div>
    );
  }
  // One column: the open chat when it fits (400px), else the list.
  if (active !== null && (width >= 400 || mode !== 'docked')) {
    return <Conversation title={title} onShowList={() => setActive(null)} />;
  }
  return (
    <div className="min-w-0 flex-1">
      <ChatList active={active} onOpen={setActive} />
    </div>
  );
}

const RUNTIME: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/__story__/chat',
    approvalToolUrl: '/__story__/confirm-tool',
    commandsUrl: '/__story__/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/__story__/upload',
    attachmentViewUrlPrefix: '/__story__/view/',
    identityUrl: '/__story__/identity',
  },
  navigation: { mode: 'embed', defaultContentOrigin: 'https://example.com' },
  source: 'storybook',
};
const QUERY_CLIENT = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const AT = new Date('2026-10-02T14:47:00');
const MINGO_MESSAGES: UnifiedChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    name: 'Roman Smith',
    authorType: 'admin',
    content: 'why is osqueryd.exe cert expiring in 3 days?',
    timestamp: AT,
  },
  {
    id: 'm2',
    role: 'assistant',
    name: 'Mingo',
    authorType: 'mingo',
    content:
      "The renewal job ran ~6 hours ago but didn't complete. osqueryd.exe cert expires in 3 days - if it's not renewed before then, the agent will fail signature validation and stop reporting.\n\nWant me to trigger a manual renewal or check what blocked the last attempt?",
    timestamp: AT,
  },
];

/** A static Mingo thread through the `mingoState` injection path: no transport. */
function createMingoState(): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages: MINGO_MESSAGES,
    isLoading: false,
    streamingPhase: 'idle',
    sendMessage: asyncNoop,
    stopMessage: noop,
    clearMessages: noop,
    discussRef: noop,
    displayRef: noop,
    currentProvider: 'anthropic',
    currentModelLabel: 'Claude Opus 4.1',
    currentContextWindowMaxTokens: 50000,
    currentInputTokens: 300,
    currentOutputTokens: 72,
    currentCacheHitRatePct: null,
    currentUsageBreakdown: null,
    dialogs: [{ id: 'd-0', title: 'osquery check' }, ...CHATS.map((title, i) => ({ id: `d-${i + 1}`, title }))],
    activeDialogId: 'd-0',
    selectDialog: noop,
    startNewDialog: async () => null,
    deleteDialog: asyncNoop,
    renameDialog: asyncNoop,
    archiveDialog: asyncNoop,
    isDialogsLoading: false,
    dialogsError: false,
    reloadDialogs: noop,
    isMessagesLoading: false,
    hasMoreDialogs: false,
    loadMoreDialogs: asyncNoop,
    hasMoreMessages: false,
    loadMoreMessages: asyncNoop,
    approveRequest: asyncNoop,
    rejectRequest: asyncNoop,
    dialogTokenUsage: null,
    connectionState: 'connected',
  };
}
const MINGO_STATE = createMingoState();

/** The real chat panel, as openframe-frontend docks it. */
function RealMingo({ canClose, close, collapse, mode }: AppLayoutSidePanelRenderState) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <EmbeddableChat
        shell="inline"
        closable={canClose}
        open
        onOpenChange={open => {
          if (!open) close();
        }}
        appearance="v2"
        onCollapse={mode === 'overlay' ? undefined : collapse}
        defaultActiveMode="mingo"
        showInternalTrigger={false}
        mingoState={MINGO_STATE}
        mingoDialogCapabilities={{ canRename: true, canArchive: true }}
      />
    </div>
  );
}

function Screen({
  collapsed,
  page,
  panel,
}: {
  collapsed: boolean;
  page: 'dashboard' | 'devices';
  panel: 'mingo' | 'mock';
}) {
  return (
    <AppLayout
      sidebarConfig={{ items: NAV_ITEMS, onNavigate: fn(), onToggleMinimized: fn() }}
      headerProps={{ showNotifications: true }}
      mobileBurgerMenuProps={{ user: { userName: 'Roman Smith', userEmail: 'roman@openframe.dev' } }}
      sidePanel={{
        label: 'Mingo',
        storageKey: 'storybook:mingo-docked-width',
        collapsed,
        children: state => (panel === 'mock' ? <MockMingo {...state} /> : <RealMingo {...state} />),
      }}
    >
      {page === 'devices' ? <DevicesPage /> : <Dashboard />}
    </AppLayout>
  );
}

const meta: Meta<typeof Screen> = {
  title: 'Navigation/Mingo Docked Layout',
  component: Screen,
  decorators: [
    Story => (
      <QueryClientProvider client={QUERY_CLIENT}>
        <ChatRuntimeContext.Provider value={RUNTIME}>
          <Story />
        </ChatRuntimeContext.Provider>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Mingo docked beside the content. Drag the handle: the content lays out by its own width (desktop from 1024px, tablet from 720px, mobile below, 400px minimum) while the panel keeps viewport-sized text. Dragging past the minimum hands the whole area to the panel. Without room to dock, or on a phone, the header Mingo AI button opens it over the content.',
      },
    },
  },
  args: { collapsed: false, page: 'dashboard', panel: 'mingo' },
  argTypes: {
    panel: {
      control: 'inline-radio',
      options: ['mingo', 'mock'],
      description: 'The real EmbeddableChat, or a stand-in.',
    },
    page: { control: 'inline-radio', options: ['dashboard', 'devices'] },
    collapsed: { control: 'boolean', description: 'Page that needs the full width: drop the panel to its minimum.' },
  },
};

export default meta;
type Story = StoryObj<typeof Screen>;

export const Docked: Story = {};

/** A list page: PageLayout header and a DataTable whose `hideAt` columns follow the content width. */
export const ListPage: Story = { args: { page: 'devices' } };
