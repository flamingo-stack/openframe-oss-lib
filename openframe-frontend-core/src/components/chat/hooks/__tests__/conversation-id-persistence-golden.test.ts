/**
 * GOLDEN CONTRACT TESTS — server-issued conversation ids + server-side
 * history hydration in the SSE adapter.
 *
 * Successor to the retired `persisted-state-v1-golden.test.ts`: the
 * PersistedChatState v1 full-history localStorage blob is DELETED by design
 * (memory `project_chat_server_history_ssot`). The contract pinned here is
 * its replacement:
 *
 *   - conversation ids are SERVER-minted, captured from the stream's
 *     message metadata, and localStorage stores ONLY the echoed id
 *     (`mingo-chat-<source>.conversation`);
 *   - the wire carries ONLY the newest user message, under the echoed
 *     conversation id, never a replay of client history;
 *   - mount-time history hydrates from `GET <chatStreamUrl>/history` and
 *     materializes THROUGH THE REDUCER (inline cards hydrate by id from the
 *     record links in the text, no per-row refs);
 *   - stale keys — other proxy-auth identities AND the retired v1
 *     full-history blobs — are swept on mount; a leftover v1 blob neither
 *     crashes the adapter nor resurrects its messages.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isSourcePart, textOfParts } from '../../../../chat-protocol/chat-message';
import { encodeUiChunk, encodeUiDone } from '../../../../chat-protocol/ui-chunks';
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context';
import { AUTO_CONTINUATION_DIRECTIVE_PREFIX } from '../../utils/auto-continuation-directive';
import {
  createChatConversationStorage,
  pruneStaleChatConversationStorage,
} from '../../utils/chat-conversation-storage';
import { useSseChatAdapter } from '../use-sse-chat-adapter';

const SOURCE = 'goldensrc';
/** `createLocalStorageAdapter` key shape: `<namespace>.<key>`. */
const CONVERSATION_KEY = `mingo-chat-${SOURCE}.conversation`;
/** Retired v1 full-history key (pre-server-SSOT design). */
const V1_KEY = `mingo-chat-${SOURCE}-v1`;

/**
 * `localStorage.getItem` returns `string | null`. A missing key means the
 * persistence step under test never ran at all — throw and name it, rather
 * than feeding `null` to `JSON.parse` (which yields `null`) and failing the
 * assertion on a confusing object diff.
 */
const readPersistedConversation = (): unknown => {
  const raw = window.localStorage.getItem(CONVERSATION_KEY);
  if (raw === null) throw new Error(`nothing persisted at localStorage key "${CONVERSATION_KEY}"`);
  return JSON.parse(raw);
};

const runtime: ChatRuntime = {
  endpoints: {
    chatStreamUrl: '/api/docs/chat',
    commandsUrl: '/api/docs/commands',
    buildListUrl: () => null,
    attachmentUploadUrl: '/api/storage/generate-upload-url',
    attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
    identityUrl: '/api/chat/identity',
  },
  navigation: { mode: 'host' },
  source: SOURCE,
};

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(ChatRuntimeContext.Provider, { value: runtime }, children),
  );
}

const enc = new TextEncoder();

function streamOf(chunks: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) {
        controller.enqueue(typeof c === 'string' ? enc.encode(c) : c);
      }
      controller.close();
    },
  });
}

/**
 * URL-routing fetch mock:
 *   GET  …/history   → the provided history payload (404 when omitted)
 *   GET  …/commands  → empty registry (adapter degrades silently)
 *   POST chat stream → one streamed wire response per call, in order
 *     (the LAST entry repeats for any further sends).
 */
