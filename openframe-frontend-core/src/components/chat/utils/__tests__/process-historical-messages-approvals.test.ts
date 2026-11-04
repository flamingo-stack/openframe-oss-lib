/**
 * An approval is a part of its message on BOTH paths, carrying its tier. Whether THIS side answers that tier is a decision
 * of the page that draws it (`approvalDisplaysInline`), never of the path a card arrived on. The reducer and the history
 * processor used to disagree here by default, and a `['CLIENT']` default on history made pending ADMIN cards vanish on every
 * reload.
 */

import { describe, it, expect } from 'vitest';
import {
  approvalAnswerInFlight,
  approvalStatusOf,
  isToolPart,
  type ChatMessage,
} from '../../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../../chat-protocol/message-decoder';
import { createChatStreamReducer } from '../../stream/chat-stream-reducer';
import type { ChatApprovalStatus, HistoricalMessage } from '../../types';
import { approvalDisplaysInline } from '../approval-display';
import { processHistoricalMessages } from '../process-historical-messages';

const adminRequest = {
  type: 'APPROVAL_REQUEST',
  approvalRequestId: 'req-m1',
  approvalType: 'ADMIN',
  toolCalls: [{ toolExecutionRequestId: 'req-m1', toolName: 'x', requiresApproval: true }],
} as const;

const adminApprovalMessage = (id: string): HistoricalMessage => ({
  id,
  createdAt: '2026-07-17T12:00:00Z',
  owner: { type: 'ASSISTANT' },
  messageData: [adminRequest],
});

const cardsOf = (messages: readonly ChatMessage[]) => messages.flatMap(message => message.parts).filter(isToolPart);

const live = () => {
  const reducer = createChatStreamReducer();
  const decoder = createMingoDecoder();
  reducer.apply(decoder.decode({ type: 'MESSAGE_START' }));
  reducer.apply(decoder.decode(adminRequest));
  return cardsOf(reducer.state.messages);
};

describe('an approval of a tier this side does not answer', () => {
  it('history and realtime hold the same card, with its tier', () => {
    const history = cardsOf(processHistoricalMessages([adminApprovalMessage('m1')]).messages);
    expect(history).toHaveLength(1);
    expect(live()).toHaveLength(1);
    for (const card of [history[0], live()[0]]) {
      expect(card).toMatchObject({
        toolCallId: 'req-m1',
        state: 'approval-requested',
        approval: { id: 'req-m1', descriptor: { approvalType: 'ADMIN', batchId: 'req-m1' } },
      });
    }
  });

  it('drawing it is the host list’s decision, on either path alike', () => {
    expect(approvalDisplaysInline('ADMIN', ['CLIENT'])).toBe(false);
    expect(approvalDisplaysInline('ADMIN', ['CLIENT', 'ADMIN'])).toBe(true);
  });

  it('a status known from elsewhere wins over what its row says', () => {
    const { messages } = processHistoricalMessages([adminApprovalMessage('m1')], {
      approvalStatuses: { 'req-m1': 'approved' },
    });
    expect(cardsOf(messages).map(approvalStatusOf)).toEqual(['approved']);
  });

  it('a row’s answer does not overrule a status known from elsewhere', () => {
    const { messages } = processHistoricalMessages(
      [
        {
          ...adminApprovalMessage('m1'),
          messageData: [adminRequest, { type: 'APPROVAL_RESULT', approvalRequestId: 'req-m1', approved: false }],
        },
      ],
      { approvalStatuses: { 'req-m1': 'approved' } },
    );
    expect(cardsOf(messages).map(approvalStatusOf)).toEqual(['approved']);
  });
});

describe('a turn’s identity', () => {
  it('does not bleed across a turn that drew nothing: the next turn has its own id and sequence', () => {
    // m1 is an assistant turn whose ONLY row is metadata → it draws nothing. Its grouping identity and sequence must be
    // cleared, or the NEXT assistant turn inherits m1's id and an inflated streamSeq (100 instead of 50), which would
    // over-cover synthetics in the history merge.
    const messages: HistoricalMessage[] = [
      {
        id: 'm1',
        createdAt: '2026-07-17T12:00:00Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 100,
        messageData: [{ type: 'ATTACHMENTS', sources: [] }],
      },
      {
        id: 'u1',
        createdAt: '2026-07-17T12:00:01Z',
        owner: { type: 'CLIENT' },
        messageData: [{ type: 'TEXT', text: 'hello' }],
      },
      {
        id: 'a2',
        createdAt: '2026-07-17T12:00:02Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 50,
        messageData: [{ type: 'TEXT', text: 'hi there' }],
      },
    ];
    const { messages: out } = processHistoricalMessages(messages);
    expect(out.map(message => message.id)).toEqual(['u1', 'a2']);
    expect(out[1].metadata?.streamSeq).toBe(50);
  });

  it('a card’s own turn keeps its own sequence', () => {
    const { messages } = processHistoricalMessages([
      { ...adminApprovalMessage('a1'), lastChunkStreamSeq: 100 },
      {
        id: 'u1',
        createdAt: '2026-07-17T12:00:01Z',
        owner: { type: 'CLIENT' },
        messageData: [{ type: 'TEXT', text: 'hello' }],
      },
      {
        id: 'a2',
        createdAt: '2026-07-17T12:00:02Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 50,
        messageData: [{ type: 'TEXT', text: 'hi there' }],
      },
    ]);
    expect(messages.map(message => [message.id, message.metadata?.streamSeq])).toEqual([
      ['a1', 100],
      ['u1', undefined],
      ['a2', 50],
    ]);
  });
});

