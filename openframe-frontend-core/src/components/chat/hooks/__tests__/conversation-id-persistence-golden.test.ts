/**
 * GOLDEN CONTRACT TESTS — server-issued conversation ids + server-side
 * history hydration in the SSE adapter.
 *
 * Successor to the retired `persisted-state-v1-golden.test.ts`: the
 * PersistedChatState v1 full-history localStorage blob is DELETED by design
 * (memory `project_chat_server_history_ssot`). The contract pinned here is
 * its replacement:
 *
 *   - conversation ids are SERVER-minted, captured from the leading
 *     metadata frame, and localStorage stores ONLY the echoed id
 *     (`mingo-chat-<source>.conversation`);
 *   - the wire carries ONLY the newest user message (+ the echoed
 *     conversation id) — never a replay of client history;
 *   - mount-time history hydrates from `GET <chatStreamUrl>/history` and
 *     materializes THROUGH THE REDUCER (messages, sendIdx-keyed refs, send
 *     counter — same fan-out lookup as live turns);
 *   - stale keys — other proxy-auth identities AND the retired v1
 *     full-history blobs — are swept on mount; a leftover v1 blob neither
 *     crashes the adapter nor resurrects its messages.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSseChatAdapter } from '../use-sse-chat-adapter'
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context'
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../../utils/auto-continuation-directive'
import {
  createChatConversationStorage,
  pruneStaleChatConversationStorage,
} from '../../utils/chat-conversation-storage'

const SOURCE = 'goldensrc'
/** `createLocalStorageAdapter` key shape: `<namespace>.<key>`. */
const CONVERSATION_KEY = `mingo-chat-${SOURCE}.conversation`
/** Retired v1 full-history key (pre-server-SSOT design). */
const V1_KEY = `mingo-chat-${SOURCE}-v1`

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

const enc = new TextEncoder()

function streamOf(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(typeof c === 'string' ? enc.encode(c) : c)
      }
      controller.close()
    },
  })
}

/**
 * URL-routing fetch mock:
 *   GET  …/history   → the provided history payload (404 when omitted)
 *   GET  …/commands  → empty registry (adapter degrades silently)
 *   POST chat stream → one streamed wire response per call, in order
 *     (the LAST entry repeats for any further sends).
 */
function mockRoutedFetch(options: {
  history?: unknown
  streams: Array<Array<string | Uint8Array>>
}) {
  let streamCall = 0
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    const u = String(url)
    if (u.includes('/history')) {
      if (options.history === undefined) {
        return { ok: false, status: 404 } as unknown as Response
      }
      return {
        ok: true,
        status: 200,
        json: async () => options.history,
      } as unknown as Response
    }
    if (u.includes('/commands')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ commands: [] }),
      } as unknown as Response
    }
    const chunks = options.streams[Math.min(streamCall, options.streams.length - 1)]
    streamCall += 1
    return { ok: true, status: 200, body: streamOf(chunks) } as unknown as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

/** POST bodies the mock received for the chat-stream endpoint only. */
function chatBodies(fetchMock: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes('/api/docs/chat') && !String(url).includes('/history'))
    .map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

const USAGE_END_TRAILER =
  '{"kind":"usage","stage":"end","input_tokens":10,"output_tokens":5,"hit_rate_pct":50}'

/** Wire fixture: metadata frame echoing a server-minted conversation id. */
function wireTurn(conversationId: string, answer: string): Array<string> {
  return [
    `{"modelLabel":"Claude Sonnet","provider":"anthropic","conversationId":"${conversationId}"}\0`,
    '\x1E',
    answer,
    '\x1F' + USAGE_END_TRAILER,
  ]
}

/** Server transcript fixture — 2 turns; turn #0's assistant row carries a
 *  card ref that must land at sendIdx 0 (same fan-out scheme as live). */
const HISTORY_PAYLOAD = {
  data: {
    messages: [
      {
        seq: 1,
        role: 'user',
        content: 'open a ticket for the broken printer',
        created_at: '2026-07-19T09:00:00.000Z',
      },
      {
        seq: 2,
        role: 'assistant',
        content: '✅ Approved — ticket created: [card://ticket:77]',
        created_at: '2026-07-19T09:00:12.000Z',
        chat_refs: {
          'ticket:77': {
            type: 'ticket',
            id: '77',
            title: 'Broken printer',
            url: null,
            metadata: { status: 'OPEN' },
          },
        },
      },
      {
        seq: 3,
        role: 'user',
        content: 'what is the pricing?',
        created_at: '2026-07-19T09:01:40.000Z',
      },
      {
        seq: 4,
        role: 'assistant',
        content: 'Pricing starts at $99/month per site.',
        created_at: '2026-07-19T09:01:45.000Z',
      },
    ],
  },
}