function mockRoutedFetch(options: { history?: unknown; streams: Array<Array<string | Uint8Array>> }) {
  let streamCall = 0;
  // Returns promises explicitly rather than via `async`: the routing itself is
  // synchronous, but `fetch` (and `Response.json`) must stay promise-returning
  // so the adapter exercises the same async path it does in production.
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    const u = String(url);
    if (u.includes('/history')) {
      if (options.history === undefined) {
        return Promise.resolve({ ok: false, status: 404 } as unknown as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(options.history),
      } as unknown as Response);
    }
    if (u.includes('/commands')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ commands: [] }),
      } as unknown as Response);
    }
    const chunks = options.streams[Math.min(streamCall, options.streams.length - 1)];
    streamCall += 1;
    return Promise.resolve({ ok: true, status: 200, body: streamOf(chunks) } as unknown as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/**
 * The chat-stream POST body — the contract these goldens exist to pin. Written
 * out rather than left as `Record<string, unknown>` because the whole point of
 * the suite is WHICH keys the adapter sends: the newest message only, under
 * the conversation the server has minted.
 */
interface ChatStreamRequestBody {
  id: string;
  messages: Array<{ id: string; role: string; parts: unknown[] }>;
}

/** The body of a send of `text`, under a client id or the conversation's. */
const sendOf = (text: string, conversationId?: string): ChatStreamRequestBody => ({
  id: conversationId ?? (expect.stringMatching(/^chat-/) as string),
  messages: [
    {
      id: expect.stringMatching(/^user-/) as string,
      role: 'user',
      parts: [{ type: 'text', text }],
    },
  ],
});

/** POST bodies the mock received for the chat-stream endpoint only.
 *  Typed off `mockRoutedFetch` so `mock.calls` carries fetch's real
 *  `(url, init)` tuple instead of `any[]` — a mock typed `any` pins nothing. */
function chatBodies(fetchMock: ReturnType<typeof mockRoutedFetch>): ChatStreamRequestBody[] {
  return fetchMock.mock.calls
    .filter(([url]) => url.includes('/api/docs/chat') && !url.includes('/history'))
    .map(
      ([, init]) =>
        // A non-string body is a genuine failure, not something to paper over —
        // parse `{}` so the caller's `toEqual` reports it instead of throwing here.
        JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as ChatStreamRequestBody,
    );
}

/** A turn on the standard's wire, echoing a server-minted conversation id. */
let turnCount = 0;
function uiWireTurn(conversationId: string, answer: string): Uint8Array[] {
  turnCount += 1;
  return [
    encodeUiChunk({ type: 'start', messageId: `a-${turnCount}`, messageMetadata: { conversationId } }),
    encodeUiChunk({ type: 'text-delta', id: 't1', delta: answer }),
    encodeUiChunk({ type: 'finish', finishReason: 'stop', messageMetadata: { conversationId } }),
    encodeUiDone(),
  ];
}

/** Server transcript fixture: 2 turns, each row its own id and parts. Cards hydrate by id from the record link in
 *  the text. */
const HISTORY_PAYLOAD = {
  data: {
    messages: [
      {
        id: 'h-1',
        role: 'user',
        metadata: { seq: 1, createdAt: '2026-07-19T09:00:00.000Z' },
        parts: [{ type: 'text', text: 'open a ticket for the broken printer' }],
      },
      {
        id: 'h-2',
        role: 'assistant',
        metadata: { seq: 2, createdAt: '2026-07-19T09:00:12.000Z' },
        parts: [{ type: 'text', text: '✅ Approved — ticket created: [77](record://ticket/77)' }],
      },
      {
        id: 'h-3',
        role: 'user',
        metadata: { seq: 3, createdAt: '2026-07-19T09:01:40.000Z' },
        parts: [{ type: 'text', text: 'what is the pricing?' }],
      },
      {
        id: 'h-4',
        role: 'assistant',
        metadata: { seq: 4, createdAt: '2026-07-19T09:01:45.000Z' },
        parts: [{ type: 'text', text: 'Pricing starts at $99/month per site.' }],
      },
    ],
  },
};

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
};

const tick = () => new Promise<void>(r => setTimeout(r, 0));

beforeEach(() => {
  window.localStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('conversation-id storage — id-only round-trip', () => {
  it('save → load → clear round-trips exactly the conversation id', () => {
    const storage = createChatConversationStorage(SOURCE);
    expect(storage.load()).toBeNull();
    storage.save({ conversationId: 'conv-rt-1' });
    // On-disk shape is the id and NOTHING else — no messages, sources,
    // refs, or send counts ever reach localStorage.
    expect(readPersistedConversation()).toEqual({
      conversationId: 'conv-rt-1',
    });
    expect(storage.load()).toEqual({ conversationId: 'conv-rt-1' });
    storage.clear();
    expect(storage.load()).toBeNull();
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBeNull();
  });

  it('rejects malformed blobs via the validate gate', () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: '' }));
    expect(createChatConversationStorage(SOURCE).load()).toBeNull();
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ nope: true }));
    expect(createChatConversationStorage(SOURCE).load()).toBeNull();
  });
});

