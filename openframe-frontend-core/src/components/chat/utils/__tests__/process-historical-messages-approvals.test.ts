/**
 * An approval is a part of its message on BOTH paths, carrying its tier. Whether THIS side answers that tier is a decision
 * of the page that draws it (`approvalDisplaysInline`), never of the path a card arrived on. The reducer and the history
 * processor used to disagree here by default, and a `['CLIENT']` default on history made pending ADMIN cards vanish on every
 * reload.
 */

import { describe, it, expect } from 'vitest';
import { approvalStatusOf, isToolPart, type ChatMessage } from '../../../../chat-protocol/chat-message';
import { createMingoDecoder } from '../../../../chat-protocol/message-decoder';
import { createChatStreamReducer } from '../../stream/chat-stream-reducer';
import type { HistoricalMessage } from '../../types';
import { approvalDisplaysInline } from '../approval-display';
import { processHistoricalMessages } from '../process-historical-messages';

const adminRequest = {
  type: 'APPROVAL_REQUEST',
  approvalRequestId: 'req-m1',
  approvalType: 'ADMIN',
  command: 'x',
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
        approval: { id: 'req-m1', descriptor: { approvalType: 'ADMIN' } },
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

describe('tool rows with no run id', () => {
  const user = (id: string, text: string): HistoricalMessage => ({
    id,
    createdAt: '2026-01-01T00:00:00Z',
    owner: { type: 'ADMIN' },
    messageData: [{ type: 'TEXT', text }],
  });
  const answer = (id: string, messageData: unknown[]): HistoricalMessage =>
    ({ id, createdAt: '2026-01-01T00:00:01Z', owner: { type: 'ASSISTANT' }, messageData }) as HistoricalMessage;
  const executing = (title: string) => ({
    type: 'EXECUTING_TOOL',
    integratedToolType: 'OPENFRAME',
    toolFunction: 'search',
    title,
  });
  const executed = (result: string) => ({
    type: 'EXECUTED_TOOL',
    integratedToolType: 'OPENFRAME',
    toolFunction: 'search',
    result,
    success: true,
  });
  const outputsOf = (messages: readonly ChatMessage[], id: string) =>
    messages
      .find(message => message.id === id)
      ?.parts.filter(isToolPart)
      .map(part => (part.state === 'output-available' ? part.output : part.state));

  it('each run keeps its own row across turns', () => {
    const { messages } = processHistoricalMessages([
      user('u1', 'first'),
      answer('a1', [executing('first search'), executed('first result'), { type: 'TEXT', text: 'one' }]),
      user('u2', 'second'),
      answer('a2', [executing('second search'), executed('second result'), { type: 'TEXT', text: 'two' }]),
    ]);
    expect(outputsOf(messages, 'a1')).toEqual(['first result']);
    expect(outputsOf(messages, 'a2')).toEqual(['second result']);
  });

  it('two runs in one turn are two rows, each with its own result', () => {
    const { messages } = processHistoricalMessages([
      user('u1', 'first'),
      answer('a1', [executing('A'), executing('B'), executed('ra'), executed('rb'), { type: 'TEXT', text: 'done' }]),
    ]);
    expect(outputsOf(messages, 'a1')).toEqual(['ra', 'rb']);
  });

  it('a run a turn left open stays in its turn: the next turn`s result is the next turn`s', () => {
    const { messages } = processHistoricalMessages([
      user('u1', 'first'),
      answer('a1', [{ type: 'TEXT', text: 'one' }, executing('cut off')]),
      user('u2', 'second'),
      answer('a2', [executing('second search'), executed('second result')]),
    ]);
    expect(outputsOf(messages, 'a1')).toEqual(['input-available']);
    expect(outputsOf(messages, 'a2')).toEqual(['second result']);
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
