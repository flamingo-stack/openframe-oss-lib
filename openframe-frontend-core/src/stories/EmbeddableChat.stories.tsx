import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import {
  ChatRuntimeContext,
  type ChatRuntime,
} from '../contexts/chat-runtime-context'
import { EmbeddableChat } from '../components/chat/embeddable-chat'
import type { UseNatsChatAdapterConfig } from '../components/chat/hooks/use-nats-chat-adapter'
import type { SlashCommandSummary } from '../components/chat/hooks/use-slash-commands'

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