/** The retired v1 blob shape (abbreviated) — must be swept, never read. */
const V1_BLOB = {
  messages: [
    { id: 'user-1', role: 'user', name: 'You', content: 'old v1 question' },
    {
      id: 'assistant-1',
      role: 'assistant',
      name: 'Mingo AI',
      content: [{ type: 'text', text: 'old v1 answer' }],
    },
  ],
  sources: [],
  refs: [],
  sendCount: 1,
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('conversation-id storage — id-only round-trip', () => {
  it('save → load → clear round-trips exactly the conversation id', () => {
    const storage = createChatConversationStorage(SOURCE)
    expect(storage.load()).toBeNull()
    storage.save({ conversationId: 'conv-rt-1' })
    // On-disk shape is the id and NOTHING else — no messages, sources,
    // refs, or send counts ever reach localStorage.
    expect(JSON.parse(window.localStorage.getItem(CONVERSATION_KEY)!)).toEqual({
      conversationId: 'conv-rt-1',
    })
    expect(storage.load()).toEqual({ conversationId: 'conv-rt-1' })
    storage.clear()
    expect(storage.load()).toBeNull()
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBeNull()
  })

  it('rejects malformed blobs via the validate gate', () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: '' }))
    expect(createChatConversationStorage(SOURCE).load()).toBeNull()
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ nope: true }))
    expect(createChatConversationStorage(SOURCE).load()).toBeNull()
  })
})

describe('stale-key pruning', () => {
  it('sweeps other-identity keys and retired v1/full-history shapes, keeps the current key and sibling sources', () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-keep' }))
    window.localStorage.setItem(`mingo-chat-${SOURCE}`, 'retired raw shape')
    window.localStorage.setItem(V1_KEY, JSON.stringify(V1_BLOB))
    window.localStorage.setItem(
      `mingo-chat-${SOURCE}-u-someone%40example.com.conversation`,
      JSON.stringify({ conversationId: 'conv-other-identity' }),
    )
    // Hyphen-extended SIBLING source — NOT this source's namespace.
    window.localStorage.setItem(
      `mingo-chat-${SOURCE}-teaser.conversation`,
      JSON.stringify({ conversationId: 'conv-sibling' }),
    )

    pruneStaleChatConversationStorage(SOURCE)

    expect(window.localStorage.getItem(CONVERSATION_KEY)).not.toBeNull()
    expect(window.localStorage.getItem(`mingo-chat-${SOURCE}`)).toBeNull()
    expect(window.localStorage.getItem(V1_KEY)).toBeNull()
    expect(
      window.localStorage.getItem(`mingo-chat-${SOURCE}-u-someone%40example.com.conversation`),
    ).toBeNull()
    expect(window.localStorage.getItem(`mingo-chat-${SOURCE}-teaser.conversation`)).not.toBeNull()
  })
})

describe('server-minted conversation id (full hook path)', () => {
  it('captures the echoed id, persists id-only, and sends newest-message-only bodies', async () => {
    const fetchMock = mockRoutedFetch({
      streams: [wireTurn('conv-golden-1', 'First answer.'), wireTurn('conv-golden-1', 'Second answer.')],
    })
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })

    await act(async () => {
      await result.current.sendMessage('first question')
    })
    // The echoed id — and ONLY the id — is persisted.
    expect(JSON.parse(window.localStorage.getItem(CONVERSATION_KEY)!)).toEqual({
      conversationId: 'conv-golden-1',
    })

    await act(async () => {
      await result.current.sendMessage('second question')
    })

    const bodies = chatBodies(fetchMock)
    // First send of the session: no id yet — the server mints one.
    expect(bodies[0]).toEqual({ messages: [{ role: 'user', content: 'first question' }] })
    // Every later send: NEWEST message only + the echoed id. The client
    // thread (4 messages by now) is never replayed on the wire.
    expect(bodies[1]).toEqual({
      messages: [{ role: 'user', content: 'second question' }],
      conversationId: 'conv-golden-1',
    })
    expect(result.current.messages).toHaveLength(4)
  })

  it('clearMessages drops the stored id so the next send is id-less (fresh conversation)', async () => {
    const fetchMock = mockRoutedFetch({
      streams: [wireTurn('conv-golden-2', 'Answer.'), wireTurn('conv-golden-3', 'Fresh answer.')],
    })
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })
    await act(async () => {
      await result.current.sendMessage('question')
    })
    expect(window.localStorage.getItem(CONVERSATION_KEY)).not.toBeNull()

    act(() => {
      result.current.clearMessages()
    })
    expect(result.current.messages).toEqual([])
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBeNull()

    await act(async () => {
      await result.current.sendMessage('fresh question')
    })
    const bodies = chatBodies(fetchMock)
    expect(bodies[1]).toEqual({ messages: [{ role: 'user', content: 'fresh question' }] })
    // The new conversation's id is re-captured from the fresh stream.
    expect(JSON.parse(window.localStorage.getItem(CONVERSATION_KEY)!)).toEqual({
      conversationId: 'conv-golden-3',
    })
  })
})

