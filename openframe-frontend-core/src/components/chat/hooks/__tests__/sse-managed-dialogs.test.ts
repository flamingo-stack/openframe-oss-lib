/**
 * GOLDEN CONTRACT TESTS — Guide/SSE adapter with a managed conversation list
 * (`ChatRuntime.endpoints.chatConversationsUrl`).
 *
 * Pins:
 *   - mount with a stored id → `activeDialogId` = stored, ONE list GET
 *     (`status=active&limit=20`), ONE history GET;
 *   - `selectDialog('b')` → thread reset, history GET for `b`, storage = `b`,
 *     `isMessagesLoading` true → false;
 *   - `clearMessages` → draft state (null id, storage cleared);
 *   - first send of a NEW conversation → id captured from the metadata frame,
 *     NO history GET for that id, list re-read at end of turn;
 *   - rename / archive / restore go to the PATCH wire; archiving the open
 *     conversation drops to draft;
 *   - ZERO-REGRESSION: without the endpoint `dialogs` is `[]`,
 *     `dialogsManaged` is false and no conversations request is issued.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatRuntimeContext, type ChatRuntime } from '../../../../contexts/chat-runtime-context';
import { useSseChatAdapter } from '../use-sse-chat-adapter';

const SOURCE = 'managedsrc';
const CONVERSATION_KEY = `mingo-chat-${SOURCE}.conversation`;
const CONVERSATIONS_URL = '/api/docs/chat/conversations';

const baseEndpoints: ChatRuntime['endpoints'] = {
  chatStreamUrl: '/api/docs/chat',
  approvalToolUrl: '/api/chat/agent/confirm-tool',
  commandsUrl: '/api/docs/commands',
  buildListUrl: () => null,
  attachmentUploadUrl: '/api/storage/generate-upload-url',
  attachmentViewUrlPrefix: '/api/storage/view/chat-attachments/',
  identityUrl: '/api/chat/identity',
};

function makeWrapper(runtime: ChatRuntime) {
  return function wrapper({ children }: { children: ReactNode }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(ChatRuntimeContext.Provider, { value: runtime }, children),
    );
  };
}

const managedRuntime: ChatRuntime = {
  endpoints: { ...baseEndpoints, chatConversationsUrl: CONVERSATIONS_URL },
  navigation: { mode: 'host' },
  source: SOURCE,
};
const plainRuntime: ChatRuntime = { endpoints: baseEndpoints, navigation: { mode: 'host' }, source: SOURCE };

const enc = new TextEncoder();
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}
const USAGE_END_TRAILER = '{"kind":"usage","stage":"end","input_tokens":10,"output_tokens":5,"hit_rate_pct":50}';
function wireTurn(conversationId: string, answer: string): string[] {
  return [
    `{"modelLabel":"Claude Sonnet","provider":"anthropic","conversationId":"${conversationId}"}\0`,
    '\x1E',
    answer,
    '\x1F' + USAGE_END_TRAILER,
  ];
}

const historyFor = (id: string) => ({
  data: {
    messages: [
      { seq: 0, role: 'user', content: `q for ${id}`, created_at: '2026-09-01T09:00:00.000Z' },
      { seq: 1, role: 'assistant', content: `a for ${id}`, created_at: '2026-09-01T09:00:05.000Z' },
    ],
  },
});
const listPayload = (ids: string[]) => ({
  data: {
    dialogs: ids.map(id => ({ id, title: `Chat ${id}`, timestamp: '2026-09-01T09:00:00.000Z' })),
    nextCursor: null,
  },
});

type Call = { url: string; init: RequestInit };
function mockFetch(options: { list?: () => unknown; streams?: string[][] }) {
  const calls: Call[] = [];
  let streamCall = 0;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init: init ?? {} });
    const json = (body: unknown, status = 200) =>
      Promise.resolve({ ok: status < 300, status, json: () => Promise.resolve(body) } as unknown as Response);
    if (u.startsWith(CONVERSATIONS_URL + '/')) return json({ data: { id: 'x' } });
    if (u.startsWith(CONVERSATIONS_URL)) return json(options.list ? options.list() : listPayload([]));
    if (u.includes('/history')) {
      const id = new URL(u, 'http://x').searchParams.get('conversationId') ?? '';
      return json(historyFor(id));
    }
    if (u.includes('/commands')) return json({ commands: [] });
    const streams = options.streams ?? [];
    const chunks = streams[Math.min(streamCall, streams.length - 1)] ?? [];
    streamCall += 1;
    return Promise.resolve({ ok: true, status: 200, body: streamOf(chunks) } as unknown as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, calls };
}
const urlsOf = (calls: Call[], prefix: string) => calls.filter(c => c.url.startsWith(prefix)).map(c => c.url);

describe('useSseChatAdapter — managed conversation list', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mount with a stored id: lists once, hydrates once, highlights the stored conversation', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'a' }));
    const { calls } = mockFetch({ list: () => listPayload(['a', 'b']) });
    const { result } = renderHook(() => useSseChatAdapter(), { wrapper: makeWrapper(managedRuntime) });

    await waitFor(() => expect(result.current.dialogs.map(d => d.id)).toEqual(['a', 'b']));
    await waitFor(() => expect(result.current.messages.length).toBe(2));
    expect(result.current.dialogsManaged).toBe(true);
    expect(result.current.activeDialogId).toBe('a');
    expect(urlsOf(calls, CONVERSATIONS_URL)).toEqual([`${CONVERSATIONS_URL}?status=active&limit=20`]);
    expect(urlsOf(calls, '/api/docs/chat/history')).toEqual(['/api/docs/chat/history?conversationId=a']);
    expect(result.current.dialogCapabilities).toMatchObject({ canRename: true, canArchive: true, searchQuery: '' });
    expect(result.current.dialogCapabilities?.fetchArchivedDialogs).toBeTypeOf('function');
    expect(result.current.dialogCapabilities?.unarchiveDialog).toBeTypeOf('function');
  });

  it('selectDialog switches the thread: reset, hydrate the new id, persist it', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'a' }));
    const { calls } = mockFetch({ list: () => listPayload(['a', 'b']) });
    const { result } = renderHook(() => useSseChatAdapter(), { wrapper: makeWrapper(managedRuntime) });
    await waitFor(() => expect(result.current.messages.length).toBe(2));

    act(() => result.current.selectDialog('b'));
    expect(result.current.activeDialogId).toBe('b');
    expect(JSON.parse(window.localStorage.getItem(CONVERSATION_KEY) ?? '{}')).toEqual({ conversationId: 'b' });
    await waitFor(() => expect(result.current.messages.map(m => m.content)).toEqual(['q for b', 'a for b']));
    expect(result.current.isMessagesLoading).toBe(false);
    expect(urlsOf(calls, '/api/docs/chat/history')).toEqual([
      '/api/docs/chat/history?conversationId=a',
      '/api/docs/chat/history?conversationId=b',
    ]);

    // Idempotent on the active id — no extra fetch.
    act(() => result.current.selectDialog('b'));
    expect(urlsOf(calls, '/api/docs/chat/history').length).toBe(2);
  });

  it('clearMessages drops to draft state (null id, storage cleared)', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'a' }));
    mockFetch({ list: () => listPayload(['a']) });
    const { result } = renderHook(() => useSseChatAdapter(), { wrapper: makeWrapper(managedRuntime) });
    await waitFor(() => expect(result.current.messages.length).toBe(2));
    act(() => result.current.clearMessages());
    expect(result.current.activeDialogId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(window.localStorage.getItem(CONVERSATION_KEY)).toBeNull();
  });

  it('first send: captures the minted id WITHOUT hydrating it, and re-reads the list at end of turn', async () => {
    let listed = 0;
    const { calls } = mockFetch({
      list: () => {
        listed += 1;
        return listed === 1 ? listPayload([]) : listPayload(['conv-new']);
      },
      streams: [wireTurn('conv-new', 'Hello there.')],
    });
    const { result } = renderHook(() => useSseChatAdapter(), { wrapper: makeWrapper(managedRuntime) });
    await waitFor(() => expect(listed).toBe(1));

    await act(async () => {
      await result.current.sendMessage('first question');
    });
    expect(result.current.activeDialogId).toBe('conv-new');
    expect(urlsOf(calls, '/api/docs/chat/history')).toEqual([]);
    await waitFor(() => expect(listed).toBe(2));
    expect(result.current.dialogs.map(d => d.id)).toEqual(['conv-new']);
    // The streamed turn is the thread — nothing was prepended by hydration.
    expect(result.current.messages.map(m => m.role)).toEqual(['user', 'assistant']);
  });

  it('rename / archive / restore hit the PATCH wire; archiving the open chat drops to draft', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'a' }));
    const { calls } = mockFetch({ list: () => listPayload(['a', 'b']) });
    const { result } = renderHook(() => useSseChatAdapter(), { wrapper: makeWrapper(managedRuntime) });
    await waitFor(() => expect(result.current.dialogs.length).toBe(2));

    await act(async () => {
      await result.current.renameDialog('b', 'Renamed B');
    });
    expect(result.current.dialogs.find(d => d.id === 'b')?.title).toBe('Renamed B');

    await act(async () => {
      await result.current.archiveDialog('a');
    });
    expect(result.current.dialogs.map(d => d.id)).toEqual(['b']);
    expect(result.current.activeDialogId).toBeNull();

    await act(async () => {
      await result.current.dialogCapabilities?.unarchiveDialog?.('a');
    });

    const patches = calls.filter(c => c.url.startsWith(CONVERSATIONS_URL + '/'));
    const parseBody = (c: Call): unknown => JSON.parse(String(c.init.body));
    expect(patches.map(c => [c.url, c.init.method, parseBody(c)])).toEqual([
      [`${CONVERSATIONS_URL}/b`, 'PATCH', { title: 'Renamed B' }],
      [`${CONVERSATIONS_URL}/a`, 'PATCH', { archived: true }],
      [`${CONVERSATIONS_URL}/a`, 'PATCH', { archived: false }],
    ]);
    // Restore re-reads the active list.
    expect(urlsOf(calls, `${CONVERSATIONS_URL}?`).length).toBeGreaterThanOrEqual(2);
  });

  it('search term change re-reads page 1 with `search`', async () => {
    const { calls } = mockFetch({ list: () => listPayload(['a']) });
    const { result } = renderHook(() => useSseChatAdapter(), { wrapper: makeWrapper(managedRuntime) });
    await waitFor(() => expect(result.current.dialogs.length).toBe(1));
    act(() => result.current.dialogCapabilities?.onSearchChange?.('print'));
    await waitFor(() =>
      expect(urlsOf(calls, `${CONVERSATIONS_URL}?`)).toEqual([
        `${CONVERSATIONS_URL}?status=active&limit=20`,
        `${CONVERSATIONS_URL}?status=active&limit=20&search=print`,
      ]),
    );
    expect(result.current.dialogCapabilities?.searchQuery).toBe('print');
  });

  it('ZERO-REGRESSION: without chatConversationsUrl the single-thread stubs are returned', async () => {
    window.localStorage.setItem(CONVERSATION_KEY, JSON.stringify({ conversationId: 'a' }));
    const { calls } = mockFetch({});
    const { result } = renderHook(() => useSseChatAdapter(), { wrapper: makeWrapper(plainRuntime) });
    await waitFor(() => expect(result.current.messages.length).toBe(2));
    expect(result.current.dialogs).toEqual([]);
    expect(result.current.dialogsManaged).toBe(false);
    expect(result.current.dialogCapabilities).toBeUndefined();
    expect(result.current.activeDialogId).toBeNull();
    expect(urlsOf(calls, CONVERSATIONS_URL)).toEqual([]);
  });
});
