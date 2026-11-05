/**
 * The one receipt a chat that began as a ticket opens with.
 */

import { describe, expect, it } from 'vitest';
import { ticketHasReceipt, ticketReceiptMessage, ticketReceiptText } from '../ticket-receipt';

const FAE = { name: 'Fae', authorType: 'fae' as const, assistantType: 'fae' as const };

describe('ticketReceiptText', () => {
  it("the user's own request: received, its subject in bold, then the description", () => {
    expect(ticketReceiptText({ creationSource: 'FAE_FORM', title: 'VPN down', description: 'Since 9am' })).toBe(
      'Your request has been received. We will contact you shortly.\n\n**VPN down**  \nSince 9am',
    );
  });

  it("a technician's ticket says who made it, and stands in for a missing name and a missing description", () => {
    expect(ticketReceiptText({ creationSource: 'ADMIN_DASHBOARD', title: 'Disk full', creatorName: 'Ann' })).toBe(
      "Ann created a ticket for an issue affecting your device. We'll keep you updated here.\n\n**Disk full**  \n(No description provided)",
    );
    expect(ticketReceiptText({ creationSource: 'ADMIN_DASHBOARD' })).toMatch(/^Your technician created a ticket/);
  });
});

describe('ticketReceiptMessage', () => {
  it('only a ticket made by a form opens with one', () => {
    expect(ticketHasReceipt({ creationSource: 'FAE_FORM' })).toBe(true);
    expect(ticketHasReceipt({ creationSource: 'ADMIN_DASHBOARD' })).toBe(true);
    expect(ticketHasReceipt({ creationSource: 'EMAIL' })).toBe(false);
    expect(ticketReceiptMessage({ id: 't', creationSource: 'EMAIL' }, FAE)).toBeNull();
    expect(ticketReceiptMessage(null, FAE)).toBeNull();
  });

  it("is the assistant's first message, named by the ticket", () => {
    expect(
      ticketReceiptMessage(
        { id: 't1', creationSource: 'FAE_FORM', title: 'VPN', createdAt: '2026-11-04T10:00:00Z' },
        FAE,
      ),
    ).toEqual({
      id: 'ticket-receipt-t1',
      role: 'assistant',
      metadata: { createdAt: '2026-11-04T10:00:00.000Z', author: FAE },
      parts: [{ type: 'text', text: expect.stringContaining('**VPN**') }],
    });
  });
});
