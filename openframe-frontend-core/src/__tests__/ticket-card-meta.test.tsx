import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketCardView } from '../components/features/board/ticket-card';

const base = { id: 't1', title: 'VPN drops', status: 'ACTIVE' };

describe('TicketCardView ticket number line', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the number before the relative time and names the card by it', () => {
    render(<TicketCardView ticket={{ ...base, ticketNumber: '3891', createdAt: '2026-09-10T11:55:00Z' }} />);
    expect(screen.getByText('3891 • 5 min ago')).toBeInTheDocument();
  });

  it('shows the time alone when the host passes an empty number', () => {
    render(<TicketCardView ticket={{ ...base, ticketNumber: '', createdAt: '2026-09-10T11:55:00Z' }} />);
    expect(screen.getByText('5 min ago')).toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('shows the number alone without a creation time', () => {
    render(<TicketCardView ticket={{ ...base, ticketNumber: '3891' }} />);
    expect(screen.getByText('3891')).toBeInTheDocument();
  });

  it('renders no line when both are missing', () => {
    const { container } = render(<TicketCardView ticket={{ ...base, ticketNumber: '' }} />);
    expect(container.textContent).toBe('VPN drops');
  });
});
