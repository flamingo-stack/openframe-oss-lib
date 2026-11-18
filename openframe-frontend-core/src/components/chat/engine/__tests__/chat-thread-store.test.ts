/**
 * `createChatThreadStore`, the one thread store every NATS chat keeps its threads in. Moved here with the OpenFrame web
 * app's mirror (`chat-stream-thread.ts`), whose cases these are: the history hydration seam, adopt-once, eviction that
 * loses nothing, the busy phase after a reload, and a key's decoder.
 */

import { describe, expect, it } from 'vitest';
import {
  approvalStatusOf,
  isToolPart,
  textOfParts,
  type ChatMessage,
  type ChatToolPart,
} from '../../../../chat-protocol/chat-message';
import type { ChatStreamEntry } from '../../../../chat-protocol/ui-chunks';
import { createChatDialogStore } from '../../stream/chat-dialog-store';
import { mergeHistoryWithRealtime } from '../../utils/history-merge';
import { processHistoricalMessages } from '../../utils/process-historical-messages';
import { createChatThreadStore, type ChatThreadSnapshot } from '../chat-thread-store';

const userRow = (id: string, text: string): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text }] });

const finishedThread = (): ChatMessage[] => [
  userRow('u1', 'Run a health check across my endpoints.'),
  { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: "I'll kick this off in parallel." }] },
];

/** The trailing turn left UNFINISHED: a tool that started with no result, the state a reload catches. */
const unfinishedThread = (): ChatMessage[] => [
  userRow('u1', 'Run a health check across my endpoints.'),
  {
    id: 'a1',
    role: 'assistant',
    parts: [
      { type: 'text', text: "I'll kick this off in parallel." },
      {
        type: 'dynamic-tool',
        toolName: 'search_machines',
        toolCallId: 'req-1',
        toolMetadata: { integratedToolType: 'openframe' },
        state: 'input-available',
        input: {},
      },
    ],
  },
];

/** Blocked on the USER instead: a pending approval at the tail. Unfinished, but nothing is executing. */
const pendingApprovalThread = (): ChatMessage[] => [
  userRow('u1', 'run it'),
  {
    id: 'a1',
    role: 'assistant',
    parts: [
      { type: 'text', text: 'This needs your go-ahead.' },
      {
        type: 'dynamic-tool',
        toolName: 'command',
        toolCallId: 'req-9',
        title: 'rm -rf /tmp/cache',
        state: 'approval-requested',
        input: {},
        approval: { id: 'req-9', descriptor: { approvalType: 'CLIENT', batchId: 'req-9' } },
      },
    ],
  },
];

const start: ChatStreamEntry = { chunks: [{ type: 'start', messageId: 'stream-1' }] };
const delta = (text: string): ChatStreamEntry => ({ chunks: [{ type: 'text-delta', id: 't1', delta: text }] });
const textOf = (message: ChatMessage | undefined): string => (message ? textOfParts(message.parts) : '');
/** The `n`th row from the end (1 = the last). */
const fromEnd = (messages: readonly ChatMessage[] | undefined, n = 1): ChatMessage | undefined =>
  messages?.[messages.length - n];

function setup(maxReducers?: number) {
  const snapshots = new Map<string, ChatThreadSnapshot>();
  const store = createChatThreadStore<string>({
    ...(maxReducers !== undefined
      ? { createStore: storeOptions => createChatDialogStore({ ...storeOptions, maxReducers }) }
      : {}),
    onSnapshot: (key, snapshot) => {
      snapshots.set(key, snapshot);
    },
  });
  /** The thread as a host reads it: what the batcher holds lands first. */
  const thread = (key: string): ChatMessage[] => {
    store.flush();
    return store.snapshotOf(key).messages;
  };
  return { store, snapshots, thread };
}

