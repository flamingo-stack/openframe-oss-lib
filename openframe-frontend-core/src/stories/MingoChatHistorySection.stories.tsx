import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useEffect, useState } from 'react';
import { fn } from 'storybook/test';

import type { MingoHistoryScope } from '../components/chat/mingo-chat-list-shared';
import { MingoChatRail, type MingoChatRailProps } from '../components/chat/mingo-chat-rail';
import type { DialogItem } from '../components/chat/types/component.types';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Times relative to now, so the day groups read Today / Yesterday / dates whenever the story runs. */
function ago(ms: number): Date {
  return new Date(Date.now() - ms);
}

const ME = { name: 'Pavlo Shylo' };
const ROMAN = { name: 'Roman Smith' };
const ILONA = { name: 'Ilona Kozak' };

const DIALOGS: DialogItem[] = [
  { id: 'd1', title: 'Veeam backup job failing on VSS errors', timestamp: ago(0.2 * HOUR), owner: ME },
  { id: 'd2', title: '', timestamp: ago(0.1 * HOUR), owner: ME },
  { id: 'd3', title: 'Restart the print spooler on FRONT-DESK-02', timestamp: ago(2 * HOUR), owner: ROMAN },
  { id: 'd4', title: 'Intune compliance policy for BYOD devices', timestamp: ago(DAY), owner: ME },
  { id: 'd5', title: 'Disk cleanup across the Acme fleet', timestamp: ago(DAY + 3 * HOUR), owner: ILONA },
  { id: 'd6', title: 'Automating patch reports with PowerShell', timestamp: ago(3 * DAY), owner: ME },
  { id: 'd7', title: 'RMM alert tuning to reduce noise', timestamp: ago(6 * DAY), owner: ROMAN },
  { id: 'd8', title: 'Conditional Access rollout without lockouts', timestamp: ago(6 * DAY + 2 * HOUR), owner: ME },
];

/** Older pages the list fetches as it is scrolled. */
const OLDER: DialogItem[] = Array.from({ length: 12 }, (_, i) => ({
  id: `old-${i}`,
  title: `Earlier chat ${i + 1}`,
  timestamp: ago((9 + i * 2) * DAY),
  owner: i % 3 === 0 ? ILONA : ME,
}));

const STATUS: Record<string, 'working' | 'approval'> = { d1: 'working', d3: 'approval', d5: 'approval' };

const meta: Meta = {
  title: 'Chat/MingoChatRail section',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '`MingoChatRail variant="section"` — the chat history block of the main navigation sidebar: "Chat history" with Search (⌘K in the host) and ⋯ → Chat archive, the search field once opened, My Chats / All Chats, the chats grouped by day with infinite paging. Shown in a 224 px sidebar column; the section has no chrome or width of its own.',
      },
    },
  },
  decorators: [
    Story => (
      <div className="flex h-[100dvh] bg-ods-bg">
        <div className="flex w-[224px] shrink-0 flex-col border-r border-ods-border bg-ods-card px-[var(--spacing-system-xs)] pt-[var(--spacing-system-mf)]">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** The host side a real sidebar wires: scope, search open (⌘K / Ctrl K), server search, paging. */
function SectionHost(props: Partial<MingoChatRailProps>) {
  const [scope, setScope] = useState<MingoHistoryScope>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeId, setActiveId] = useState('d4');
  const [pages, setPages] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const all = [...DIALOGS, ...OLDER.slice(0, pages * 6)];
  const scoped = scope === 'my' ? all.filter(dialog => dialog.owner === ME) : all;
  const dialogs = query ? scoped.filter(dialog => dialog.title.toLowerCase().includes(query.toLowerCase())) : scoped;

  return (
    <MingoChatRail
      variant="section"
      dialogs={dialogs}
      activeDialogId={activeId}
      onSelectDialog={setActiveId}
      statusOf={dialog => STATUS[dialog.id]}
      ownedByOther={dialog => dialog.owner !== ME}
      onRequestRename={fn()}
      onRequestCopyLink={fn()}
      onRequestArchive={fn()}
      onOpenArchive={fn()}
      scope={scope}
      onScopeChange={setScope}
      searchQuery={query}
      onSearchChange={setQuery}
      searchOpen={searchOpen}
      onSearchOpenChange={setSearchOpen}
      hasMore={!query && pages < 2}
      isLoadingMore={loadingMore}
      onLoadMore={() => {
        setLoadingMore(true);
        setTimeout(() => {
          setPages(p => p + 1);
          setLoadingMore(false);
        }, 600);
      }}
      {...props}
    />
  );
}

/** Own and someone else's chats (initials), one where Mingo is working, two waiting for approval,
 *  an untitled one ("New Chat"), the open one highlighted. Scroll to page in older chats; ⌘K / Ctrl K
 *  opens the search. */
export const Mixed: Story = {
  render: () => <SectionHost />,
};

/** No chats yet. The scope stays, so an empty "My Chats" can switch to "All Chats". */
export const Empty: Story = {
  render: () => <SectionHost dialogs={[]} hasMore={false} />,
};

/** A search with no match. */
export const NoResults: Story = {
  render: () => <SectionHost dialogs={[]} searchQuery="exchange" searchOpen hasMore={false} />,
};

/** The first page is loading. */
export const Loading: Story = {
  render: () => <SectionHost dialogs={[]} isLoadingHistory />,
};

/** The first page failed with nothing cached. */
export const LoadError: Story = {
  render: () => <SectionHost dialogs={[]} loadError onRetry={fn()} />,
};
