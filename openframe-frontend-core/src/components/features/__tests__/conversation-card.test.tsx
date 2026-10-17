import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConversationCard } from '../conversation-card';

const base = {
  requester: { avatar: null, name: 'You', meta: 'IT admin' },
  request: "We need more people, but we can't hire.",
  responder: { avatar: null, name: 'Mingo', meta: 'What changes' },
  outcome: 'Takes the L1 tickets.',
};

describe('ConversationCard', () => {
  it('draws the request card unchanged: no button, the footer when it has one', () => {
    render(<ConversationCard {...base} footerLabel="Your part" footerValue="One tap" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('One tap')).toBeInTheDocument();
  });

  it('draws the context between the turns and no footer without one', () => {
    render(<ConversationCard {...base} context={{ label: 'Today', text: 'Tickets keep growing.' }} />);
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tickets keep growing.')).toBeInTheDocument();
    expect(screen.queryByText('Your part')).toBeNull();
  });

  it('is one toggle when selectable, named by the request and stating whether it is picked', () => {
    const onToggle = vi.fn();
    const { rerender } = render(<ConversationCard {...base} selection={{ pressed: true, onToggle }} />);
    const toggle = screen.getByRole('button', { name: /We need more people, but we can't hire\./ });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    // The card's content is not inside the button: only the mark is.
    expect(toggle).not.toContainElement(screen.getByText('Takes the L1 tickets.'));
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    rerender(<ConversationCard {...base} selection={{ pressed: false, onToggle }} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
});
