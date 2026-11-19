import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MINGO_DIALOG_QUERY,
  MINGO_DIALOG_TOKEN_USAGE_SPLIT_QUERY,
  MINGO_RENAME_DIALOG_MUTATION,
} from '../../../../chat-protocol/mingo-graphql';
import { createMingoGraphqlDialogs, MingoGraphqlError, type MingoGraphqlPost } from '../mingo-graphql-history';

const node = {
  id: 'R2xvYmFs',
  dialogId: 'd1',
  title: null,
  status: 'ACTIVE',
  createdAt: '2026-11-04T10:00:00Z',
  lastActivityAt: '2026-11-04T11:00:00Z',
  owner: { type: 'ADMIN', userId: 'u1', user: { firstName: 'Ada', lastName: 'L', image: { imageUrl: '/a.png' } } },
  tokenUsage: [
    { chatType: 'ADMIN_AI_CHAT', inputTokensSize: 3, outputTokensSize: 4, totalTokensSize: 7, contextSize: 9 },
  ],
};

function backend(answer: unknown) {
  const post = vi.fn(() => Promise.resolve(answer)) as unknown as MingoGraphqlPost & ReturnType<typeof vi.fn>;
  const dialogs = createMingoGraphqlDialogs(post, {
    agentTypes: ['ADMIN'],
    statuses: ['ACTIVE'],
    chatType: 'ADMIN_AI_CHAT',
    imageUrlOf: image => `https://img${image.imageUrl}`,
  });
  return { post, dialogs };
}

