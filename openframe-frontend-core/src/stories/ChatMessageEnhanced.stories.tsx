import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type React from 'react';

import type { ChatPart } from '../chat-protocol/chat-message';
import { ChatMessageEnhanced } from '../components/chat/chat-message-enhanced';
import { ChatTypingIndicator } from '../components/chat/chat-typing-indicator';
import { approvalPart, textPart } from './__fixtures__/chat-messages';

/**
 * `<ChatMessageEnhanced>` — THE chat message renderer used by
 * ChatMessageList / EmbeddableChat. Renders the avatar + name + timestamp
 * header (Fae pink / Mingo cyan / user grey) and every part type:
 * text (markdown), reasoning, a tool's run, an approval card or batch, an error,
 * a context compaction.
 *
 * The Fae conversation scenes reproduce the Fae desktop-app flow: greeting →
 * user request → approval block → typing dots (Figma "fae-approval-block").
 */

// Fixed time-of-day so the header always reads "2:47 PM" — messages dated
// today render time-only (see formatMessageTimestamp).
const at247 = () => {
  const d = new Date();
  d.setHours(14, 47, 0, 0);
  return d;
};

const panelDecorator = (Story: React.ComponentType) => (
  <div style={{ maxWidth: 640, background: 'var(--color-bg)' }} className="p-[var(--spacing-system-m)]">
    <Story />
  </div>
);

const meta = {
  title: 'Chat/ChatMessageEnhanced',
  component: ChatMessageEnhanced,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Single chat message row — avatar + colored author name + timestamp header, plus the full part renderer (text/reasoning/tool/approval/error/compaction). Used by ChatMessageList in both the admin (Mingo) and client (Fae) chats.',
      },
    },
  },
  decorators: [panelDecorator],
} satisfies Meta<typeof ChatMessageEnhanced>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Assistant (Fae) text message — pink mono name + timestamp. */
export const AssistantFae: Story = {
  args: {
    role: 'assistant',
    name: 'Fae',
    parts: textPart('Good morning! How can I help you today?'),
    timestamp: at247(),
  },
};

/** Assistant (Mingo) text message — cyan mono name. */
export const AssistantMingo: Story = {
  args: {
    role: 'assistant',
    name: 'Mingo',
    assistantType: 'mingo',
    parts: textPart("I've pulled the device list for Acme Corp — 3 endpoints are offline."),
    timestamp: at247(),
  },
};

/** User message — grey mono name, no avatar block until user avatars ship. */
export const UserMessage: Story = {
  args: {
    role: 'user',
    name: 'John Smith',
    parts: textPart('hey can u install slack on my mac'),
    timestamp: at247(),
  },
};

/**
 * Fae flow, step 1 — greeting, user request, and the assistant "typing"
 * row (empty message + `<ChatTypingIndicator>`, as the Fae desktop host
 * renders it while the reply streams in).
 */
export const FaeConversationTyping: Story = {
  args: { role: 'assistant', parts: [] },
  render: () => (
    <div className="flex flex-col">
      <ChatMessageEnhanced
        role="assistant"
        name="Fae"
        parts={textPart('Good morning! How can I help you today?')}
        timestamp={at247()}
      />
      <ChatMessageEnhanced
        role="user"
        name="John Smith"
        parts={textPart('hey can u install slack on my mac')}
        timestamp={at247()}
      />
      <ChatMessageEnhanced role="assistant" name="Fae" parts={[]} isTyping timestamp={at247()} />
      <ChatTypingIndicator size="sm" />
    </div>
  ),
};

const approvedParts: ChatPart[] = [
  { type: 'text', text: 'On it! Just need your quick approval here.' },
  approvalPart({
    id: 'req-1',
    command: 'brew install --cask slack',
    approvalType: 'CLIENT',
    explanation: 'Install Slack via Homebrew Cask on macOS',
    status: 'approved',
    resolvedByName: 'John Smith',
  }),
];

/**
 * Fae flow, step 2 — the reply carries a tool part in an approval state,
 * rendered as the CLIENT card with the resolved "APPROVED BY JOHN SMITH"
 * pill (`approvalVariant="client"`), then Fae keeps typing.
 */
