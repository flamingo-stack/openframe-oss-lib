/**
 * GOLDEN CONTRACT TESTS — the `chatConversationsUrl` wire client. Pins the
 * exact URLs, query strings and PATCH bodies the hub route serves, the
 * `{ data }` envelope unwrap, the ISO→Date mapping, and the server-copy
 * error surfacing.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { createChatConversationsApi } from '../chat-conversations-api';

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as unknown as Response;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createChatConversationsApi', () => {
  it('GET builds the query string, unwraps the envelope, maps timestamps to Date', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          data: {
            dialogs: [
              { id: 'a', title: 'Alpha', timestamp: '2026-09-06T10:00:00.000Z' },
              { id: 'b', title: '', timestamp: 'not-a-date' },
              { nope: true },
            ],
            nextCursor: 'c1',
          },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const api = createChatConversationsApi('/api/docs/chat/conversations/');

    const result = await api.fetchDialogs({ status: 'active', limit: 20, cursor: 'c0', search: 'al pha' });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/docs/chat/conversations?status=active&limit=20&cursor=c0&search=al+pha');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('same-origin');
    expect(result.nextCursor).toBe('c1');
    expect(result.dialogs).toEqual([
      { id: 'a', title: 'Alpha', timestamp: new Date('2026-09-06T10:00:00.000Z') },
      { id: 'b', title: 'Untitled chat' },
    ]);
  });

  it('GET omits empty optional params', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ data: { dialogs: [], nextCursor: null } })));
    vi.stubGlobal('fetch', fetchMock);
    const api = createChatConversationsApi('/api/docs/chat/conversations');
    await api.fetchDialogs({ status: 'archived', search: '' });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('/api/docs/chat/conversations?status=archived');
  });

  it('PATCH bodies: rename / archive / restore', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ data: { id: 'x' } })));
    vi.stubGlobal('fetch', fetchMock);
    const api = createChatConversationsApi('/api/docs/chat/conversations');
    await api.renameDialog('id/with slash', 'New title');
    await api.archiveDialog('x');
    await api.unarchiveDialog('x');
    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls[0][0]).toBe('/api/docs/chat/conversations/id%2Fwith%20slash');
    expect(calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(String(calls[0][1].body))).toEqual({ title: 'New title' });
    expect(JSON.parse(String(calls[1][1].body))).toEqual({ archived: true });
    expect(JSON.parse(String(calls[2][1].body))).toEqual({ archived: false });
  });

  it('surfaces the server error copy from the route-base envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'Conversation not found', code: 'NOT_FOUND' }, 404))),
    );
    const api = createChatConversationsApi('/api/docs/chat/conversations');
    await expect(api.renameDialog('x', 'y')).rejects.toThrow('Conversation not found');
  });

  it('falls back to a status line when the error body is not the envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse('<html/>', 502))),
    );
    const api = createChatConversationsApi('/api/docs/chat/conversations');
    await expect(api.fetchDialogs({ status: 'active' })).rejects.toThrow('Conversation list failed: 502');
  });
});