describe('history hydration', () => {
  it('APPENDS a delta that arrives with no preceding start: the persisted head of the turn survives', () => {
    const { store, thread } = setup();
    store.hydrate('d', finishedThread());
    store.bind('d').apply(delta(' Two endpoints online.'));

    const messages = thread('d');
    expect(textOf(fromEnd(messages, 1))).toContain("I'll kick this off in parallel.");
    expect(textOf(fromEnd(messages, 1))).toContain('Two endpoints online.');
    expect(messages[0]?.id).toBe('u1');
  });

  it('keeps untouched messages referentially stable across an apply', () => {
    const { store, thread } = setup();
    store.hydrate('d', finishedThread());
    const before = thread('d');
    store.bind('d').apply(delta(' more'));
    expect(thread('d')[0]).toBe(before[0]);
  });

  it('a snapshot is one object until the thread changes, and tells its subscribers when it does', () => {
    const { store } = setup();
    let told = 0;
    const unsubscribe = store.subscribe(() => {
      told += 1;
    });
    store.hydrate('d', finishedThread());
    const first = store.snapshotOf('d');
    expect(store.snapshotOf('d')).toBe(first);
    expect(told).toBeGreaterThan(0);
    unsubscribe();
  });
});

describe('adopt-once', () => {
  it('lets a REPLAYED start re-stream into the unfinished bubble', () => {
    const { store, thread } = setup();
    store.hydrate('d', unfinishedThread());
    const count = thread('d').length;
    store.bind('d').apply(start);
    expect(thread('d')).toHaveLength(count);
    expect(textOf(fromEnd(thread('d'), 1))).toContain("I'll kick this off in parallel.");
  });

  it('disarms on the first entry that is not a start: a later genuine turn opens its own bubble', () => {
    const { store, thread } = setup();
    store.hydrate('d', unfinishedThread());
    const count = thread('d').length;
    store.bind('d').apply(delta(' continuing.'));
    store.bind('d').apply(start);
    expect(thread('d')).toHaveLength(count + 1);
    expect(textOf(fromEnd(thread('d'), 1))).toBe('');
  });

  it('disarms when the user resolves the approval the tail is waiting on', () => {
    const { store, thread } = setup();
    store.hydrate('d', pendingApprovalThread());
    const count = thread('d').length;
    store.updateApprovalStatus('d', 'req-9', 'approved');
    store.bind('d').apply(start);
    expect(thread('d')).toHaveLength(count + 1);
    expect(textOf(fromEnd(thread('d'), 2))).toContain('This needs your go-ahead.');
  });

  it('a hydration that expects no replay arms nothing', () => {
    const { store, thread } = setup();
    store.hydrate('d', unfinishedThread(), { expectingReplay: false });
    const count = thread('d').length;
    store.bind('d').apply(start);
    expect(thread('d')).toHaveLength(count + 1);
  });
});

describe('hydration while a turn is open', () => {
  it('leaves a streaming turn its bubble: the next delta extends the live bubble only', () => {
    const { store, thread } = setup();
    store.hydrate('d', finishedThread());
    const bound = store.bind('d');
    for (const chunk of [
      { type: 'MESSAGE_START', streamSeq: 1 },
      { type: 'TEXT', text: 'Live answer.', streamSeq: 2 },
      {
        type: 'EXECUTING_TOOL',
        integratedToolType: 'OPENFRAME',
        toolFunction: 'run_script',
        toolExecutionRequestId: 'req-live',
        streamSeq: 3,
      },
    ]) {
      bound.apply(bound.decode(chunk));
    }

    store.hydrate('d', thread('d'));
    bound.apply(bound.decode({ type: 'TEXT', text: ' More.', streamSeq: 4 }));

    const messages = thread('d');
    expect(textOf(fromEnd(messages, 1))).not.toContain("I'll kick this off in parallel.");
    expect(textOf(fromEnd(messages, 1))).toContain(' More.');
    expect(textOf(fromEnd(messages, 2))).toBe("I'll kick this off in parallel.");
  });

  it('still seeds and arms a second hydrate of an agent-busy tail with no turn open', () => {
    const { store, thread } = setup();
    store.hydrate('d', unfinishedThread());
    store.hydrate('d', unfinishedThread());
    const count = thread('d').length;
    store.bind('d').apply(start);
    expect(thread('d')).toHaveLength(count);
  });
});

