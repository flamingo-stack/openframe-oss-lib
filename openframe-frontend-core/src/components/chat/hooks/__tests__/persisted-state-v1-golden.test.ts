/**
 * Phase-0 GOLDEN CHARACTERIZATION TESTS — PersistedChatState v1.
 *
 * The SSE chat adapter persists its conversation under
 * `mingo-chat-<source>-v1` (see `use-sse-chat-adapter.ts`:
 * chatStorageKey / loadPersistedChat / savePersistedChat). This file
 * seeds localStorage with a hand-crafted, REALISTIC v1 blob and pins the
 * exact rehydrated state the hook exposes. This blob is the MIGRATION
 * CONTRACT for the future unified reducer: whatever replaces the three
 * stream-reading layers must restore this v1 shape identically (or
 * migrate it losslessly).
 *
 * Blob contents:
 *   - 2 visible user sends (sendCount: 2)
 *   - 4 assistant messages — send #0 fans out to main reply (approval
 *     card) + post-approve receipt + continuation bubble (with a hidden
 *     approval-action user turn in between); send #1 is a plain RAG answer
 *   - sendIdx-keyed refs map with a card ref (ticket:77 on send #0)
 *   - sendIdx-keyed sources map (pricing source on send #1)
 *   - a NON-hidden auto-continuation directive bubble that the loader's
 *     forward-migration must flip to hidden:true
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSseChatAdapter } from '../use-sse-chat-adapter'
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context'
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../../utils/auto-continuation-directive'

const SOURCE = 'goldensrc'
const STORAGE_KEY = `mingo-chat-${SOURCE}-v1`

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    approvalToolUrl: '/api/chat/agent/confirm-tool',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
  source: SOURCE,
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ChatRuntimeContext.Provider, { value: runtime }, children),
  )
}

/**
 * Hand-crafted v1 blob — REALISTIC shapes recorded from the live flow.
 * Timestamps are ISO strings on disk (loadPersistedChat revives them to
 * Date objects in place).
 */