describe('createMingoGraphqlDialogs', () => {
  it('pages the list on the server, by search and scope, newest activity first, and reads rows by their raw id', async () => {
    const { post, dialogs } = backend({
      dialogs: { edges: [{ cursor: 'c1', node }], pageInfo: { hasNextPage: true, endCursor: 'c1' } },
    });
    const page = await dialogs.fetchDialogs({ limit: 20, search: 'printer', scope: 'my' });
    expect(post).toHaveBeenCalledWith(expect.stringContaining('query GetDialogs'), {
      filter: { agentTypes: ['ADMIN'], statuses: ['ACTIVE'], scope: 'MY' },
      first: 20,
      after: null,
      search: 'printer',
      sort: { field: 'lastActivityAt', direction: 'DESC' },
    });
    expect(page.nextCursor).toBe('c1');
    expect(page.dialogs[0]).toMatchObject({
      id: 'd1',
      title: 'New Chat',
      archived: false,
      owner: { id: 'u1', name: 'Ada L', avatarUrl: 'https://img/a.png' },
    });
  });

  it("reads the open dialog's record with its chat's usage, and null for one that does not resolve", async () => {
    const found = backend({ dialog: node });
    const record = await found.dialogs.fetchDialog('d1');
    expect(found.post).toHaveBeenCalledWith(MINGO_DIALOG_QUERY, { id: 'd1' });
    expect(record?.tokenUsage).toEqual({
      chatType: 'ADMIN_AI_CHAT',
      inputTokensSize: 3,
      outputTokensSize: 4,
      totalTokensSize: 7,
      contextSize: 9,
    });
    expect(await backend({ dialog: null }).dialogs.fetchDialog('x')).toBeNull();
  });

  it("asks for each row's unread replies only for a list that marks them, never for the archive", async () => {
    const answer = { dialogs: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } } };
    const post = vi.fn(() => Promise.resolve(answer)) as unknown as MingoGraphqlPost & ReturnType<typeof vi.fn>;
    const marking = createMingoGraphqlDialogs(post, { agentTypes: ['ADMIN'], statuses: ['ACTIVE'], unread: true });
    await marking.fetchDialogs({ limit: 20 });
    expect(post).toHaveBeenLastCalledWith(expect.stringContaining('unreadMessageCount'), expect.anything());
    await marking.fetchArchivedDialogs({ limit: 20 });
    expect(post).toHaveBeenLastCalledWith(expect.not.stringContaining('unreadMessageCount'), expect.anything());

    const plain = backend(answer);
    await plain.dialogs.fetchDialogs({ limit: 20 });
    expect(plain.post).toHaveBeenLastCalledWith(expect.not.stringContaining('unreadMessageCount'), expect.anything());
  });

  it("the open dialog's record carries its viewer's unread replies", () => {
    expect(MINGO_DIALOG_QUERY).toContain('unreadMessageCount');
  });

  it("a mutation that refuses says why, in the API's words", async () => {
    const { post, dialogs } = backend({ renameDialog: { userErrors: [{ message: 'Title too long' }] } });
    await expect(dialogs.renameDialog('d1', 'x'.repeat(500))).rejects.toThrow('Title too long');
    expect(post).toHaveBeenCalledWith(MINGO_RENAME_DIALOG_MUTATION, { input: { id: 'd1', title: 'x'.repeat(500) } });
  });

  describe('token usage split', () => {
    const split = {
      dialog: {
        id: 'R2xvYmFs',
        tokenUsage: [
          {
            chatType: 'ADMIN_AI_CHAT',
            uncachedInputTokensSize: 1,
            cacheReadTokensSize: 2,
            cacheWriteTokensSize: 0,
            compactionThreshold: 0.8,
          },
        ],
      },
    };
    const splitBackend = (answerSplit: () => Promise<unknown>) => {
      const post = vi.fn((query: string) =>
        query === MINGO_DIALOG_TOKEN_USAGE_SPLIT_QUERY ? answerSplit() : Promise.resolve({ dialog: node }),
      ) as unknown as MingoGraphqlPost & ReturnType<typeof vi.fn>;
      const dialogs = createMingoGraphqlDialogs(post, {
        agentTypes: ['ADMIN'],
        statuses: ['ACTIVE'],
        chatType: 'ADMIN_AI_CHAT',
        tokenUsageSplit: true,
      });
      return { post, dialogs };
    };

    it('merges the split into the record usage when the backend answers it', async () => {
      const { dialogs } = splitBackend(() => Promise.resolve(split));
      const record = await dialogs.fetchDialog('d1');
      expect(record?.tokenUsage).toEqual({
        chatType: 'ADMIN_AI_CHAT',
        inputTokensSize: 3,
        outputTokensSize: 4,
        totalTokensSize: 7,
        contextSize: 9,
        uncachedInputTokensSize: 1,
        cacheReadTokensSize: 2,
        cacheWriteTokensSize: 0,
        compactionThreshold: 0.8,
      });
    });

    const withoutSplit = {
      chatType: 'ADMIN_AI_CHAT',
      inputTokensSize: 3,
      outputTokensSize: 4,
      totalTokensSize: 7,
      contextSize: 9,
    };
    const splitCalls = (post: ReturnType<typeof vi.fn>) =>
      post.mock.calls.filter(([query]) => query === MINGO_DIALOG_TOKEN_USAGE_SPLIT_QUERY).length;
    const refusal = () =>
      new MingoGraphqlError("Validation error: Field 'cacheReadTokensSize' is undefined", { refused: true });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('opens the record without the split when the backend refuses it, and asks again only after half an hour', async () => {
      vi.useFakeTimers();
      const { post, dialogs } = splitBackend(() => Promise.reject(refusal()));
      const first = await dialogs.fetchDialog('d1');
      expect(first?.tokenUsage).toEqual(withoutSplit);
      vi.advanceTimersByTime(30 * 60_000 - 1);
      await dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(1);
      vi.advanceTimersByTime(1);
      await dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(2);
    });

    it("knows a refusal by its shape: a host's own copy of the lib throws its own class", async () => {
      const { post, dialogs } = splitBackend(() =>
        Promise.reject(Object.assign(new Error('refused'), { refused: true })),
      );
      await dialogs.fetchDialog('d1');
      await dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(1);
    });

    it.each([
      ['a 503', () => new Error('Request failed with status 503')],
      ['a network error', () => new TypeError('Failed to fetch')],
      ['an error the host did not call a refusal', () => new MingoGraphqlError('Internal error', { refused: false })],
    ])('asks again on the next read after %s, and merges the split once it answers', async (_, failure) => {
      let fail = true;
      const { post, dialogs } = splitBackend(() => (fail ? Promise.reject(failure()) : Promise.resolve(split)));
      expect((await dialogs.fetchDialog('d1'))?.tokenUsage).toEqual(withoutSplit);
      fail = false;
      const second = await dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(2);
      expect(second?.tokenUsage?.cacheReadTokensSize).toBe(2);
    });

    it("a host's retry after a rollover's 502 asks for the split again", async () => {
      let rolling = true;
      const post = vi.fn((query: string) => {
        if (rolling) return Promise.reject(new Error('Request failed with status 502'));
        return query === MINGO_DIALOG_TOKEN_USAGE_SPLIT_QUERY
          ? Promise.resolve(split)
          : Promise.resolve({ dialog: node });
      }) as unknown as MingoGraphqlPost & ReturnType<typeof vi.fn>;
      const dialogs = createMingoGraphqlDialogs(post, {
        agentTypes: ['ADMIN'],
        statuses: ['ACTIVE'],
        chatType: 'ADMIN_AI_CHAT',
        tokenUsageSplit: true,
      });
      await expect(dialogs.fetchDialog('d1')).rejects.toThrow('502');
      rolling = false;
      const retried = await dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(2);
      expect(retried?.tokenUsage?.cacheReadTokensSize).toBe(2);
    });

    it('opens the record without a split that is slow to answer, and leaves it out for a minute', async () => {
      vi.useFakeTimers();
      const { post, dialogs } = splitBackend(() => new Promise(() => {}));
      const opening = dialogs.fetchDialog('d1');
      await vi.advanceTimersByTimeAsync(4_000);
      expect((await opening)?.tokenUsage).toEqual(withoutSplit);
      vi.advanceTimersByTime(60_000 - 1);
      await dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(1);
      vi.advanceTimersByTime(1);
      void dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(2);
    });

    it('waits for a split that answers within the few seconds', async () => {
      vi.useFakeTimers();
      const { dialogs } = splitBackend(
        () =>
          new Promise(resolve => {
            setTimeout(() => resolve(split), 3_999);
          }),
      );
      const opening = dialogs.fetchDialog('d1');
      await vi.advanceTimersByTimeAsync(3_999);
      expect((await opening)?.tokenUsage?.cacheReadTokensSize).toBe(2);
    });

    it("a read still in flight that times out never shortens a refusal's pause", async () => {
      vi.useFakeTimers();
      let answer: () => Promise<unknown> = () => new Promise(() => {});
      const { post, dialogs } = splitBackend(() => answer());
      const slow = dialogs.fetchDialog('d1');
      answer = () => Promise.reject(refusal());
      await dialogs.fetchDialog('d2');
      await vi.advanceTimersByTimeAsync(4_000);
      await slow;
      vi.advanceTimersByTime(60_000);
      await dialogs.fetchDialog('d1');
      expect(splitCalls(post)).toBe(2);
    });

    it('does not ask for the split unless the host turns it on', async () => {
      const { post, dialogs } = backend({ dialog: node });
      await dialogs.fetchDialog('d1');
      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith(MINGO_DIALOG_QUERY, { id: 'd1' });
    });
  });
});