describe('stale-key pruning', () => {
  it('sweeps other-identity keys and retired v1/full-history shapes, keeps the current key and sibling sources', () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-keep' }));
    window.localStorage.setItem(`mingo-chat-${SOURCE}`, 'retired raw shape');
    window.localStorage.setItem(V1_KEY, JSON.stringify(V1_BLOB));
    window.localStorage.setItem(
      `mingo-chat-${SOURCE}-u-someone%40example.com.conversation`,
      JSON.stringify({ conversationId: 'conv-other-identity' }),
    );
    // Hyphen-extended SIBLING source — NOT this source's namespace.
    window.localStorage.setItem(
      `mingo-chat-${SOURCE}-teaser.conversation`,
      JSON.stringify({ conversationId: 'conv-sibling' }),
    );

    pruneStaleChatConversationStorage(SOURCE);

    expect(window.localStorage.getItem(CONVERSATION_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(`mingo-chat-${SOURCE}`)).toBeNull();
    expect(window.localStorage.getItem(V1_KEY)).toBeNull();
    expect(window.localStorage.getItem(`mingo-chat-${SOURCE}-u-someone%40example.com.conversation`)).toBeNull();
    expect(window.localStorage.getItem(`mingo-chat-${SOURCE}-teaser.conversation`)).not.toBeNull();
  });
});

describe('server-minted conversation id (full hook path)', () => {
  it('captures the echoed id, persists id-only, and sends newest-message-only bodies', async () => {
    const fetchMock = mockRoutedFetch({
      streams: [uiWireTurn('conv-golden-1', 'First answer.'), uiWireTurn('conv-golden-1', 'Second answer.')],
    });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    });

    await act(async () => {
      await result.current.sendMessage('first question');
    });
    // The echoed id — and ONLY the id — is persisted.
    expect(readPersistedConversation()).toEqual({
      conversationId: 'conv-golden-1',
    });

    await act(async () => {
      await result.current.sendMessage('second question');
    });

    const bodies = chatBodies(fetchMock);
    // First send of the session: no id yet — the server mints one.
    expect(bodies[0]).toEqual(sendOf('first question'));
    // Every later send: NEWEST message only + the echoed id. The client
    // thread (4 messages by now) is never replayed on the wire.
    expect(bodies[1]).toEqual(sendOf('second question', 'conv-golden-1'));
    expect(result.current.messages).toHaveLength(4);
  });

  it('reads the echoed id off the standard wire the same way', async () => {
    const fetchMock = mockRoutedFetch({
      streams: [uiWireTurn('conv-ui-1', 'First answer.'), uiWireTurn('conv-ui-1', 'Second answer.')],
    });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), { wrapper });

    await act(async () => {
      await result.current.sendMessage('first question');
    });
    expect(readPersistedConversation()).toEqual({ conversationId: 'conv-ui-1' });

    await act(async () => {
      await result.current.sendMessage('second question');
    });
    expect(chatBodies(fetchMock)[1]).toEqual(sendOf('second question', 'conv-ui-1'));
  });

  it('clearMessages drops the stored id so the next send is id-less (fresh conversation)', async () => {
    const fetchMock = mockRoutedFetch({
      streams: [uiWireTurn('conv-golden-2', 'Answer.'), uiWireTurn('conv-golden-3', 'Fresh answer.')],
    });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    });
    await act(async () => {
      await result.current.sendMessage('question');
    });
    expect(window.localStorage.getItem(CONVERSATION_KEY)).not.toBeNull();

    act(() => {
      result.current.clearMessages();
    });
    expect(result.current.messages).toEqual([]);
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBeNull();

    await act(async () => {
      await result.current.sendMessage('fresh question');
    });
    const bodies = chatBodies(fetchMock);
    expect(bodies[1]).toEqual(sendOf('fresh question'));
    // The new conversation's id is re-captured from the fresh stream.
    expect(readPersistedConversation()).toEqual({
      conversationId: 'conv-golden-3',
    });
  });
});

