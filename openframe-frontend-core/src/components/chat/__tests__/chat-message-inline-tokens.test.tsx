/**
 * The message's pre-scans read the SAME tokens the body draws (`scanChatTokens`), through the real component and the
 * real markdown engine. Each case was a raw-text regex disagreeing with the parsed body:
 *
 *   - a fetch-mode card written as a link (`[card://webinar:42](https://…)`) was cut out at the marker alone, leaving
 *     `(https://…)` as stray text after the card;
 *   - a card in a table cell was hoisted out of the table, splitting it into two broken pieces;
 *   - a mention in a code span was drawn as code, never as a chip.
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

const renderMention = ({ marker, id }: { marker: string; id: string }) => (
  <span data-testid={`chip-${marker}-${id}`}>{id}</span>
);

function show(text: string) {
  return render(
    <ChatMessageEnhanced
      role="assistant"
      content={[{ type: 'text', text }]}
      renderEntityCard={renderEntityCard}
      renderMention={renderMention}
      NavLinkAnchor={NavLinkAnchor}
    />,
  );
}

describe('ChatMessageEnhanced — inline tokens', () => {
  it('hoists a card written as a link without leaving its URL behind', () => {
    const { container } = show('See [card://webinar:42](https://example.com/webinars/42) for details.');
    expect(screen.getByTestId('card-42')).toBeTruthy();
    expect(container.textContent).not.toContain('example.com');
    expect(container.textContent).not.toContain('card://');
    expect(container.textContent).toContain('for details.');
  });

  it('draws a card in a table cell in place, keeping the table whole', () => {
    show('| Webinar | When |\n|---|---|\n| [card://webinar:42] | Today |');
    const table = screen.getByRole('table');
    expect(within(table).getByTestId('card-42')).toBeTruthy();
    expect(within(table).getByText('Today')).toBeTruthy();
  });

  it('draws a mention quoted in a code span as a chip', () => {
    show('Run `@script:6aad91a3b776f95ad7491bd9` again.');
    expect(screen.getByTestId('chip-script-6aad91a3b776f95ad7491bd9')).toBeTruthy();
    expect(screen.queryByText('@script:6aad91a3b776f95ad7491bd9')).toBeNull();
  });

  it('draws a card whose id markdown reads as emphasis', () => {
    show('See [card://blog:a*b*c] now.');
    expect(screen.getByTestId('card-abc')).toBeTruthy();
  });
});
