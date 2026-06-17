import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import React, { useState } from 'react'

import {
  ChatContainer,
  ChatContent,
  ChatFooter,
  ChatHeader,
} from '../components/chat/chat-container'
import { ChatInput } from '../components/chat/chat-input'
import { ChatMessageList } from '../components/chat/chat-message-list'
import { ModelDisplay, ModelDisplaySkeleton } from '../components/chat/model-display'
import type { Message } from '../components/chat/types/message.types'
import { cn } from '../utils/cn'

// =============================================================================
// Mock messages — sample client-facing Fae conversation
// =============================================================================

const FAE_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    content: "Hi! I'm Fae, your personal assistant. How can I help you today?",
    timestamp: new Date('2026-05-28T10:00:00Z'),
  },
  {
    id: '2',
    role: 'user',
    name: 'You',
    content: "My printer stopped working this morning — can you open a ticket?",
    timestamp: new Date('2026-05-28T10:00:30Z'),
  },
  {
    id: '3',
    role: 'assistant',
    name: 'Fae',
    assistantType: 'fae',
    content:
      "Of course — I'll get that opened right away. Could you tell me which printer it is (model or location) and what happens when you try to print?",
    timestamp: new Date('2026-05-28T10:00:45Z'),
  },
  {
    id: '4',
    role: 'user',
    name: 'You',
    content: "It's the HP LaserJet by the front desk. It blinks orange and nothing prints.",
    timestamp: new Date('2026-05-28T10:01:10Z'),
  },
]

// =============================================================================
// StoryShell — wires up controlled `ChatInput` and `ChatMessageList` so the
// story is interactive: typing & sending pushes a new user bubble into the
// message list. No transport — the assistant doesn't reply.
// =============================================================================

function FaeChatShell({
  withTicketInfo = false,
  bare = false,
  fullWidth = false,
  modelLoading = false,
}: {
  withTicketInfo?: boolean
  bare?: boolean
  fullWidth?: boolean
  modelLoading?: boolean
}) {
  const [messages, setMessages] = useState<Message[]>(FAE_MESSAGES)

  const handleSend = (text: string) => {
    if (!text.trim()) return
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${prev.length + 1}`,
        role: 'user',
        name: 'You',
        content: text,
        timestamp: new Date(),
      },
    ])
  }

  const handleNewChat = () => setMessages([FAE_MESSAGES[0]])

  return (
    <ChatContainer>
      <ChatHeader
        userName='Grace "Fae" Meadows'
        userTitle="Your Personal Assistant"
        connectionStatus="connected"
        serverUrl="mcp.flamingo.run"
        showNewChat
        onNewChat={handleNewChat}
        onClose={() => {
          // eslint-disable-next-line no-console
          console.log('[story] close clicked')
        }}
        fullWidth={fullWidth}
        bare={bare}
        ticketInfo={
          withTicketInfo
            ? {
                title: 'Printer offline — Ticket #4821',
                meta: 'Assigned to: J. Smith',
                status: 'in-progress',
              }
            : undefined
        }
      />
      <ChatContent>
        <ChatMessageList
          messages={messages}
          assistantType="fae"
          fullWidth={fullWidth}
          className="flex-1"
        />
      </ChatContent>
      <ChatFooter fullWidth={fullWidth}>
        <ChatInput
          onSend={handleSend}
          placeholder="Message Fae..."
          fullWidth={fullWidth}
        />
        {/* Model row below the composer — its width tracks the composer's, so
            in `fullWidth` it spans the footer instead of the centered column.
            Loaded state shows the real `ModelDisplay`; `modelLoading` swaps in
            the skeleton placeholder. */}
        <div
          className={cn(
            'mt-[var(--spacing-system-sf)]',
            fullWidth ? 'w-full' : 'mx-auto w-full max-w-ods-content-narrow',
          )}
        >
          {modelLoading ? (
            <ModelDisplaySkeleton />
          ) : (
            <ModelDisplay provider="google" modelName="gemini-2.5" displayName="Google Gemini 3.5" />
          )}
        </div>
      </ChatFooter>
    </ChatContainer>
  )
}

// =============================================================================
// Meta
// =============================================================================

const meta = {
  title: 'Chat/ChatContainer',
  component: ChatContainer,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ChatContainer>

export default meta
type Story = StoryObj<typeof meta>

// =============================================================================
// Fae — client-facing chat shell
// =============================================================================

/**
 * The Fae client-app chat: the default `ChatContainer` + `ChatHeader` shell
 * used by the OpenFrame customer-facing application. Header carries
 * `Grace "Fae" Meadows` as the assistant persona (pink avatar via the
 * default `bg-ods-flamingo-pink`); message list renders with
 * `assistantType="fae"` so AI bubbles use the matching Fae styling.
 */
export const Fae: Story = {
  render: () => <FaeChatShell />,
}

/**
 * Same Fae shell with `ticketInfo` populated on the header — adds a
 * secondary row beneath the avatar/name showing the active ticket title,
 * meta and status tag. This is the in-conversation state once a support
 * ticket has been opened from the chat.
 */
export const FaeWithTicket: Story = {
  render: () => <FaeChatShell withTicketInfo />,
}

/**
 * Full-width variant — drops the centered 600px content column on header,
 * message list and footer. Use when embedding the Fae chat in a narrow
 * side panel (e.g. mobile, slide-in drawer) where the centered column
 * would float in the middle of the panel.
 */
export const FaeFullWidth: Story = {
  render: () => <FaeChatShell fullWidth />,
}

/**
 * Bare header — drops the card chrome (background, border, shadow, ring)
 * so the header blends flush with its container. Pair with a host-
 * supplied floating card / drawer that already provides the chrome.
 */
export const FaeBareHeader: Story = {
  render: () => <FaeChatShell bare fullWidth />,
}

/**
 * Model row in its loading state — `ModelDisplaySkeleton` stands in for the
 * `ModelDisplay` pill below the composer until the model metadata resolves.
 * Shows only the left part (provider icon + model name); the "tokens used"
 * tail is opt-in via `showTokens`.
 */
export const FaeModelLoading: Story = {
  render: () => <FaeChatShell modelLoading />,
}