describe('LRU eviction', () => {
  it('parks and restores a thread when the dialog store drops its reducer, and moves the epoch', () => {
    const { store, snapshots } = setup(1);
    store.hydrate('a', finishedThread());
    store.setActiveKeys(['a']);
    store.setActiveKeys([]);
    const epochBefore = store.bind('a').evictionEpoch;

    store.hydrate('b', [userRow('u2', 'unrelated')]);
    store.mutate('a', () => undefined);

    const restored = snapshots.get('a');
    expect(restored?.messages).toHaveLength(2);
    expect(textOf(fromEnd(restored?.messages, 1))).toContain("I'll kick this off in parallel.");
    expect(store.bind('a').evictionEpoch).toBeGreaterThan(epochBefore);
  });

  it('parks the sequence with the thread: a redelivery stays dropped', () => {
    const { store } = setup(1);
    const seed = (key: string) => {
      const bound = store.bind(key);
      bound.apply(bound.decode({ type: 'MESSAGE_START', streamSeq: 1 }));
      bound.apply(bound.decode({ type: 'MESSAGE_END', streamSeq: 2 }));
    };
    seed('a');
    store.setActiveKeys(['a']);
    store.setActiveKeys([]);
    seed('b');
    expect(store.bind('a').decode({ type: 'MESSAGE_END', streamSeq: 2 }).chunks).toEqual([]);
  });
});

describe('the busy phase after hydration', () => {
  it('is busy when a tool was left mid-flight', () => {
    const { store } = setup();
    store.hydrate('d', unfinishedThread());
    expect(store.snapshotOf('d').phase).toBe('thinking');
  });

  it('is busy for an APPROVED batch whose commands are still running', () => {
    const { store } = setup();
    const row = (toolCallId: string): ChatToolPart => ({
      type: 'dynamic-tool',
      toolName: 'run_script',
      toolCallId,
      state: 'approval-responded',
      input: {},
      approval: { id: toolCallId, approved: true, descriptor: { batchId: 'req-3' } },
    });
    store.hydrate('d', [
      userRow('u1', 'check the disks'),
      { id: 'a1', role: 'assistant', parts: [row('e1'), row('e2')] },
    ]);
    expect(store.snapshotOf('d').phase).not.toBe('idle');
  });

  it('stays idle when the turn merely waits on an approval', () => {
    const { store } = setup();
    store.hydrate('d', pendingApprovalThread());
    expect(store.snapshotOf('d').phase).toBe('idle');
  });
});

describe('a key and its decoder', () => {
  it('decodes a whole turn into the one message it draws', () => {
    const { store, thread } = setup();
    const bound = store.bind('d');
    const chunks = [
      { type: 'MESSAGE_START' },
      { type: 'TEXT', text: 'Priced per ' },
      { type: 'TEXT', text: 'device.' },
      { type: 'RECORD_CARDS', records: ['record://blog_post/1108'] },
      { type: 'MESSAGE_END' },
    ];
    for (const [index, chunk] of chunks.entries()) bound.apply(bound.decode({ ...chunk, streamSeq: index + 1 }));

    const [message, ...rest] = thread('d');
    expect(rest).toEqual([]);
    expect(message.parts).toEqual([
      { type: 'text', text: 'Priced per device.', state: 'done' },
      { type: 'data-record-cards', data: { records: ['record://blog_post/1108'] } },
    ]);
  });

  it('flips a whole batch when the user answers it by the request id the backend knows', () => {
    const { store, thread } = setup();
    const bound = store.bind('d');
    bound.apply(
      bound.decode({
        type: 'APPROVAL_REQUEST',
        approvalRequestId: 'ar-2',
        approvalType: 'ADMIN',
        streamSeq: 1,
        toolCalls: ['run-1', 'run-2'].map(toolExecutionRequestId => ({
          toolExecutionRequestId,
          toolName: 'run_script',
          requiresApproval: true,
        })),
      }),
    );
    store.updateApprovalStatus('d', 'ar-2', 'rejected');
    expect(
      thread('d')[0]
        .parts.filter(isToolPart)
        .map(part => part.state),
    ).toEqual(['output-denied', 'output-denied']);
  });

  it('answers a redelivery with nothing, and starts over when the key is dropped', () => {
    const { store } = setup();
    const before = store.bind('d');
    before.apply(before.decode({ type: 'TEXT', text: 'Hello', streamSeq: 7 }));
    expect(before.decode({ type: 'TEXT', text: 'Hello', streamSeq: 7 }).chunks).toEqual([]);

    store.drop('d');
    expect(store.bind('d').decode({ type: 'TEXT', text: 'Again', streamSeq: 7 }).chunks.length).toBeGreaterThan(0);
  });
});

