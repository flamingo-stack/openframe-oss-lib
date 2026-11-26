/**
 * Email messages through the HISTORY path (email-to-ticket): an inbound email is a person writing, never an agent's turn,
 * and its envelope rides on its message.
 */

import { describe, expect, it } from 'vitest';

import type { EmailMessageData, HistoricalMessage } from '../../types';
import { processHistoricalMessages } from '../process-historical-messages';

const ENVELOPE: EmailMessageData = {
  type: 'EMAIL',
  direction: 'INBOUND',
  from: { address: 'p.raman@mail.com', name: 'Priya Raman' },
  to: [{ address: 'support@brightpath-it.com', name: null }],
  cc: [{ address: 'john@mail.com', name: 'John Doe' }],
  subject: 'WiFi',
  quotedText: '> On Monday…',
  deliveryState: null,
  deliveryFailureReason: null,
  automatic: false,
};

const inbound = (parts: HistoricalMessage['parts'], owner: HistoricalMessage['owner']): HistoricalMessage => ({
  id: 'm1',
  chatType: 'CLIENT_CHAT',
  createdAt: '2026-11-25T10:00:00Z',
  owner,
  parts,
});

describe('an email in the history', () => {
  it('is the sender writing: a person, named by their email, with the envelope on the message', () => {
    const { messages } = processHistoricalMessages([
      inbound([{ type: 'TEXT', text: 'Hi team' }, ENVELOPE], {
        type: 'EMAIL',
        address: 'p.raman@mail.com',
        name: 'Priya Raman',
      }),
    ]);
    expect(messages).toHaveLength(1);
    const [message] = messages;
    expect(message.role).toBe('user');
    expect(message.metadata?.author).toEqual({ name: 'Priya Raman', authorType: 'user' });
    expect(message.parts).toEqual([{ type: 'text', text: 'Hi team' }]);
    expect(message.metadata?.email).toEqual({
      direction: 'INBOUND',
      from: { address: 'p.raman@mail.com', name: 'Priya Raman' },
      to: [{ address: 'support@brightpath-it.com' }],
      cc: [{ address: 'john@mail.com', name: 'John Doe' }],
      subject: 'WiFi',
      quotedText: '> On Monday…',
    });
  });

  it('names the sender by their address when the email gave no name', () => {
    const { messages } = processHistoricalMessages([
      inbound([{ type: 'TEXT', text: 'Hi' }, ENVELOPE], { type: 'EMAIL', address: 'p.raman@mail.com', name: null }),
    ]);
    expect(messages[0].metadata?.author?.name).toBe('p.raman@mail.com');
  });

  it('is a person writing even without its envelope (a history read without the email selections)', () => {
    const { messages } = processHistoricalMessages([inbound([{ type: 'TEXT', text: 'Hi team' }], { type: 'EMAIL' })]);
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('user');
    expect(messages[0].metadata?.author?.authorType).toBe('user');
    expect(messages[0].metadata?.email).toBeUndefined();
  });

  it('is a message when its body is empty (attachments alone)', () => {
    const { messages } = processHistoricalMessages([
      inbound([{ type: 'TEXT', text: '' }, ENVELOPE], { type: 'EMAIL', address: 'p.raman@mail.com' }),
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0].parts).toEqual([{ type: 'text', text: '' }]);
    expect(messages[0].metadata?.email?.from?.address).toBe('p.raman@mail.com');
  });

  it("is the technician's when it is a reply they sent, with its delivery state", () => {
    const { messages } = processHistoricalMessages([
      inbound(
        [
          { type: 'TEXT', text: 'On it' },
          { ...ENVELOPE, direction: 'OUTBOUND', deliveryState: 'FAILED', deliveryFailureReason: 'Mailbox full' },
        ],
        { type: 'ADMIN', user: { id: 'u1', firstName: 'Roman', lastName: 'Smith' } },
      ),
    ]);
    expect(messages[0].metadata?.author).toEqual({ name: 'Roman Smith', authorType: 'admin' });
    expect(messages[0].metadata?.email).toMatchObject({
      direction: 'OUTBOUND',
      deliveryState: 'FAILED',
      deliveryFailureReason: 'Mailbox full',
    });
  });

  it('leaves a chat message without an envelope', () => {
    const { messages } = processHistoricalMessages([
      inbound([{ type: 'TEXT', text: 'Hello' }], { type: 'CLIENT', machineId: 'm' }),
    ]);
    expect(messages[0].metadata?.email).toBeUndefined();
  });
});
