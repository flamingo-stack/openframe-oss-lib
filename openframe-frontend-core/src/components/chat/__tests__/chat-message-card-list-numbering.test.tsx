/**
 * REGRESSION: cards in a numbered list were all numbered "1.".
 *
 * The bubble hoists every rendered entity card out of the markdown at its
 * marker, so a list of cards reaches the markdown engine as separate pieces:
 *
 *     1. [card://webinar:a]          → piece 1: "1. "
 *        Hosted by …                 → card a
 *                                    → piece 2: "   Hosted by …\n\n2. "
 *     2. [card://webinar:b]          → card b
 *
 * Piece 2 opens a new list on `2.`. That is only rendered as "2." if the `ol`
 * the engine produces keeps its `start` — which the override used to drop.
 * This drives the real component and the real engine, because the defect lives
 * exactly in the seam between the two.
 */

import { render, screen } from '@testing-library/react';
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

const answer: MessageSegment[] = [
  {
    type: 'text',
    text: [
      'Upcoming webinars:',
      '',
      '1. [card://webinar:a]',
      '   Hosted by the CEO.',
      '',
      '2. [card://webinar:b]',
      '   Hosted by the CTO.',
      '',
      '3. [card://webinar:c]',
    ].join('\n'),
  },
];

describe('ChatMessageEnhanced — numbered list of hoisted cards', () => {
  it('numbers each card by its own position, not "1." every time', () => {
    render(
      <ChatMessageEnhanced
        role="assistant"
        content={answer}
        renderEntityCard={renderEntityCard}
        NavLinkAnchor={NavLinkAnchor}
      />,
    );

    // Every card rendered — the fix must not trade numbering for content.
    for (const id of ['a', 'b', 'c']) expect(screen.getByTestId(`card-${id}`)).toBeInTheDocument();

    // One list per piece; the first opens on 1 (no attribute), the rest carry
    // the number the model wrote.
    const [first, second, third, ...rest] = screen.getAllByRole('list');
    expect(rest).toHaveLength(0);
    expect(first).not.toHaveAttribute('start');
    expect(second).toHaveAttribute('start', '2');
    expect(third).toHaveAttribute('start', '3');
  });
});
