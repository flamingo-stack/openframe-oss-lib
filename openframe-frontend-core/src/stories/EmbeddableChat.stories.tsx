import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { within, userEvent } from 'storybook/test'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import {
  ChatRuntimeContext,
  type ChatRuntime,
} from '../contexts/chat-runtime-context'
import { EmbeddableChat } from '../components/chat/embeddable-chat'
import type {
  UseNatsChatAdapterConfig,
  FetchDialogsResult,
  FetchDialogMessagesResult,
} from '../components/chat/hooks/use-nats-chat-adapter'
import type { SlashCommandSummary } from '../components/chat/hooks/use-slash-commands'
import type { DialogItem } from '../components/chat/types/component.types'
import type { MingoQuickAction } from '../components/chat/mingo-welcome'
import {
  BracketCurlyIcon,
  Rocket01Icon,
  SearchIcon,
} from '../components/icons-v2-generated'

// =============================================================================
// Stub commands endpoint — module-level constant referenced both by the
// runtime mock (commandsUrl) and by the `fetch` shim installed below.
// =============================================================================

const COMMANDS_URL = '/__story__/commands'

// =============================================================================
// Shared mocks
// =============================================================================

/**
 * Minimal mock runtime — endpoints point at non-existent paths so that
 * an accidental fetch in the active mode resolves to a 404 rather than
 * hitting a real server. Inactive-mode hooks never call out. Memoised
 * with `useMemo` per the runtime's embedder contract.
 */
function createMockRuntime(): ChatRuntime {
  return {
    endpoints: {
      chatStreamUrl: '/__story__/chat',
      approvalToolUrl: '/__story__/confirm-tool',
      commandsUrl: COMMANDS_URL,
      buildListUrl: () => null,
      attachmentUploadUrl: '/__story__/upload',
      attachmentViewUrlPrefix: '/__story__/view/',
      identityUrl: '/__story__/identity',
    },
    navigation: {
      mode: 'embed',
      defaultContentOrigin: 'https://example.com',
    },
    source: 'storybook',
  }
}

/**
 * Stub Mingo config — `getNatsWsUrl` returns null so the NATS dialog
 * subscription stays idle (no WS handshake attempted). `publishUserMessage`
 * just logs; the story exists to demonstrate UI layout, not transport
 * behaviour.
 */
function createMockMingoConfig(): UseNatsChatAdapterConfig {
  return {
    dialogId: 'story-dialog-id',
    getNatsWsUrl: () => null,
    publishUserMessage: (text, options) => {
      // eslint-disable-next-line no-console
      console.log('[story] mingo publish', { text, options })
    },
    // Selecting a dialog loads its history via this callback — without it
    // `hasMessages` stays false and the panel never switches to the
    // conversation view. Return a tiny canned thread so clicks "open" a chat.
    fetchDialogMessages: ({ dialogId }) =>
      Promise.resolve({
        messages: [
          {
            id: `${dialogId}-u1`,
            createdAt: new Date().toISOString(),
            owner: { type: 'CLIENT' },
            messageData: {
              type: 'TEXT',
              text: 'Which devices have not sent any logs in the last 24 hours?',
            },
          },
          {
            id: `${dialogId}-a1`,
            createdAt: new Date().toISOString(),
            owner: { type: 'ASSISTANT' },
            messageData: {
              type: 'TEXT',
              text: 'Found 3 devices that have not reported in over 24 hours. Want me to run a full diagnostic?',
            },
          },
        ],
        nextCursor: null,
      }),
  }
}

// Sample dialog history (Figma node 7532:223950) — supplied via `fetchDialogs`
// so EmbeddableChat reports `dialogs.length > 0` and renders MingoWelcome's
// returning-user variation (outline "Start Guide Chat" chip, no promo).
const SAMPLE_DIALOGS: ReadonlyArray<DialogItem> = [
  { id: 'd1', title: 'PowerShell script for bulk user creation', unreadMessagesCount: 1 },
  { id: 'd2', title: 'Setting up automated backup verification', unreadMessagesCount: 1 },
  { id: 'd3', title: 'Network segmentation best practices for client' },
  { id: 'd4', title: 'Creating GPO for software deployment' },
  { id: 'd5', title: 'WSUS patching strategy optimization' },
  { id: 'd6', title: 'Office 365 license assignment automation' },
  { id: 'd7', title: 'Firewall rule configuration for new application' },
  { id: 'd8', title: 'SQL Server maintenance plan troubleshooting' },
]

