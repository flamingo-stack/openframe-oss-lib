import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useMemo } from 'react'
import {
  ChatRuntimeContext,
  type ChatRuntime,
} from '../contexts/chat-runtime-context'
import { EmbeddableChat } from '../components/chat/embeddable-chat'
import type { UseNatsChatAdapterConfig } from '../components/chat/hooks/use-nats-chat-adapter'

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
      commandsUrl: '/__story__/commands',
      buildListUrl: () => null,
      attachmentUploadUrl: '/__story__/upload',
      attachmentViewUrlPrefix: '/__story__/view/',
      chatIdentityUrl: '/__story__/identity',
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
