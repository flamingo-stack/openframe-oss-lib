/**
 * The loading states hosts draw while a section reads its data: each is the
 * loaded component's own box; and a pickable conversation card answers its own
 * clicks only.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConversationCard } from '../conversation-card';

describe('ConversationCard selection', () => {
  const speaker = { name: 'Dana', avatar: null };
  const card = (onToggle: () => void) => (
    <ConversationCard
      requester={speaker}
      request="The printer is down"
      responder={speaker}
      outcome="Fixed it"
      outcomeAside={<a href="#more">Read more</a>}
      selection={{ pressed: false, onToggle }}
    />
  );

  it('toggles on a click on the card and on its button', () => {
    const onToggle = vi.fn();
    render(card(onToggle));
    fireEvent.click(screen.getByText(/Fixed it/));
    fireEvent.click(screen.getByRole('button', { pressed: false }));
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it('leaves a click on a link inside the card to the link', () => {
    const onToggle = vi.fn();
    render(card(onToggle));
    fireEvent.click(screen.getByRole('link', { name: 'Read more' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe('ConversationCard loading form', () => {
  const speaker = { name: '', avatar: null };
  it('draws its own loading form, with or without its optional parts, and announces itself as loading', () => {
    const { rerender } = render(<ConversationCard requester={speaker} request="" responder={speaker} outcome="" loading />);
    expect(screen.getByText('Loading a conversation')).toBeInTheDocument();
    rerender(
      <ConversationCard
        requester={speaker}
        request=""
        responder={speaker}
        outcome=""
        context={{ label: 'Today', text: '' }}
        footerLabel="Your part"
        loading
      />,
    );
    expect(screen.getByText('Loading a conversation')).toBeInTheDocument();
  });
});