describe('a send', () => {
  it("through the reducer's own rows: the bubble, its placeholder and the busy phase", () => {
    const { store, thread } = setup();
    store.pushOptimisticSend('d', 'Hello');
    expect(thread('d').map(message => message.role)).toEqual(['user', 'assistant']);
    expect(store.snapshotOf('d').phase).toBe('thinking');
  });

  it("with the host's bubble: only it is drawn, the phase stays the host's, and its echo draws no second row", () => {
    const { store, thread } = setup();
    const bubble: ChatMessage = { id: 'optimistic-1', role: 'user', parts: [{ type: 'text', text: 'Hi there' }] };
    store.pushOptimisticSend('d', 'Hi there', { message: bubble });
    expect(thread('d')).toEqual([bubble]);
    expect(store.snapshotOf('d').phase).toBe('idle');

    const bound = store.bind('d');
    bound.apply(bound.decode({ type: 'MESSAGE_REQUEST', text: 'Hi there', ownerType: 'CLIENT', streamSeq: 5 }));
    expect(thread('d').map(message => textOfParts(message.parts))).toEqual(['Hi there']);
  });
});

describe('a history merge landing while deltas wait in the batcher', () => {
  it('keeps the text the batcher held: parts only grow, so the next delta could never write it back', () => {
    const { store, thread } = setup();
    const userTurn = userRow('u1', 'go');
    store.hydrate('d', [userTurn]);
    const bound = store.bind('d');
    const feed = (raw: Record<string, unknown>) => bound.apply(bound.decode(raw));
    feed({ type: 'MESSAGE_START', streamSeq: 1 });
    feed({ type: 'TEXT', text: 'Hello ', streamSeq: 2 });
    thread('d');

    feed({ type: 'TEXT', text: 'big ', streamSeq: 3 });
    feed({ type: 'TEXT', text: 'world ', streamSeq: 4 });
    const live = thread('d');
    store.hydrate(
      'd',
      mergeHistoryWithRealtime({
        processedHistory: [userTurn],
        rawHistoryIds: new Set(['u1']),
        existingMessages: live,
        streamingMessageId: store.snapshotOf('d').streamingId,
        historyFetchedAt: Date.now(),
        historyMaxStreamSeq: 0,
        realtimeSeenStreamSeq: 0,
      }),
      { expectingReplay: false },
    );

    feed({ type: 'TEXT', text: 'and more', streamSeq: 5 });
    feed({ type: 'MESSAGE_END', streamSeq: 6 });
    expect(textOf(fromEnd(thread('d'), 1))).toBe('Hello big world and more');
  });
});

describe('a rejected batch, refetched after a gap', () => {
  it('stays rejected, and says who: the report on its row is no answer in the shared map', () => {
    const { store } = setup();
    const asking = {
      type: 'APPROVAL_REQUEST',
      approvalRequestId: 'req1',
      approvalType: 'CLIENT',
      toolCalls: [{ toolExecutionRequestId: 't1', toolName: 'run', toolTitle: 'Run ls', requiresApproval: true }],
    };
    const rejected = { type: 'APPROVAL_RESULT', approvalRequestId: 'req1', approved: false, displayName: 'Bob Admin' };
    const refused = {
      type: 'EXECUTED_TOOL',
      toolExecutionRequestId: 't1',
      integratedToolType: 'OPENFRAME',
      toolFunction: 'run',
      success: false,
      result: 'Rejected by user',
    };
    const bound = store.bind('d');
    for (const chunk of [{ type: 'MESSAGE_START' }, asking, rejected, refused]) bound.apply(bound.decode(chunk));
    store.flush();
    const { approvalStatuses } = store.snapshotOf('d').state;
    expect(approvalStatuses).toEqual({ req1: 'rejected' });

    const row = (id: string, parts: unknown[]) => ({
      id,
      dialogId: 'd1',
      chatType: 'CLIENT_CHAT',
      createdAt: '2026-11-02T10:00:00Z',
      owner: { type: 'ASSISTANT' },
      parts,
    });
    const { messages } = processHistoricalMessages(
      [row('a1', [asking]), row('a2', [rejected]), row('a3', [refused])] as never,
      { approvalStatuses },
    );
    const part = messages.flatMap(message => message.parts).find(isToolPart);
    expect(part?.state).toBe('output-denied');
    expect(part && approvalStatusOf(part)).toBe('rejected');
    expect(part?.toolMetadata?.resolvedByName).toBe('Bob Admin');
  });
});