// Caller-provided Mingo quick-action chips — rendered after the built-in
// "Start Guide Chat" chip in the welcome/returning-user view. `onClick` just
// logs; the story demonstrates the chip row layout, not the action behaviour.
const SAMPLE_QUICK_ACTIONS: ReadonlyArray<MingoQuickAction> = [
  {
    id: 'weekly-log-summary',
    label: 'Weekly Log Summary',
    icon: <SearchIcon size={16} />,
    onClick: () => console.log('[story] quick action: weekly log summary'),
  },
  {
    id: 'run-script',
    label: 'Run a script',
    icon: <BracketCurlyIcon size={16} />,
    onClick: () => console.log('[story] quick action: run a script'),
  },
  {
    id: 'device-health',
    label: 'Device health check',
    icon: <Rocket01Icon size={16} />,
    onClick: () => console.log('[story] quick action: device health check'),
  },
  {
    id: 'summarize-tickets',
    label: 'Summarize open tickets',
    icon: <SearchIcon size={16} />,
    onClick: () => console.log('[story] quick action: summarize tickets'),
  },
  {
    id: 'patch-status',
    label: 'Patch status report',
    icon: <BracketCurlyIcon size={16} />,
    onClick: () => console.log('[story] quick action: patch status report'),
  },
]

/** Mingo config whose `fetchDialogs` resolves a single page of history (with
 *  timestamps so the list splits into Today / Yesterday) plus working
 *  rename/archive callbacks — used by the returning-user story. */
function createMockMingoConfigWithDialogs(): UseNatsChatAdapterConfig {
  return {
    ...createMockMingoConfig(),
    fetchDialogs: () => {
      const now = Date.now()
      const day = 24 * 60 * 60 * 1000
      // First six → Today, the rest → Yesterday.
      const dialogs = SAMPLE_DIALOGS.map((d, i) => ({
        ...d,
        timestamp: new Date(now - (i < 6 ? 0 : day)),
      }))
      return Promise.resolve({ dialogs, nextCursor: null })
    },
    renameDialog: (id, title) => {
      // eslint-disable-next-line no-console
      console.log('[story] mingo rename', { id, title })
      return Promise.resolve()
    },
    archiveDialog: (id) => {
      // eslint-disable-next-line no-console
      console.log('[story] mingo archive', { id })
      return Promise.resolve()
    },
    fetchArchivedDialogs: () => {
      const now = Date.now()
      const day = 24 * 60 * 60 * 1000
      const dialogs: DialogItem[] = [
        { id: 'a1', title: 'Exchange hybrid migration planning', timestamp: new Date(now) },
        { id: 'a2', title: 'VPN split-tunnel configuration review', timestamp: new Date(now) },
        { id: 'a3', title: 'Decommissioning legacy file server', timestamp: new Date(now - day) },
        { id: 'a4', title: 'Intune compliance policy rollout', timestamp: new Date(now - day) },
      ]
      return Promise.resolve({ dialogs, nextCursor: null })
    },
    unarchiveDialog: (id) => {
      // eslint-disable-next-line no-console
      console.log('[story] mingo unarchive', { id })
      return Promise.resolve()
    },
  }
}

/**
 * A promise that never settles — keeps whichever adapter loading flag it
 * backs pinned `true`, so the loading UI stays on screen for the story
 * (no fake timers, no flicker to a resolved state).
 */
const pending = <T,>(): Promise<T> => new Promise<T>(() => {})

/**
 * Chats-loading config — `fetchDialogs` never resolves, so the adapter keeps
 * `isDialogsLoading` true with an empty list. EmbeddableChat reports
 * `dialogsInitialLoading` and the Mingo empty state shows its history
 * skeleton instead of the new/returning-user greeting.
 */
function createMockMingoConfigChatsLoading(): UseNatsChatAdapterConfig {
  return {
    ...createMockMingoConfig(),
    fetchDialogs: () => pending<FetchDialogsResult>(),
  }
}

/**
 * Chat-loading config — the dialog list resolves normally, but
 * `fetchDialogMessages` never resolves. Paired with the story's `play`
 * (which opens the first dialog), this pins `isMessagesLoading` with no
 * messages yet, so the conversation view shows the message-list skeleton.
 */
function createMockMingoConfigChatLoading(): UseNatsChatAdapterConfig {
  return {
    ...createMockMingoConfigWithDialogs(),
    fetchDialogMessages: () => pending<FetchDialogMessagesResult>(),
  }
}

