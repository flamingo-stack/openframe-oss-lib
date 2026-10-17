import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { fn } from 'storybook/test';

import { EmbeddableChat } from '../components/chat/embeddable-chat';
import { QuickActionChipButton } from '../components/chat/quick-action-chip';
import type { UnifiedChatMessage, UnifiedChatState } from '../components/chat/types/unified-chat-state.types';
import { PackageCheckIcon } from '../components/icons-v2-generated';
import { type ChatRuntime, ChatRuntimeContext } from '../contexts/chat-runtime-context';

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

const AT = new Date();
const DIALOG = {
  id: 'd-0',
  title: 'osquery cert renewal',
  timestamp: AT,
  owner: { name: 'Roman Smith' },
};
const MESSAGES: UnifiedChatMessage[] = [
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
      "The renewal job ran ~6 hours ago but didn't complete. If it's not renewed before then, the agent will fail signature validation and stop reporting.\n\nWant me to trigger a manual renewal?",
    timestamp: AT,
  },
];

/** A static Mingo thread through the `mingoState` injection path: no transport. */
function createState(conversation: boolean): UnifiedChatState {
  const noop = () => {};
  const asyncNoop = async () => {};
  return {
    messages: conversation ? MESSAGES : [],
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
    dialogs: [DIALOG],
    activeDialogId: conversation ? DIALOG.id : null,
    activeDialog: conversation ? DIALOG : null,
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
const CONVERSATION = createState(true);
const NEW_CHAT = createState(false);

type Page = 'chat' | 'devices' | 'home';

/**
 * A stand-in shell: a page area and a dock under it. ONE `EmbeddableChat` is
 * mounted in the dock for the whole story; switching the page only moves its
 * thread in and out (`threadContainer`), so a draft typed on one page is still
 * there on the next.
 */
/** Home chips the host draws itself: hovering one previews its prompt in the docked composer. */
const HOME_ACTIONS = [
  { id: 'disk', label: 'Low disk space', prompt: 'Find devices with less than 10% free disk and suggest a cleanup' },
  { id: 'patch', label: 'Missing patches', prompt: 'Which Windows devices are missing security patches this month?' },
];

function Shell({ page: initialPage }: { page: Page }) {
  const [page, setPage] = useState<Page>(initialPage);
  const [preview, setPreview] = useState<string | null>(null);
  // The story's control picks the page too; the buttons above move within it.
  const [controlPage, setControlPage] = useState<Page>(initialPage);
  if (controlPage !== initialPage) {
    setControlPage(initialPage);
    setPage(initialPage);
  }
  const [chatPage, setChatPage] = useState<HTMLElement | null>(null);
  const onChat = page === 'chat';

  return (
    <div className="flex h-screen flex-col bg-ods-bg">
      <nav className="flex gap-[var(--spacing-system-xs)] border-b border-ods-border p-[var(--spacing-system-xs)]">
        {(['home', 'chat', 'devices'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => setPage(p)}
            aria-pressed={page === p}
            className="rounded-md border border-ods-border px-[var(--spacing-system-s)] py-[var(--spacing-system-xxs)] text-ods-text-primary text-h6 aria-pressed:border-ods-accent"
          >
            {p}
          </button>
        ))}
      </nav>

      <main className="flex min-h-0 flex-1 flex-col">
        {onChat ? (
          // The chat route: the page is the node the thread renders into.
          <div ref={setChatPage} className="flex min-h-0 flex-1 flex-col" />
        ) : (
          <div className="flex-1 p-[var(--spacing-system-l)]">
            <h1 className="text-ods-text-primary text-h2">{page === 'home' ? 'Good morning, Roman' : 'Devices'}</h1>
            <p className="text-ods-text-secondary text-h6">
              No thread on this page: the dock below is the composer alone.
            </p>
            {page === 'home' && (
              <div className="mt-[var(--spacing-system-l)] flex flex-wrap gap-[var(--spacing-system-xsf)]">
                {HOME_ACTIONS.map(action => (
                  <QuickActionChipButton
                    key={action.id}
                    label={action.label}
                    onSelect={fn()}
                    onHoverStart={() => setPreview(action.prompt)}
                    onHoverEnd={() => setPreview(null)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* The dock: no fixed height and no overflow clipping, so the composer's
          menus can open above it over the page. */}
      <div className="mx-auto w-full max-w-[900px] shrink-0">
        <EmbeddableChat
          shell="inline"
          appearance="v2"
          closable={false}
          open
          onOpenChange={fn()}
          defaultActiveMode="mingo"
          showInternalTrigger={false}
          mingoState={page === 'home' ? NEW_CHAT : CONVERSATION}
          mingoDialogCapabilities={{ canRename: true, canArchive: true, onCopyLink: fn() }}
          threadContainer={onChat ? chatPage : null}
          renameMode="inline"
          showModel={page !== 'home'}
          onModelClick={fn()}
          modelTooltip="Change in Settings → AI Settings"
          composerPlaceholder={page === 'home' ? 'Ask Mingo or describe a task…' : 'Reply to Mingo…'}
          composerPreviewText={page === 'home' ? preview : null}
          onDialogCreated={fn()}
          composerMenuItems={
            page === 'home'
              ? undefined
              : [
                  {
                    id: 'compact',
                    label: 'Compact Chat Memory',
                    icon: <PackageCheckIcon className="h-full w-full text-ods-text-secondary" />,
                    onClick: fn(),
                  },
                ]
          }
        />
      </div>
    </div>
  );
}

const meta: Meta<typeof Shell> = {
  title: 'Chat/MingoChatSplit',
  component: Shell,
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
          'One EmbeddableChat for the session, split: the composer in a dock under every page, the header + thread portalled into the chat page (`threadContainer`), nothing but the composer elsewhere. The page header has no close / collapse / list controls; Rename is inline. Switch pages with a draft typed: it stays.',
      },
    },
  },
  args: { page: 'chat' },
  argTypes: { page: { control: 'inline-radio', options: ['chat', 'devices', 'home'] } },
};

export default meta;
type Story = StoryObj<typeof Shell>;

/** The chat route: page header + thread in the page, composer in the dock. */
export const ChatPage: Story = {};

/** Any other page: the dock is the composer alone (model row, ⋯ menu). */
export const ComposerOnlyDock: Story = { args: { page: 'devices' } };

/** Home: the composer without the model row, a new chat. Hover a chip: its prompt ghosts in the composer (`composerPreviewText`). */
export const Home: Story = { args: { page: 'home' } };
