/**
 * The one OpenFrame chat history document, and the read of its answer.
 */

import { parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  historicalMessageOfNode,
  MINGO_MESSAGES_QUERY,
  mingoMessagesPage,
  mingoMessagesVariables,
} from '../mingo-graphql';

describe('the document', () => {
  it('parses, and selects the parts by their own name', () => {
    const document = parse(MINGO_MESSAGES_QUERY);
    expect(document.definitions).toHaveLength(1);
    expect(MINGO_MESSAGES_QUERY).toMatch(/\bparts \{/);
    expect(MINGO_MESSAGES_QUERY).not.toMatch(/\bmessageData\b/);
  });

  it('asks for one page newest first', () => {
    expect(mingoMessagesVariables({ dialogId: 'd', limit: 20 })).toEqual({
      dialogId: 'd',
      chatType: null,
      cursor: null,
      limit: 20,
      sortField: 'createdAt',
      sortDirection: 'DESC',
    });
  });
});

describe('the answer', () => {
  it('puts every aliased field back under the name the decoder reads, and drops an empty one', () => {
    const message = historicalMessageOfNode({
      id: 'm',
      createdAt: '2026-11-04T10:00:00Z',
      parts: [
        { type: 'ESCALATION_OFFER', offerId: 'o', state: 'PENDING', offerText: 'Hand off?' },
        { type: 'TICKET_ESCALATED', ticketId: 't', escalatedText: 'Escalated.' },
        { type: 'TICKET_EVENT', kind: 'REOPENED', ticketEventReason: 'Asked again' },
        { type: 'ASK', askIntro: null, question: 'Which?', options: [] },
        { type: 'TEXT', text: 'plain' },
      ],
    });
    expect(message.parts).toEqual([
      { type: 'ESCALATION_OFFER', offerId: 'o', state: 'PENDING', text: 'Hand off?' },
      { type: 'TICKET_ESCALATED', ticketId: 't', text: 'Escalated.' },
      { type: 'TICKET_EVENT', kind: 'REOPENED', reason: 'Asked again' },
      { type: 'ASK', question: 'Which?', options: [] },
      { type: 'TEXT', text: 'plain' },
    ]);
  });

  it('reads a page oldest first, with the cursor of the page before it only when there is one', () => {
    const node = (id: string) => ({ id, createdAt: '2026-11-04T10:00:00Z', parts: [] });
    const pageInfo = { hasPreviousPage: false, startCursor: 'a', endCursor: 'b' };
    expect(
      mingoMessagesPage({
        edges: [
          { cursor: 'b', node: node('new') },
          { cursor: 'a', node: node('old') },
        ],
        pageInfo: { ...pageInfo, hasNextPage: true },
      }),
    ).toEqual({ messages: [node('old'), node('new')], nextCursor: 'b' });
    expect(mingoMessagesPage({ edges: [], pageInfo: { ...pageInfo, hasNextPage: false } }).nextCursor).toBeNull();
  });
});