/**
 * Chats-error config — `fetchDialogs` rejects, so the adapter flips
 * `dialogsError` true with an empty list. EmbeddableChat reports
 * `dialogsLoadError`, and the Mingo empty state shows its load-error + retry
 * affordance instead of the greeting (distinguishing a backend failure from a
 * genuinely empty list). `reloadDialogs` re-invokes this — the retry path is
 * wired, it just keeps failing against the unavailable mock backend.
 */
function createMockMingoConfigChatsError(): UseNatsChatAdapterConfig {
  return {
    ...createMockMingoConfig(),
    fetchDialogs: () =>
      Promise.reject(new Error('Story: dialog list backend unavailable')),
  }
}

/**
 * Archive-empty config — a populated dialog list (so the header's archive
 * button is present), but `fetchArchivedDialogs` resolves an empty page. Paired
 * with the story's `play` (which opens the archive page), this renders the
 * archive page's empty state.
 */
function createMockMingoConfigArchiveEmpty(): UseNatsChatAdapterConfig {
  return {
    ...createMockMingoConfigWithDialogs(),
    fetchArchivedDialogs: () =>
      Promise.resolve({ dialogs: [], nextCursor: null }),
  }
}

// =============================================================================
// Mocked slash-commands — fed into the empty-state card list (Figma node
// 7363:205938) via a `window.fetch` override below. Each entry must set
// `displayOrder` so EmbeddableChat treats it as a chip-grid candidate.
// =============================================================================

const SAMPLE_SLASH_COMMANDS: ReadonlyArray<SlashCommandSummary> = [
  {
    id: 'roadmap',
    label: 'ClickUp Roadmap',
    description: 'Public product roadmap with upcoming features and releases',
    iconName: 'clickup-logo-grey',
    primarySourceId: 'clickup-roadmap',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 1,
  },
  {
    id: 'delivery',
    label: 'ClickUp Delivery',
    description: 'Bug fixes and enhancements currently in delivery',
    iconName: 'clickup-logo-grey',
    primarySourceId: 'clickup-delivery',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 2,
  },
  {
    id: 'slack',
    label: 'OpenMSP Community',
    description: 'Messages and discussions from the OpenMSP community Slack',
    iconName: 'slack-logo-grey',
    primarySourceId: 'slack',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 3,
  },
  {
    id: 'known-issues',
    label: 'Known Issues',
    description: 'Customer-reported issues and similar past support tickets',
    iconName: 'hubspot-logo-grey',
    primarySourceId: 'known-issues',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 4,
  },
  {
    id: 'my-tickets',
    label: 'My Tickets',
    description: 'Your active support tickets and recent conversations',
    iconName: 'hubspot-logo-grey',
    primarySourceId: 'tickets',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 5,
  },
  {
    id: 'docs',
    label: 'OpenFrame Docs',
    description: 'Full OpenFrame product documentation and reference',
    iconName: 'logo-openframe',
    primarySourceId: 'docs',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 6,
  },
  {
    id: 'blogs',
    label: 'Blog Posts',
    description: 'Latest articles, guides, and announcements from the blog',
    iconName: 'newspaper',
    primarySourceId: 'blogs',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 7,
  },
  {
    id: 'release-notes',
    label: 'Product Releases',
    description: 'OpenFrame version releases, changelogs, and update notes',
    iconName: 'rocket-02',
    primarySourceId: 'release-notes',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 8,
  },
  {
    id: 'case-studies',
    label: 'Case Studies',
    description: 'Customer success stories and real-world case studies',
    iconName: 'rocket-02',
    primarySourceId: 'case-studies',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 9,
  },
  {
    id: 'webinars',
    label: 'Webinars',
    description: 'Upcoming live sessions and recorded webinar library',
    iconName: 'rocket-02',
    primarySourceId: 'webinars',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 10,
  },
  {
    id: 'podcasts',
    label: 'Podcasts',
    description: 'Latest episodes from OpenMSP and partner podcasts',
    iconName: 'rocket-02',
    primarySourceId: 'podcasts',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 11,
  },
  {
    id: 'getting-started',
    label: 'Onboarding Guides',
    description: 'Step-by-step guides to get started with OpenFrame',
    iconName: 'compass',
    primarySourceId: 'getting-started',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 12,
  },
  {
    id: 'events',
    label: 'Events',
    description: 'Industry events, MSP meetups, and conferences',
    iconName: 'compass',
    primarySourceId: 'events',
    actions: [{ id: 'browse', label: 'Browse' }],
    displayOrder: 13,
  },
]

