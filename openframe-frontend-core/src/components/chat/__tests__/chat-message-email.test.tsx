/**
 * A message that is an email (email-to-ticket, Figma tickets 9427-75851): its envelope over its body, the quoted thread
 * folded, a failed reply saying so. The body is the email's plain text, never markdown.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ChatEmailEnvelope } from '../../../chat-protocol/chat-message';
import { ChatMessageEnhanced } from '../chat-message-enhanced';

const INBOUND: ChatEmailEnvelope = {
  direction: 'INBOUND',
  from: { address: 'p.raman@mail.com', name: 'Priya Raman' },
  to: [{ address: 'support@brightpath-it.com' }],
  cc: [{ address: 'john@mail.com' }],
  quotedText: '> On Monday Roman wrote',
};

function renderEmail(email: ChatEmailEnvelope, text: string, authorType: 'user' | 'admin' = 'user') {
  return render(
    <ChatMessageEnhanced
      role="user"
      name="Priya Raman"
      parts={[{ type: 'text', text }]}
      authorType={authorType}
      selfAuthorType="admin"
      email={email}
    />,
  );
}

describe('an email message', () => {
  it('draws its envelope: from, to and how many were copied', () => {
    renderEmail(INBOUND, 'Hi team');
    const card = screen.getByTestId('chat-email-message');
    expect(card.textContent).toContain('p.raman@mail.com');
    expect(card.textContent).toContain('to');
    expect(card.textContent).toContain('support@brightpath-it.com');
    expect(card.textContent).toContain('+1 in CC');
  });

  it("draws its body as the email's plain text, not markdown", () => {
    renderEmail(INBOUND, '# not a heading\n- not a list');
    expect(screen.getByText(/# not a heading/)).toBeTruthy();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('folds the quoted thread until asked', () => {
    renderEmail(INBOUND, 'Hi team');
    expect(screen.queryByText(/On Monday Roman wrote/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show quoted text' }));
    expect(screen.getByText(/On Monday Roman wrote/)).toBeTruthy();
  });

  it('says a reply was not delivered, and why', () => {
    renderEmail(
      { ...INBOUND, direction: 'OUTBOUND', deliveryState: 'FAILED', deliveryFailureReason: 'Mailbox full' },
      'On it',
      'admin',
    );
    expect(screen.getByText('Not delivered: Mailbox full')).toBeTruthy();
  });

  it('is drawn when its body is empty', () => {
    renderEmail({ ...INBOUND, quotedText: undefined }, '');
    expect(screen.getByTestId('chat-email-message').textContent).toContain('p.raman@mail.com');
  });
});
