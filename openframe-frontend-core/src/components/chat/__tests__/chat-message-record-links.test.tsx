/**
 * Record links (`[name](record://type/id)`) through the real component and the real markdown engine: the chip in the
 * sentence, the card under the answer, and nothing drawn for a link that is text (in code).
 */

import { render, screen, within } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it } from 'vitest';
import { ChatMessageEnhanced } from '../chat-message-enhanced';
import type { ChatRef } from '../chat-ref.types';

function NavLinkAnchor({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={href}>{children}</a>;
}

/** A fetch-mode card: a plain element, which the bubble hoists as a block. */
const renderEntityCard = (ref: ChatRef) => <div data-testid={`card-${ref.id}`}>{ref.title}</div>;

const renderRecordChip = ({ type, id }: { type: string; id: string; label: string }) =>
  type === 'script' ? <span data-testid={`chip-${type}-${id}`}>{id}</span> : null;

function show(text: string) {
  return render(
    <ChatMessageEnhanced
      role="assistant"
      content={[{ type: 'text', text }]}
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

  it('draws a linked record as a chip with its name in the sentence and its card under the answer', () => {
    show('The [Mac guide](record://onboarding_guide/mac-guide) covers it.');
    expect(within(screen.getByTestId('inline-chip')).getByText('Mac guide')).toBeTruthy();
    const cards = screen.getByTestId('chat-record-cards');
    expect(within(cards).getByTestId('card-mac-guide')).toBeTruthy();
    expect(screen.queryByText(/record:\/\//)).toBeNull();
  });

  it('draws one card per record however many times the answer links it', () => {
    show('[Guide](record://onboarding_guide/mac-guide), again [the guide](record://onboarding_guide/mac-guide).');
    expect(within(screen.getByTestId('chat-record-cards')).getAllByTestId('card-mac-guide')).toHaveLength(1);
  });

  it('draws no chip and no card for a record link quoted in code', () => {
    show('Write `[Guide](record://onboarding_guide/mac-guide)` to link it.');
    expect(screen.queryByTestId('inline-chip')).toBeNull();
    expect(screen.queryByTestId('chat-record-cards')).toBeNull();
  });
});
