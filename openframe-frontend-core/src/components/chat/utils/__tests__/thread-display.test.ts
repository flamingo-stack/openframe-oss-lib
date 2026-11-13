/**
 * The thread as every web chat draws it, and the gates it asks about. Moved here from the two copies the apps had (the
 * OpenFrame web app's `chat-history.ts`, the Fae client's `chatThread.ts`): these cases are both of theirs.
 */

import { describe, expect, it } from 'vitest';
import type { ChatMessage, ChatPart, ChatToolPart } from '../../../../chat-protocol/chat-message';
import { isCompactingTail } from '../extract-incomplete-message-state';
import {
  awaitsDecision,
  awaitsOtherTier,
  findLatestPendingId,
  isForeignReply,
  pendingApprovalIdOf,
  pendingOfferIdOf,
  threadForDisplay,
  withThreadAuthor,
} from '../thread-display';

const ASSISTANT = { name: 'Fae', avatar: 'fae.png' };
const NAMES = { own: 'You', other: 'Technician' };

const asked = (id: string, approvalType = 'CLIENT', batchId?: string): ChatToolPart => ({
  type: 'dynamic-tool',
  toolName: 'command',
  toolCallId: id,
  state: 'approval-requested',
  input: {},
  approval: { id, descriptor: { approvalType, ...(batchId !== undefined ? { batchId } : {}) } },
});

const answered = (id: string): ChatToolPart => ({
  type: 'dynamic-tool',
  toolName: 'command',
  toolCallId: id,
  state: 'approval-responded',
  input: {},
  approval: { id, approved: true, descriptor: { approvalType: 'CLIENT' } },
});

const offer = (status: 'pending' | 'approved'): ChatPart => ({
  type: 'data-escalation-offer',
  id: 'o1',
  data: { text: 'Talk to a technician?', status },
});

const holding = (id: string, ...parts: ChatPart[]): ChatMessage => ({ id, role: 'assistant', parts });
const userRow = (id: string): ChatMessage => ({ id, role: 'user', parts: [{ type: 'text', text: id }] });

describe('the pending gates', () => {
  it('finds the newest pending card by the id it is answered by, a batch by the batch', () => {
    const thread = [
      holding('a1', asked('r1')),
      holding('a2', asked('x1', 'CLIENT', 'b1'), asked('x2', 'CLIENT', 'b1')),
    ];
    expect(findLatestPendingId(thread, pendingApprovalIdOf)).toBe('b1');
    expect(findLatestPendingId([holding('a1', answered('r1'))], pendingApprovalIdOf)).toBeUndefined();
  });

  it('finds an offer while it is pending, apart from the approvals', () => {
    expect(findLatestPendingId([holding('a1', offer('pending'))], pendingOfferIdOf)).toBe('o1');
    expect(findLatestPendingId([holding('a1', offer('approved'))], pendingOfferIdOf)).toBeUndefined();
    expect(findLatestPendingId([holding('a1', offer('pending'))], pendingApprovalIdOf)).toBeUndefined();
  });

  it('a card nobody has answered waits on the user; answered or plain text does not', () => {
    expect(awaitsDecision([holding('a', asked('r'))])).toBe(true);
    expect(awaitsDecision([holding('a', answered('r'))])).toBe(false);
    expect(awaitsDecision([userRow('u')])).toBe(false);
  });

  it('a card of a tier this thread does not draw waits on someone else', () => {
    expect(awaitsDecision([holding('a', asked('r', 'ADMIN'))], ['CLIENT'])).toBe(false);
    expect(awaitsDecision([holding('a', asked('r', 'ADMIN'))], ['CLIENT', 'ADMIN'])).toBe(true);
    expect(awaitsOtherTier([holding('a', asked('r', 'USER'))], ['CLIENT'])).toBe(true);
    expect(awaitsOtherTier([holding('a', asked('r', 'CLIENT'))], ['CLIENT'])).toBe(false);
  });

  it('a pending escalation offer waits on the user', () => {
    expect(awaitsDecision([holding('a', offer('pending'))])).toBe(true);
    expect(awaitsDecision([holding('a', offer('approved'))])).toBe(false);
  });
});

