/**
 * Chips and cards through the real component and the real markdown engine. A record link
 * (`[name](record://type/id)`) is a chip in the sentence and never a card; a card comes only from the message's
 * `record_cards` part and is drawn where that part sits in the message.
 */

import { render, screen, within } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import type { ChatRef } from '../chat-ref.types';
import type { MessageSegment } from '../types';

function NavLinkAnchor({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href}>{children}</a>;
}

/** A fetch-mode card: a plain element, which the bubble hoists as a block. */
const renderEntityCard = (ref: ChatRef) => <div data-testid={`card-${ref.id}`}>{ref.title}</div>;

const renderRecordChip = ({ type, id }: { type: string; id: string; label: string }) =>
  type === 'script' ? <span data-testid={`chip-${type}-${id}`}>{id}</span> : null;

function show(text: string, cards: Array<{ type: string; id: string }> = []) {
  const content: MessageSegment[] = [
    ...(cards.length > 0 ? [{ type: 'record_cards' as const, cards }] : []),
    { type: 'text', text },
  ];
  return render(
    <ChatMessageEnhanced
      role="assistant"
      content={content}
      renderEntityCard={renderEntityCard}
      renderRecordChip={renderRecordChip}
      NavLinkAnchor={NavLinkAnchor}
    />,
  );
}

describe('ChatMessageEnhanced — record links', () => {
  it('draws a record the host has a chip for with the host chip, and no card for a chip-only type', () => {
    show('Run [Patch script](record://script/6aad91a3b776f95ad7491bd9) again.');
    expect(screen.getByTestId('chip-script-6aad91a3b776f95ad7491bd9')).toBeTruthy();
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
  });

  it('draws a linked record as a chip with its name in the sentence, and no card from the link', () => {
    show('The [Mac guide](record://onboarding_guide/mac-guide) covers it.');
    expect(within(screen.getByTestId('inline-chip')).getByText('Mac guide')).toBeTruthy();
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
    expect(screen.queryByText(/record:\/\//)).toBeNull();
  });

  it('draws a record-cards part where it sits: between the text before and after it', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        content={[
          { type: 'text', text: 'Putting it in the same list:' },
          { type: 'record_cards', cards: [{ type: 'onboarding_guide', id: 'mac-guide' }] },
          { type: 'text', text: 'The [Mac guide](record://onboarding_guide/mac-guide) covers it.' },
        ]}
        renderEntityCard={renderEntityCard}
        renderRecordChip={renderRecordChip}
        NavLinkAnchor={NavLinkAnchor}
      />,
    );
    const cards = screen.getByTestId('chat-record-cards');
    // Titled by the name the text gives the record.
    expect(within(cards).getByTestId('card-mac-guide').textContent).toBe('Mac guide');
    const before = screen.getByText(/Putting it in the same list/);
    const after = screen.getByText(/covers it/);
    expect(before.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cards.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws one card per record however many times the part names it', () => {
    show('Here it is.', [
      { type: 'onboarding_guide', id: 'mac-guide' },
      { type: 'onboarding_guide', id: 'mac-guide' },
    ]);
    expect(within(screen.getByTestId('chat-record-cards')).getAllByTestId('card-mac-guide')).toHaveLength(1);
  });

  it('draws no card for a type the chat has none for, even in the part', () => {
    show('Run it.', [{ type: 'script', id: '6aad91a3b776f95ad7491bd9' }]);
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
  });

  it('draws no chip and no card for a record link quoted in code', () => {
    show('Write `[Guide](record://onboarding_guide/mac-guide)` to link it.');
    expect(screen.queryByTestId('inline-chip')).toBeNull();
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
  });
});