describe('a rejected batch read back', () => {
  const asking = {
    type: 'APPROVAL_REQUEST',
    approvalRequestId: 'req1',
    approvalType: 'ADMIN',
    toolCalls: [
      { toolExecutionRequestId: 't1', toolName: 'run', toolTitle: 'Run ls', requiresApproval: true },
      { toolExecutionRequestId: 't2', toolName: 'read', toolTitle: 'Read a log', requiresApproval: false },
    ],
  };
  const rejected = { type: 'APPROVAL_RESULT', approvalRequestId: 'req1', approved: false, displayName: 'Bob Admin' };
  const refused = (id: string) => ({
    type: 'EXECUTED_TOOL',
    toolExecutionRequestId: id,
    integratedToolType: 'OPENFRAME',
    toolFunction: 'run',
    success: false,
    result: 'Rejected by user',
  });
  const row = (id: string, messageData: unknown[]): HistoricalMessage =>
    ({ id, createdAt: '2026-11-02T10:00:00Z', owner: { type: 'ASSISTANT' }, messageData }) as HistoricalMessage;
  const page = [row('a1', [asking]), row('a2', [rejected]), row('a3', [refused('t1'), refused('t2')])];

  it('reads as rejected whatever the map says about one of its rows', () => {
    const { messages } = processHistoricalMessages(page, {
      approvalStatuses: { req1: 'rejected', t1: 'approved', t2: 'approved' },
    });
    expect(cardsOf(messages).map(part => [part.toolCallId, part.state, approvalStatusOf(part)])).toEqual([
      ['t1', 'output-denied', 'rejected'],
      ['t2', 'output-denied', 'rejected'],
    ]);
  });

  it('keeps who answered when the status was already known', () => {
    const statuses: Array<Record<string, ChatApprovalStatus>> = [{}, { req1: 'rejected' }];
    for (const approvalStatuses of statuses) {
      const [gate] = cardsOf(processHistoricalMessages(page, { approvalStatuses }).messages);
      expect(gate.toolMetadata?.resolvedByName).toBe('Bob Admin');
      expect(approvalStatusOf(gate)).toBe('rejected');
    }
  });

  it('keeps who approved when the status was already known', () => {
    const approved = { ...rejected, approved: true, displayName: 'Ann Admin' };
    const { messages } = processHistoricalMessages([row('a1', [asking]), row('a2', [approved])], {
      approvalStatuses: { req1: 'approved' },
    });
    expect(cardsOf(messages)[0].toolMetadata?.resolvedByName).toBe('Ann Admin');
    expect(approvalStatusOf(cardsOf(messages)[0])).toBe('approved');
  });

  it('a reloaded row the tenant stored as approved stays Approved: nothing is on its way to it', () => {
    const approved = { ...rejected, approved: true };
    const { messages } = processHistoricalMessages([row('a1', [asking]), row('a2', [approved])]);
    const [gate] = cardsOf(messages);
    expect(gate.state).toBe('approval-responded');
    expect(approvalStatusOf(gate)).toBe('approved');
    expect(approvalAnswerInFlight(gate)).toBe(false);
  });

  it('nor a live one: its server answered, on the stream, and nothing here is waiting on that', () => {
    const reducer = createChatStreamReducer();
    const decoder = createMingoDecoder();
    for (const raw of [{ type: 'MESSAGE_START' }, asking, { ...rejected, approved: true }]) {
      reducer.apply(decoder.decode(raw));
    }
    const [gate] = cardsOf(reducer.state.messages);
    expect(gate.state).toBe('approval-responded');
    expect(approvalStatusOf(gate)).toBe('approved');
    expect(approvalAnswerInFlight(gate)).toBe(false);
  });

  it('denies the rows that ask nothing too, when only the map knows the answer', () => {
    const { messages } = processHistoricalMessages([row('a1', [asking])], { approvalStatuses: { req1: 'rejected' } });
    expect(cardsOf(messages).map(part => part.state)).toEqual(['output-denied', 'output-denied']);
  });

  it('a pending status says nothing: the row that answers stands', () => {
    const { messages } = processHistoricalMessages([row('a1', [asking]), row('a2', [rejected])], {
      approvalStatuses: { req1: 'pending' },
    });
    expect(cardsOf(messages).map(approvalStatusOf)).toEqual(['rejected', 'rejected']);
  });

  it('live then refetched, through the map the reducer leaves', () => {
    const reducer = createChatStreamReducer();
    const decoder = createMingoDecoder();
    for (const raw of [{ type: 'MESSAGE_START' }, asking, rejected, refused('t1'), refused('t2')]) {
      reducer.apply(decoder.decode(raw));
    }
    expect(reducer.state.approvalStatuses).toEqual({ req1: 'rejected' });
    const { messages } = processHistoricalMessages(page, { approvalStatuses: reducer.state.approvalStatuses });
    expect(cardsOf(messages).map(approvalStatusOf)).toEqual(['rejected', 'rejected']);
  });
});