describe('server-history hydration (materializes through the reducer)', () => {
  it("a saved message keeps its own time and sources; a receipt has none of its answer's", async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-h2' }));
    const source = {
      type: 'source-document',
      sourceId: 'record://markdown/docs%2Fpricing.md',
      mediaType: 'text/markdown',
      title: 'Pricing overview',
    };
    const row = (id: string, role: string, createdAt: string, parts: unknown[]) => ({
      id,
      role,
      metadata: { createdAt },
      parts,
    });
    mockRoutedFetch({
      history: {
        found: true,
        messages: [
          row('s-0', 'user', '2026-07-19T09:00:00.000Z', [{ type: 'text', text: 'create a task' }]),
          row('s-1', 'assistant', '2026-07-19T09:00:05.000Z', [source, { type: 'text', text: 'Proposal.' }]),
          row('s-2', 'assistant', '2026-07-19T09:01:00.000Z', [{ type: 'text', text: 'Task created.' }]),
        ],
      },
      streams: [],
    });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: true }), { wrapper });
    await waitFor(() => expect(result.current.messages).toHaveLength(3));
    expect(result.current.messages.map(m => m.parts.filter(isSourcePart).length)).toEqual([0, 1, 0]);
    expect(result.current.messages.map(m => new Date(m.metadata?.createdAt ?? 0).toISOString())).toEqual([
      '2026-07-19T09:00:00.000Z',
      '2026-07-19T09:00:05.000Z',
      '2026-07-19T09:01:00.000Z',
    ]);
  });

  it('rebuilds the thread from the transcript', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-h1' }));
    const fetchMock = mockRoutedFetch({
      history: HISTORY_PAYLOAD,
      streams: [
        // The live turn after hydration carries sources: they must land on its own message.
        [
          encodeUiChunk({ type: 'start', messageId: 'a-live', messageMetadata: { conversationId: 'conv-h1' } }),
          encodeUiChunk({
            type: 'source-document',
            sourceId: 'record://markdown/docs%2Fpricing.md',
            mediaType: 'text/markdown',
            title: 'Pricing overview',
          }),
          encodeUiChunk({ type: 'text-delta', id: 't1', delta: 'Live answer after hydration.' }),
          encodeUiChunk({ type: 'finish', finishReason: 'stop' }),
          encodeUiDone(),
        ],
      ],
    });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: true }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(4));
    expect(result.current.isHydratingHistory).toBe(false);

    // History fetched by stored conversation id.
    const historyCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/history'));
    if (!historyCall) throw new Error('no /history request was issued for the stored conversation id');
    expect(String(historyCall[0])).toContain('conversationId=conv-h1');

    // Full hydrated projection: messages, roles, hidden flags. The record link
    // in the text is the only card channel (hydrate-by-id).
    expect(result.current.messages).toMatchSnapshot();
    const assistants = result.current.messages.filter(m => m.role === 'assistant');
    expect(textOfParts(assistants[0].parts)).toContain('[77](record://ticket/77)');

    // A live send continues the SAME conversation: newest-message-only body
    // with the stored id, and its sources on its own message.
    await act(async () => {
      await result.current.sendMessage('and the enterprise tier?');
    });
    const bodies = chatBodies(fetchMock);
    expect(bodies[0]).toEqual(sendOf('and the enterprise tier?', 'conv-h1'));
    const liveAssistant = result.current.messages[result.current.messages.length - 1];
    expect(liveAssistant.role).toBe('assistant');
    expect(liveAssistant.parts.filter(isSourcePart)[0]?.title).toBe('Pricing overview');
  });

  it('marks approval placeholders and auto-continuation directives hidden', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-h2' }));
    mockRoutedFetch({
      history: {
        data: {
          messages: [
            { id: 'm-1', role: 'user', parts: [{ type: 'text', text: 'open a ticket' }] },
            { id: 'm-2', role: 'assistant', parts: [{ type: 'text', text: 'Done.' }] },
            // Approval placeholder ('') and the server-built directive are
            // LLM history, never rendered.
            { id: 'm-3', role: 'user', parts: [] },
            {
              id: 'm-4',
              role: 'user',
              parts: [{ type: 'text', text: `${AUTO_CONTINUATION_DIRECTIVE_PREFIX} ask a follow-up.` }],
            },
          ],
        },
      },
      streams: [],
    });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: true }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.messages).toHaveLength(4));
    expect(result.current.messages[2].metadata?.hidden).toBe(true);
    expect(result.current.messages[3].metadata?.hidden).toBe(true);
  });

  it('a hydration miss starts the UI empty (server still owns history)', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'conv-h3' }));
    mockRoutedFetch({ streams: [] }); // history → 404
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: true }), {
      wrapper,
    });
    await act(async () => {
      await tick();
      await tick();
    });
    expect(result.current.messages).toEqual([]);
    expect(result.current.isHydratingHistory).toBe(false);
  });
});

describe('leftover PersistedChatState v1 blobs', () => {
  it('neither crash the adapter nor resurrect messages — the blob is swept on mount', () => {
    window.localStorage.setItem(V1_KEY, JSON.stringify(V1_BLOB));
    mockRoutedFetch({ streams: [] });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    });
    // v1 history is server-side now — the blob is never read back.
    expect(result.current.messages).toEqual([]);
    // …and the mount-time sweep removed it.
    expect(window.localStorage.getItem(V1_KEY)).toBeNull();
  });

  it('a corrupt v1 blob is equally harmless', () => {
    window.localStorage.setItem(V1_KEY, '{not json');
    mockRoutedFetch({ streams: [] });
    const { result } = renderHook(() => useSseChatAdapter(undefined, { active: false }), {
      wrapper,
    });
    expect(result.current.messages).toEqual([]);
    expect(window.localStorage.getItem(V1_KEY)).toBeNull();
  });
});
