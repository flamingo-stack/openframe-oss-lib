/**
 * Regression guard for `displayApprovalTypes` semantics in the history
 * processors. An OMITTED option must render EVERY approval type inline —
 * consumers (tickets/mingo admin surfaces) that pass a wider list to their
 * realtime processor but omit it on the history path relied on this, and a
 * silent `['CLIENT']` default made their pending ADMIN approval cards vanish
 * on every reload/reconnect refetch. Parity with realtime is opt-in via an
 * explicit list.
 */

import { describe, it, expect } from 'vitest';
import { createChatStreamReducer } from '../../stream/chat-stream-reducer';
import type { HistoricalMessage, MessageSegment } from '../../types';
import { processHistoricalMessagesWithErrors } from '../process-historical-messages';

const adminApprovalMessage = (id: string): HistoricalMessage => ({
  id,
  createdAt: '2026-07-17T12:00:00Z',
  owner: { type: 'ASSISTANT' },
  messageData: [
    {
      type: 'APPROVAL_REQUEST',
      approvalRequestId: `req-${id}`,
      approvalType: 'ADMIN',
      command: 'systemctl restart nats',
    },
  ],
});

const approvalSegments = (segments: MessageSegment[] | string | undefined) =>
  Array.isArray(segments) ? segments.filter(s => s.type === 'approval_request' || s.type === 'approval_batch') : [];

describe('processHistoricalMessagesWithErrors — displayApprovalTypes', () => {
  it('renders non-CLIENT approvals inline when the option is OMITTED', () => {
    const { messages, escalatedApprovals } = processHistoricalMessagesWithErrors([adminApprovalMessage('m1')]);
    const rendered = messages.flatMap(m => approvalSegments(m.content));
    expect(rendered).toHaveLength(1);
    expect(escalatedApprovals.size).toBe(0);
  });

  it('escalates (does not render) approval types excluded by an explicit list', () => {
    const { messages, escalatedApprovals } = processHistoricalMessagesWithErrors([adminApprovalMessage('m1')], {
      displayApprovalTypes: ['CLIENT'],
    });
    const rendered = messages.flatMap(m => approvalSegments(m.content));
    expect(rendered).toHaveLength(0);
    expect(escalatedApprovals.has('req-m1')).toBe(true);
  });

  it('renders approval types included by an explicit list', () => {
    const { messages } = processHistoricalMessagesWithErrors([adminApprovalMessage('m1')], {
      displayApprovalTypes: ['CLIENT', 'ADMIN'],
    });
    const rendered = messages.flatMap(m => approvalSegments(m.content));
    expect(rendered).toHaveLength(1);
  });

  it('does not bleed a stale assistant id/streamSeq across an empty (escalated-only) flush', () => {
    // a1 is an assistant turn whose ONLY data is an ADMIN approval that gets
    // escalated (excluded by the explicit list) → it renders nothing, so the
    // flush triggered by the following user row is EMPTY. Its grouping identity
    // and streamSeq must be cleared, or the NEXT assistant turn (a2) inherits
    // a1's id/timestamp and a Math.max-inflated streamSeq (100 instead of 50),
    // which would over-cover synthetics in the history merge.
    const messages: HistoricalMessage[] = [
      {
        id: 'a1',
        createdAt: '2026-07-17T12:00:00Z',
        owner: { type: 'ASSISTANT' },
        lastChunkStreamSeq: 100,
        messageData: [{ type: 'APPROVAL_REQUEST', approvalRequestId: 'req-a1', approvalType: 'ADMIN', command: 'x' }],
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
    const { messages: out } = processHistoricalMessagesWithErrors(messages, { displayApprovalTypes: ['CLIENT'] });
    const asst = out.find(m => m.role === 'assistant');
    expect(asst?.id).toBe('a2');
    expect(asst?.streamSeq).toBe(50);
  });
});

/**
 * PAIRED-PATH contract. The history processor and the realtime reducer are the
 * two halves of one pipeline, and they DISAGREE by default: history renders
 * every approval type (the deliberate behaviour this file's header argues for),
 * the reducer defaults to `['CLIENT']`. Each half is pinned on its own — above
 * for history, in the reducer's own suite for realtime — but NOTHING asserted
 * the pair, so aligning one default "for consistency" (or a host wiring the
 * option into one call site only) changed observable behaviour with every test
 * still green.
 *
 * These two fixtures state the divergence and its remedy in one place: omitted
 * → the SAME approval is an inline card after a reload and invisible live;
 * explicit list → both paths agree. Read the header for why the asymmetric
 * defaults are the intended trade-off (a `['CLIENT']` history default made
 * pending ADMIN cards vanish on every refetch).
 */
describe('displayApprovalTypes — history vs realtime default divergence', () => {
  const liveApprovalSegments = (displayApprovalTypes?: string[]) => {
    const effects: Array<{ name: string; args: unknown[] }> = [];
    const r = createChatStreamReducer({
      transport: 'nats',
      onEffect: e => effects.push(e),
      ...(displayApprovalTypes ? { displayApprovalTypes } : {}),
    });
    r.apply({ type: 'turn-start' });
    r.apply({
      type: 'approval-request',
      requestId: 'req-m1',
      approvalType: 'ADMIN',
      command: 'systemctl restart nats',
    });
    return {
      rendered: r.state.messages.flatMap(m => approvalSegments(m.segments)),
      escalated: effects.filter(e => e.name === 'onEscalatedApproval'),
    };
  };

  it('OMITTED: history renders the ADMIN card inline, realtime escalates it', () => {
    const history = processHistoricalMessagesWithErrors([adminApprovalMessage('m1')]);
    expect(history.messages.flatMap(m => approvalSegments(m.content))).toHaveLength(1);
    expect(history.escalatedApprovals.size).toBe(0);

    const live = liveApprovalSegments();
    expect(live.rendered).toHaveLength(0);
    expect(live.escalated).toHaveLength(1);
  });

  it('EXPLICIT list: both paths render the same ADMIN card', () => {
    const types = ['CLIENT', 'ADMIN'];
    const history = processHistoricalMessagesWithErrors([adminApprovalMessage('m1')], {
      displayApprovalTypes: types,
    });
    expect(history.messages.flatMap(m => approvalSegments(m.content))).toHaveLength(1);

    const live = liveApprovalSegments(types);
    expect(live.rendered).toHaveLength(1);
    expect(live.escalated).toHaveLength(0);
  });
});