export const FaeConversationApproved: Story = {
  args: { role: 'assistant', parts: [] },
  render: () => (
    <div className="flex flex-col">
      <ChatMessageEnhanced
        role="assistant"
        name="Fae"
        parts={textPart('Good morning! How can I help you today?')}
        timestamp={at247()}
      />
      <ChatMessageEnhanced
        role="user"
        name="John Smith"
        parts={textPart('hey can u install slack on my mac')}
        timestamp={at247()}
      />
      <ChatMessageEnhanced
        role="assistant"
        name="Fae"
        parts={approvedParts}
        approvalVariant="client"
        timestamp={at247()}
      />
      <ChatMessageEnhanced role="assistant" name="Fae" parts={[]} isTyping timestamp={at247()} />
      <ChatTypingIndicator size="sm" />
    </div>
  ),
};

/** Pending approval inside a message — Approve/Reject buttons (client card). */
export const PendingApprovalPart: Story = {
  args: {
    role: 'assistant',
    name: 'Fae',
    approvalVariant: 'client',
    timestamp: at247(),
    actions: { approve: () => {}, reject: () => {} },
    parts: [
      { type: 'text', text: 'On it! Just need your quick approval here.' },
      approvalPart({
        id: 'req-2',
        command: 'brew install --cask slack',
        approvalType: 'CLIENT',
        explanation: 'Install Slack via Homebrew Cask on macOS',
      }),
    ],
  },
};

/**
 * A `data-record-cards` part draws its cards where it sits: `renderEntityCard` receives a minimal `{type, id}` descriptor
 * and hydrates by id (here from a story-local map; in production from the host's per-object APIs). A record link in the
 * text is a chip.
 */
const GUIDE_TITLES_BY_ID: Record<string, string> = {
  'first-check': 'Create Your First Monitoring Check',
  'add-devices': 'Add Devices to a Policy',
};

export const GuideWithEntityCards: Story = {
  args: {
    role: 'assistant',
    name: 'Mingo',
    assistantType: 'mingo',
    timestamp: at247(),
    renderEntityCard: ref =>
      ref.type === 'onboarding_guide' ? (
        <div className="flex items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]">
          <span className="flex-1 text-ods-text-primary text-h4">{GUIDE_TITLES_BY_ID[ref.id] ?? ref.id}</span>
          <span className="text-ods-text-secondary text-h5">Guide</span>
        </div>
      ) : null,
    parts: [
      { type: 'text', text: "Here's how to create a monitoring policy (check) in OpenFrame:" },
      { type: 'data-record-cards', data: { records: ['record://onboarding_guide/first-check'] } },
      {
        type: 'text',
        text: 'Step-by-step:\n\n1. Go to Monitoring → Policies → Add Policy\n2. Write your osquery SQL query\n3. Save the policy\n\nThen read [Add devices](record://onboarding_guide/add-devices).',
      },
    ],
  },
};

/** Every remaining part type in one message: reasoning, tool execution, context compaction, error. */
export const AllPartTypes: Story = {
  args: {
    role: 'assistant',
    name: 'Fae',
    timestamp: at247(),
    parts: [
      {
        type: 'reasoning',
        text: 'The user wants Slack installed. Homebrew is present on the endpoint, so `brew install --cask slack` is the cleanest path.',
      },
      { type: 'text', text: 'Installing Slack now.' },
      {
        type: 'dynamic-tool',
        toolName: 'run_script',
        toolCallId: 'run-1',
        title: 'Install Slack via Homebrew Cask',
        state: 'output-available',
        input: { command: 'brew install --cask slack' },
        output: '🍺  slack was successfully installed!',
        toolMetadata: { integratedToolType: 'OPENFRAME_RMM' },
      },
      { type: 'data-context-compaction', data: { status: 'completed' } },
      {
        type: 'data-error',
        data: {
          title: 'Notification delivery failed',
          details: 'Slack webhook returned 429 — the completion ping was skipped. The install itself succeeded.',
        },
      },
      { type: 'text', text: 'Done — Slack is installed and ready to use.' },
    ],
  },
};