const V1_BLOB = {
  messages: [
    // ── send #0: "open a ticket" ────────────────────────────────────
    {
      id: 'user-1752915600000',
      role: 'user',
      name: 'You',
      content: 'open a ticket for the broken printer',
      timestamp: '2026-07-19T09:00:00.000Z',
    },
    {
      // Main reply: preamble text + (resolved) approval card.
      id: 'assistant-1752915600000',
      role: 'assistant',
      name: 'Mingo AI',
      content: [
        { type: 'text', text: "I'll open a ticket for you." },
        {
          type: 'approval_request',
          data: {
            command: 'Create ticket',
            fields: [
              { label: 'Subject', value: 'Broken printer' },
              { label: 'Priority', value: 'High' },
            ],
            requestId: 'prop-1',
            approvalType: 'create_ticket',
          },
          status: 'approved',
        },
      ],
      timestamp: '2026-07-19T09:00:05.000Z',
    },
    {
      // Hidden approval-action turn (content '' — the Approve click).
      id: 'user-1752915610000',
      role: 'user',
      name: 'You',
      content: '',
      hidden: true,
      timestamp: '2026-07-19T09:00:10.000Z',
    },
    {
      // Post-approve receipt + card marker; chatRefs stamped on-message.
      id: 'assistant-1752915610000',
      role: 'assistant',
      name: 'Mingo AI',
      content: [
        {
          type: 'text',
          text: '✅ Approved — ticket created: [card://ticket:77]\n\nNow, to triage faster: which floor is the printer on?',
        },
      ],
      chatRefs: {
        'ticket:77': {
          type: 'ticket',
          id: '77',
          title: 'Broken printer',
          url: null,
          metadata: { status: 'OPEN' },
        },
      },
      timestamp: '2026-07-19T09:00:12.000Z',
    },
    {
      // Auto-continuation directive bubble persisted by an OLD lib version
      // WITHOUT hidden:true — the loader's forward-migration must flip it.
      id: 'user-1752915612000',
      role: 'user',
      name: 'You',
      content: `${AUTO_CONTINUATION_DIRECTIVE_PREFIX} The user just approved create_ticket (ticket #77). Ask diagnostic follow-ups.`,
      timestamp: '2026-07-19T09:00:12.500Z',
    },
    {
      // Continuation prose for send #0 (third assistant message).
      id: 'assistant-1752915613000',
      role: 'assistant',
      name: 'Mingo AI',
      content: [{ type: 'text', text: 'Also: is the printer showing any error code on its display?' }],
      timestamp: '2026-07-19T09:00:13.000Z',
    },
    // ── send #1: plain RAG answer ───────────────────────────────────
    {
      id: 'user-1752915700000',
      role: 'user',
      name: 'You',
      content: 'what is the pricing?',
      timestamp: '2026-07-19T09:01:40.000Z',
    },
    {
      id: 'assistant-1752915700000',
      role: 'assistant',
      name: 'Mingo AI',
      content: [
        { type: 'thinking', text: 'Checking pricing docs…' },
        { type: 'text', text: 'Pricing starts at $99/month per site.' },
      ],
      timestamp: '2026-07-19T09:01:45.000Z',
    },
  ],
  // sendIdx-keyed maps (entries arrays, as serialized by savePersistedChat).
  sources: [
    [
      1,
      [
        {
          index: 1,
          name: 'Pricing overview',
          path: 'docs/pricing.md',
          documentType: 'markdown',
          sourceRepo: 'markdown',
        },
      ],
    ],
  ],
  refs: [
    [
      0,
      {
        'ticket:77': {
          type: 'ticket',
          id: '77',
          title: 'Broken printer',
          url: null,
          metadata: { status: 'OPEN' },
        },
      },
    ],
  ],
  sendCount: 2,
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PersistedChatState v1 — golden rehydration (migration contract)', () => {
  it('restores messages / refs / sources from a hand-crafted v1 blob (snapshot)', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_BLOB))

    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })

    // Pin the FULL rehydrated public state:
    //  - hidden approval-action turn + migrated directive bubble carry hidden:true
    //  - all THREE assistant messages of send #0 resolve chatRefs['ticket:77']
    //    (message-bound copy on the receipt, refs-map fallback for the others)
    //  - send #1's assistant message carries the sources array
    expect({
      messages: result.current.messages,
      streamingPhase: result.current.streamingPhase,
      isLoading: result.current.isLoading,
    }).toMatchSnapshot()
  })

  it('forward-migration flips a non-hidden auto-continuation directive bubble to hidden', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_BLOB))
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })
    const directive = result.current.messages.find((m) =>
      m.content.startsWith(AUTO_CONTINUATION_DIRECTIVE_PREFIX),
    )
    expect(directive?.hidden).toBe(true)
  })

  it('hidden user turns do NOT advance the sendIdx used for sources/refs lookup', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_BLOB))
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })
    const assistants = result.current.messages.filter((m) => m.role === 'assistant')
    // Send #0 fans out into THREE assistant bubbles (main reply +
    // post-approve receipt + continuation); send #1 adds a fourth.
    expect(assistants).toHaveLength(4)
    // All send-#0 assistant bubbles resolve the ticket ref…
    expect(assistants[0].chatRefs?.['ticket:77']?.id).toBe('77')
    expect(assistants[1].chatRefs?.['ticket:77']?.id).toBe('77')
    expect(assistants[2].chatRefs?.['ticket:77']?.id).toBe('77')
    // …and the send-#1 bubble gets the pricing sources instead.
    expect(assistants[3].sources?.[0]?.name).toBe('Pricing overview')
    expect(assistants[3].chatRefs).toBeUndefined()
  })

  it('a corrupt blob falls back to an empty conversation', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not json')
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })
    expect(result.current.messages).toEqual([])
  })

  it('rehydration round-trips: the persist callback re-saves an equivalent v1 blob', () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_BLOB))
    renderHook(() => useSseChatAdapter(undefined, { active: false }), { wrapper })

    // Mounting fires onMessagesChange → savePersistedChat with the loaded
    // state (timestamps re-serialized to ISO strings, directive bubble now
    // hidden:true). Pin the re-saved wire shape — THIS is the exact v1 blob
    // a future reducer will find on disk.
    const resaved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)
    expect(resaved).toMatchSnapshot()
  })
})