describe('server-history hydration (materializes through the reducer)', () => {
  it('rebuilds messages + sendIdx-keyed refs + send counter from the transcript', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-h1' }))
    const fetchMock = mockRoutedFetch({
      history: HISTORY_PAYLOAD,
      streams: [
        [
          // The live turn after hydration carries sources — they must land
          // at the CONTINUED send index (sendIdx 2), proving the hydrated
          // send counter seeds the reducer's maps.
          '{"sources":[{"index":1,"name":"Pricing overview","path":"docs/pricing.md","documentType":"markdown"}],"conversationId":"conv-h1"}\0',
          '\x1E',
          'Live answer after hydration.',
          '\x1F' + USAGE_END_TRAILER,
        ],
      ],
    })
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: true }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.messages).toHaveLength(4))
    expect(result.current.isHydratingHistory).toBe(false)

    // History fetched by stored conversation id.
    const historyCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/history'))
    expect(String(historyCall![0])).toContain('conversationId=conv-h1')

    // Full hydrated projection — messages, roles, hidden flags, refs
    // resolved through the reducer's fan-out lookup (send #0's assistant
    // resolves ticket:77; send #1's does not).
    expect(result.current.messages).toMatchSnapshot()
    const assistants = result.current.messages.filter((m) => m.role === 'assistant')
    expect(assistants[0].chatRefs?.['ticket:77']?.id).toBe('77')
    expect(assistants[1].chatRefs).toBeUndefined()

    // A live send continues the SAME conversation: newest-message-only body
    // with the stored id, and its sources key at the continued send index.
    await act(async () => {
      await result.current.sendMessage('and the enterprise tier?')
    })
    const bodies = chatBodies(fetchMock)
    expect(bodies[0]).toEqual({
      messages: [{ role: 'user', content: 'and the enterprise tier?' }],
      conversationId: 'conv-h1',
    })
    const liveAssistant = result.current.messages[result.current.messages.length - 1]
    expect(liveAssistant.role).toBe('assistant')
    expect(liveAssistant.sources?.[0]?.name).toBe('Pricing overview')
  })

  it('marks approval placeholders and auto-continuation directives hidden', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-h2' }))
    mockRoutedFetch({
      history: {
        data: {
          messages: [
            { seq: 1, role: 'user', content: 'open a ticket', created_at: '2026-07-19T09:00:00.000Z' },
            { seq: 2, role: 'assistant', content: 'Done.', created_at: '2026-07-19T09:00:05.000Z' },
            // Approval placeholder ('') and the server-built directive are
            // LLM history, never rendered.
            { seq: 3, role: 'user', content: '', created_at: '2026-07-19T09:00:10.000Z' },
            {
              seq: 4,
              role: 'user',
              content: `${AUTO_CONTINUATION_DIRECTIVE_PREFIX} ask a follow-up.`,
              created_at: '2026-07-19T09:00:11.000Z',
            },
          ],
        },
      },
      streams: [],
    })
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: true }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.messages).toHaveLength(4))
    expect(result.current.messages[2].hidden).toBe(true)
    expect(result.current.messages[3].hidden).toBe(true)
  })

  it('a hydration miss starts the UI empty (server still owns history)', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-h3' }))
    mockRoutedFetch({ streams: [] }) // history → 404
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: true }), {
      wrapper,
    })
    await act(async () => {
      await tick()
      await tick()
    })
    expect(result.current.messages).toEqual([])
    expect(result.current.isHydratingHistory).toBe(false)
  })
})

describe('leftover PersistedChatState v1 blobs', () => {
  it('neither crash the adapter nor resurrect messages — the blob is swept on mount', () => {
    window.localStorage.setItem(V1_KEY, JSON.stringify(V1_BLOB))
    mockRoutedFetch({ streams: [] })
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })
    // v1 history is server-side now — the blob is never read back.
    expect(result.current.messages).toEqual([])
    // …and the mount-time sweep removed it.
    expect(window.localStorage.getItem(V1_KEY)).toBeNull()
  })

  it('a corrupt v1 blob is equally harmless', () => {
    window.localStorage.setItem(V1_KEY, '{not json')
    mockRoutedFetch({ streams: [] })
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    })
    expect(result.current.messages).toEqual([])
    expect(window.localStorage.getItem(V1_KEY)).toBeNull()
  })
})