describe('what a view draws', () => {
  it('an id-bearing block once across bubbles, and no assistant bubble left holding nothing', () => {
    const drawn = threadForDisplay([
      holding('h1', asked('r1')),
      holding('live', asked('r1')),
      holding('placeholder'),
      { id: 'u1', role: 'user', parts: [] },
    ]);
    expect(drawn.map(message => message.id)).toEqual(['h1', 'u1']);
  });

  it('shows the answered copy of a card, whichever bubble holds it: an answer lands on the newest copy only', () => {
    const drawn = threadForDisplay([
      holding('stale', asked('r1'), { type: 'text', text: 'Before.' }),
      holding('answered', answered('r1')),
    ]);
    expect(drawn.map(message => message.parts)).toEqual([[{ type: 'text', text: 'Before.' }], [answered('r1')]]);
  });

  it('shows the answered copy of an offer, whichever bubble holds it', () => {
    const drawn = threadForDisplay([holding('stale', offer('pending')), holding('answered', offer('approved'))]);
    expect(drawn.map(message => message.id)).toEqual(['answered']);
  });

  it('a batch is one card: its rows stay together in the bubble that holds it, and leave the copy', () => {
    const free: ChatToolPart = {
      type: 'dynamic-tool',
      toolName: 'status',
      toolCallId: 'free',
      state: 'input-available',
      input: {},
      toolMetadata: { batchId: 'batch-1' },
    };
    const rows = [asked('a', 'CLIENT', 'batch-1'), asked('b', 'CLIENT', 'batch-1'), free];
    const drawn = threadForDisplay([
      holding('first', ...rows),
      holding('copy', ...rows, { type: 'text', text: 'Waiting.' }),
    ]);
    expect(drawn[0].parts).toEqual(rows);
    expect(drawn[1].parts).toEqual([{ type: 'text', text: 'Waiting.' }]);
  });

  it('a copy the view filters out does not hide the one it keeps', () => {
    const drawn = threadForDisplay(
      [holding('kept', offer('pending')), holding('filtered', offer('approved'), { type: 'text', text: 'After.' })],
      part => !(part.type === 'data-escalation-offer' && part.data.status === 'approved'),
    );
    expect(drawn.map(message => message.parts)).toEqual([[offer('pending')], [{ type: 'text', text: 'After.' }]]);
  });

  it('hands back the same message when it changes nothing, for the memo downstream', () => {
    const message = holding('a1', { type: 'text', text: 'Hi' });
    expect(threadForDisplay([message])[0]).toBe(message);
  });
});

describe('who wrote a row', () => {
  it('names what the reducer wrote no author on, and leaves a row that names its own', () => {
    const technician: ChatMessage = {
      id: 't',
      role: 'user',
      metadata: { author: { name: 'Ann', authorType: 'admin' } },
      parts: [],
    };
    const system: ChatMessage = { id: 's', role: 'system', parts: [] };

    expect(withThreadAuthor(holding('a'), ASSISTANT, NAMES).metadata?.author).toEqual({
      name: 'Fae',
      avatar: 'fae.png',
    });
    expect(withThreadAuthor({ id: 'u', role: 'user', parts: [] }, ASSISTANT, NAMES).metadata?.author).toEqual({
      name: 'You',
    });
    expect(withThreadAuthor(technician, ASSISTANT, NAMES)).toBe(technician);
    expect(withThreadAuthor(system, ASSISTANT, NAMES)).toBe(system);
  });

  it('another person with no name is named as one, never as the viewer', () => {
    const unnamed: ChatMessage = { id: 't', role: 'user', metadata: { author: { authorType: 'admin' } }, parts: [] };
    expect(withThreadAuthor(unnamed, ASSISTANT, NAMES).metadata?.author).toEqual({
      name: 'Technician',
      authorType: 'admin',
    });
  });

  it('a failed send is no reply, so it cannot re-arm an unread counter', () => {
    expect(isForeignReply(holding('e', { type: 'data-error', data: { title: 'No' } }))).toBe(false);
    expect(isForeignReply(holding('p'))).toBe(false);
    expect(isForeignReply(userRow('u'))).toBe(false);
    expect(isForeignReply(holding('a', { type: 'text', text: 'Hi' }))).toBe(true);
  });
});

describe('isCompactingTail', () => {
  const compaction = (status: 'started' | 'completed'): ChatMessage =>
    holding('a', { type: 'data-context-compaction', data: { status } });

  it('is true only while the thread ends on a compaction still running', () => {
    expect(isCompactingTail([compaction('started')])).toBe(true);
    expect(isCompactingTail([compaction('completed')])).toBe(false);
    expect(isCompactingTail([compaction('started'), userRow('u')])).toBe(false);
    expect(isCompactingTail([])).toBe(false);
    expect(isCompactingTail(undefined)).toBe(false);
  });
});
