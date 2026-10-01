/**
 * Remote session widgets: the elapsed format, the consent card's https-only
 * site link and its decision lock, and the chat composer's send.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatRemoteSessionElapsed,
  RemoteAccessRequestCard,
  RemoteSessionChatPanel,
  RemoteSessionMinimizedChip,
} from '../remote-session';

const party = { organizationName: 'TechFlow Solutions', organizationSiteUrl: 'https://www.techflow.com' };

describe('formatRemoteSessionElapsed', () => {
  it('counts minutes and seconds, then hours', () => {
    expect(formatRemoteSessionElapsed(0)).toBe('0:00');
    expect(formatRemoteSessionElapsed(323_000)).toBe('5:23');
    expect(formatRemoteSessionElapsed(3_723_000)).toBe('1:02:03');
  });

  it('never goes negative when the clock is behind the server', () => {
    expect(formatRemoteSessionElapsed(-5_000)).toBe('0:00');
  });
});

describe('RemoteAccessRequestCard', () => {
  it('offers the site only when it is https', () => {
    const onOpenSite = vi.fn();
    const { rerender } = render(<RemoteAccessRequestCard party={party} onDecide={() => {}} onOpenSite={onOpenSite} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open website' }));
    expect(onOpenSite).toHaveBeenCalledWith('https://www.techflow.com');

    rerender(
      <RemoteAccessRequestCard
        party={{ ...party, organizationSiteUrl: 'http://techflow.local' }}
        onDecide={() => {}}
        onOpenSite={onOpenSite}
      />,
    );
    expect(screen.getByText('techflow.local')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open website' })).toBeNull();
  });

  it('reports the decision, and locks both buttons while one is in flight', () => {
    const onDecide = vi.fn();
    const { rerender } = render(<RemoteAccessRequestCard party={party} onDecide={onDecide} />);
    fireEvent.click(screen.getByRole('button', { name: 'Allow Access' }));
    expect(onDecide).toHaveBeenCalledWith('APPROVED');

    rerender(<RemoteAccessRequestCard party={party} onDecide={onDecide} deciding="APPROVED" />);
    expect(screen.getByRole('button', { name: 'Decline' })).toBeDisabled();
  });

  it('shows the recording notice only when asked to', () => {
    const { rerender } = render(<RemoteAccessRequestCard party={party} onDecide={() => {}} />);
    expect(screen.queryByText(/will be recorded/)).toBeNull();
    rerender(<RemoteAccessRequestCard party={party} onDecide={() => {}} showRecordingNotice />);
    expect(screen.getByText(/will be recorded/)).toBeInTheDocument();
  });
});

describe('RemoteSessionChatPanel', () => {
  it('sends the trimmed draft and clears it; a blank draft sends nothing', () => {
    const onSend = vi.fn();
    const onDraftChange = vi.fn();
    const props = {
      party,
      elapsed: '1:00',
      messages: [],
      onDraftChange,
      onSend,
      onCloseChat: () => {},
      onEndSession: () => {},
    };
    const { rerender } = render(<RemoteSessionChatPanel {...props} draft="  hello  " />);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).toHaveBeenCalledWith('hello');
    expect(onDraftChange).toHaveBeenCalledWith('');

    onSend.mockClear();
    rerender(<RemoteSessionChatPanel {...props} draft="   " />);
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('RemoteSessionMinimizedChip', () => {
  it('expands on click', () => {
    const onExpand = vi.fn();
    render(<RemoteSessionMinimizedChip party={{ ...party, technicianName: 'Mike Rodriguez' }} onExpand={onExpand} />);
    fireEvent.click(screen.getByRole('button', { name: 'Show session block' }));
    expect(onExpand).toHaveBeenCalledTimes(1);
  });
});