// =============================================================================
// `fetch` shim — installed at MODULE level (not inside an effect) so the
// override is in place BEFORE the EmbeddableChat's own `useEffect` runs.
// React's commit phase runs child effects before parent effects, so a hook-
// based decorator would patch `fetch` too late and the chat would hit the
// unmocked endpoint on first render. Installing once per module load is
// safe — `/__story__/commands` is reserved for storybook.
// =============================================================================

const FETCH_FLAG = '__embeddableChatStoriesMockInstalled__'

if (
  typeof window !== 'undefined' &&
  !(window as unknown as Record<string, unknown>)[FETCH_FLAG]
) {
  ;(window as unknown as Record<string, unknown>)[FETCH_FLAG] = true
  const originalFetch = window.fetch.bind(window)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const href =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (href.includes(COMMANDS_URL)) {
      return Promise.resolve(
        new Response(JSON.stringify({ commands: SAMPLE_SLASH_COMMANDS }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }
    return originalFetch(input as RequestInfo, init)
  }) as typeof window.fetch
}

// =============================================================================
// Decorator — runtime + react-query + isolated drawer slot
// =============================================================================

function StoryShell({ children }: { children: React.ReactNode }) {
  const runtime = useMemo(() => createMockRuntime(), [])
  const queryClient = useMemo(() => new QueryClient(), [])
  return (
    <QueryClientProvider client={queryClient}>
      <ChatRuntimeContext.Provider value={runtime}>
        {/* Filler content under the drawer so the floating overlay
            has visual context to slide over. */}
        <div className="min-h-[100dvh] bg-ods-bg p-8">
          <div className="text-ods-text-secondary text-sm">
            Storybook canvas — drawer opens on the right →
          </div>
        </div>
        {children}
      </ChatRuntimeContext.Provider>
    </QueryClientProvider>
  )
}

// =============================================================================
// Meta
// =============================================================================

const meta = {
  title: 'Chat/EmbeddableChat',
  component: EmbeddableChat,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <StoryShell>
        <Story />
      </StoryShell>
    ),
  ],
} satisfies Meta<typeof EmbeddableChat>

export default meta
type Story = StoryObj<typeof meta>

// =============================================================================
// 1. Guide-only (legacy / multi-platform-hub)
// =============================================================================

/**
 * Legacy / single-mode Guide consumer. No `modes` prop — the lib
 * synthesises `modes.guide` from the top-level legacy props. The
 * header has NO mode toggle since only one transport is configured.
 *
 * This is exactly how `multi-platform-hub` mounts the chat today.
 */
export const GuideOnly: Story = {
  args: {
    defaultOpen: true,
    showInternalTrigger: false,
    emptyStateGreeting: 'Ask me anything about the OpenFrame docs.',
    suggestedQueries: [
      'How do I install the agent?',
      'What integrations are supported?',
      'Where do I configure SSO?',
    ],
  },
}

// =============================================================================
// 2. Mingo-only (NATS agent surface)
// =============================================================================

/**
 * Mingo-only consumer — the unified chat surface running just the NATS
 * agent transport. Header has NO toggle (only one mode configured).
 * No floating "Ask AI" trigger; the drawer opens uncontrolled.
 *
 * `getNatsWsUrl` returns null in the mock config so no real NATS
 * handshake is attempted — the story renders the empty Mingo panel.
 */
export const MingoOnly: Story = {
  render: (args) => (
    <EmbeddableChat
      {...args}
      modes={{
        mingo: createMockMingoConfig(),
      }}
      defaultActiveMode="mingo"
      defaultOpen
      showInternalTrigger={false}
      emptyStateGreeting="Hi — I'm the Mingo agent. What would you like me to help with?"
    />
  ),
  args: {},
}

// =============================================================================
// 3. Both modes (toggle visible — openframe-frontend target)
// =============================================================================

/**
 * Dual-mode consumer — Guide + Mingo configured side-by-side. The header
 * shows the segmented toggle `Mingo | Guide`. Clicking the toggle flips
 * the active adapter; each side keeps its own history so the user picks
 * up where they left off.
 *
 * This is the target shape for `openframe-frontend`. Both mocks are
 * idle (no real backend) — toggle and layout are the visible deliverable.
 */
export const BothModes: Story = {
  render: (args) => (
    <EmbeddableChat
      {...args}
      modes={{
        guide: {},
        mingo: createMockMingoConfig(),
      }}
      defaultActiveMode="mingo"
      defaultOpen
      showInternalTrigger={false}
      emptyStateGreeting="Switch between Mingo (agent) and Guide (docs) via the header toggle."
      suggestedQueries={[
        'How do I onboard a new device?',
        'Show me the audit log',
      ]}
    />
  ),
  args: {},
}

