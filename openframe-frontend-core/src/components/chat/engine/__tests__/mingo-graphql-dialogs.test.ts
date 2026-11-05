import { describe, expect, it, vi } from 'vitest';
import { MINGO_DIALOG_QUERY, MINGO_RENAME_DIALOG_MUTATION } from '../../../../chat-protocol/mingo-graphql';
import { createMingoGraphqlDialogs, type MingoGraphqlPost } from '../mingo-graphql-history';

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

  it("a mutation that refuses says why, in the API's words", async () => {
    const { post, dialogs } = backend({ renameDialog: { userErrors: [{ message: 'Title too long' }] } });
    await expect(dialogs.renameDialog('d1', 'x'.repeat(500))).rejects.toThrow('Title too long');
    expect(post).toHaveBeenCalledWith(MINGO_RENAME_DIALOG_MUTATION, { input: { id: 'd1', title: 'x'.repeat(500) } });
  });
});
