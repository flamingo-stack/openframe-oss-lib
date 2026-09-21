/**
 * `ChatTicketItem` secondary line.
 *
 * The row composes `ticketNumber • category • timeAgo` on its own, which
 * puts a bare number first - fine for the HubSpot help-center rows that
 * pass `#123`, wrong for the Fae client, where the reference must read as
 * `Ticket Number: 165 • 6m ago` (labelled, but secondary to the title).
 * `subtitle` lets the host own that line verbatim, and `unread` swaps the
 * line for the unread notice in brand yellow with a yellow chevron
 * (Figma fae-chat 1-5592). These tests pin the default composition, the
 * override, the empty-string "hide" case, and the unread treatment.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatTicketItem, type ChatTicketItemData } from '../entity-cards/chat-ticket-item';

// jsdom ships no ResizeObserver; the status tag's truncation probe observes
// itself on mount (mirrors chat-pending-turn.test.tsx).
class ObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ObserverStub);

const ticket: ChatTicketItemData = {
  id: 't-1',
  title: 'Slow Laptop',
  ticketNumber: '1002',
  status: 'ACTIVE',
  category: 'Hardware Issue',
  timeAgo: '6m ago',
};

describe('ChatTicketItem subtitle', () => {
  it('composes ticketNumber, category and timeAgo by default', () => {
    render(<ChatTicketItem ticket={ticket} />);

    expect(screen.getByText('1002 • Hardware Issue • 6m ago')).toBeInTheDocument();
  });

  it('renders the subtitle override verbatim instead of the composed line', () => {
    render(<ChatTicketItem ticket={{ ...ticket, subtitle: 'Ticket Number: 1002 • 6m ago' }} />);

    expect(screen.getByText('Ticket Number: 1002 • 6m ago')).toBeInTheDocument();
    expect(screen.queryByText('1002 • Hardware Issue • 6m ago')).not.toBeInTheDocument();
  });

  it('hides the secondary line for an empty subtitle', () => {
    render(<ChatTicketItem ticket={{ ...ticket, subtitle: '' }} />);

    expect(screen.getByText('Slow Laptop')).toBeInTheDocument();
    expect(screen.queryByText(/1002/)).not.toBeInTheDocument();
  });

  it('unread: shows the notice in brand yellow and turns the chevron yellow', () => {
    render(<ChatTicketItem ticket={{ ...ticket, unread: true }} />);

    const notice = screen.getByText('You have a new unread message');
    expect(notice).toHaveClass('text-ods-open-yellow');
    expect(screen.queryByText(/1002/)).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-ticket-item-chevron')).toHaveClass('bg-ods-open-yellow');
  });

  it('unread + subtitle: the override text wins but keeps the unread colour', () => {
    render(<ChatTicketItem ticket={{ ...ticket, unread: true, subtitle: '2 new replies' }} />);

    expect(screen.getByText('2 new replies')).toHaveClass('text-ods-open-yellow');
    expect(screen.queryByText('You have a new unread message')).not.toBeInTheDocument();
  });

  it('read rows keep the neutral secondary colour and chevron', () => {
    render(<ChatTicketItem ticket={ticket} />);

    expect(screen.getByText('1002 • Hardware Issue • 6m ago')).toHaveClass('text-ods-text-secondary');
    expect(screen.getByTestId('chat-ticket-item-chevron')).toHaveClass('bg-ods-card');
  });
});