// =============================================================================
// 4. Returning user — Mingo with existing chats (Figma node 7532:223950)
// =============================================================================

/**
 * Returning-user variation. The mock `fetchDialogs` resolves a page of dialog
 * history, so `dialogs.length > 0` and the empty state switches to its
 * returning-user form: the "New to OpenFrame?" notification is hidden and the
 * "Start Guide Chat" chip drops from the accent yellow to the muted outline
 * style. The dialog list itself renders inline via MingoChatHistory.
 *
 * Caller-provided `quickActions` chips render in the pinned chip row after
 * "Start Guide Chat" — the first is `primary` (accent), the rest `outline`.
 */
export const ReturningUser: Story = {
  render: (args) => (
    <EmbeddableChat
      {...args}
      modes={{
        guide: {},
        mingo: createMockMingoConfigWithDialogs(),
      }}
      defaultActiveMode="mingo"
      defaultOpen
      showInternalTrigger={false}
      mingoWelcome={{ quickActions: SAMPLE_QUICK_ACTIONS }}
    />
  ),
  args: {},
}

// =============================================================================
// 5. Chats loading — dialog list fetch in flight
// =============================================================================

/**
 * Dialog-list loading state. The mock `fetchDialogs` never resolves, so the
 * adapter keeps `isDialogsLoading` true with an empty list. The Mingo empty
 * state renders its history skeleton (instead of the new/returning-user
 * greeting), matching what the panel shows on first open before the chat list
 * lands.
 */
export const ChatsLoading: Story = {
  render: (args) => (
    <EmbeddableChat
      {...args}
      modes={{
        mingo: createMockMingoConfigChatsLoading(),
      }}
      defaultActiveMode="mingo"
      defaultOpen
      showInternalTrigger={false}
    />
  ),
  args: {},
}

// =============================================================================
// 6. Chat loading — opening a dialog whose history is in flight
// =============================================================================

/**
 * Single-conversation loading state. The dialog list resolves, but
 * `fetchDialogMessages` never resolves. The `play` step opens the first
 * dialog, so the panel flips to the conversation view and shows the
 * message-list skeleton (`isMessagesLoading` with no messages yet) — the
 * "opening a chat" loading frame before bubbles stream in.
 */
export const ChatLoading: Story = {
  render: (args) => (
    <EmbeddableChat
      {...args}
      modes={{
        mingo: createMockMingoConfigChatLoading(),
      }}
      defaultActiveMode="mingo"
      defaultOpen
      showInternalTrigger={false}
    />
  ),
  args: {},
  play: async () => {
    // The drawer portals to <body>, so query the document, not the canvas.
    const body = within(document.body)
    const row = await body.findByText(SAMPLE_DIALOGS[0].title)
    await userEvent.click(row)
  },
}

// =============================================================================
// 7. Chats error — dialog list fetch failed
// =============================================================================

/**
 * Dialog-list error state. The mock `fetchDialogs` rejects, so the adapter
 * sets `dialogsError` with an empty list. EmbeddableChat reports
 * `dialogsLoadError` and the Mingo empty state shows its error message + retry
 * button instead of the greeting — what the panel shows when the chat backend
 * is unreachable. Clicking retry re-runs the (still-failing) fetch.
 */
export const ChatsError: Story = {
  render: (args) => (
    <EmbeddableChat
      {...args}
      modes={{
        mingo: createMockMingoConfigChatsError(),
      }}
      defaultActiveMode="mingo"
      defaultOpen
      showInternalTrigger={false}
    />
  ),
  args: {},
}

// =============================================================================
// 8. Archive empty — archive page with no archived chats
// =============================================================================

/**
 * Archive page empty state. The dialog list is populated (so the header's
 * archive button renders), but `fetchArchivedDialogs` resolves an empty page.
 * The `play` step clicks the archive button to open the Chat Archive page,
 * which — with nothing archived — shows its centred empty state (icon + title +
 * hint) rather than the dialog list or skeleton.
 */
export const ArchiveEmpty: Story = {
  render: (args) => (
    <EmbeddableChat
      {...args}
      modes={{
        mingo: createMockMingoConfigArchiveEmpty(),
      }}
      defaultActiveMode="mingo"
      defaultOpen
      showInternalTrigger={false}
    />
  ),
  args: {},
  play: async () => {
    // The drawer portals to <body>, so query the document, not the canvas.
    const body = within(document.body)
    const archiveButton = await body.findByRole('button', {
      name: 'Chat archive',
    })
    await userEvent.click(archiveButton)
  },
}
