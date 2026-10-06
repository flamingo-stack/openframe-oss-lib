/**
 * Remote session widgets: the elapsed format, the consent card's https-only
 * site link and its decision lock, the chat composer's send, and the admin
 * widgets (viewers, events, expiry, Keep dialogs).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  formatRemoteSessionElapsed,
  formatRemoteSessionOffset,
  KeepRecordingModal,
  ReleaseKeepingModal,
  RemoteAccessRequestCard,
  RemoteSessionChatPanel,
  RemoteSessionEventList,
  RemoteSessionExpiry,
  RemoteSessionMinimizedChip,
  RemoteSessionStorageAlert,
  RemoteSessionSummary,
  RemoteSessionTimelineMarkers,
  RemoteSessionViewers,
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

const viewers = [
  { id: 'v1', name: 'Michael Ellington' },
  { id: 'v2', name: 'Maria Pizzeria', isYou: true },
  { id: 'h', name: 'Roman Smith', isHost: true },
  { id: 'v3', name: 'Ilona Hawthorne' },
  { id: 'v4', name: 'Dana Whitfield' },
  { id: 'v5', name: 'Anthony Reed' },
];

describe('RemoteSessionViewers', () => {
  it('names the host first and marks the signed-in user', () => {
    render(<RemoteSessionViewers viewers={viewers} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe(
      'In this session: Roman Smith (host), Michael Ellington, Maria Pizzeria (you), Ilona Hawthorne, Dana Whitfield, Anthony Reed',
    );
  });

  it('collapses everyone past the shown faces into +N', () => {
    render(<RemoteSessionViewers viewers={viewers} max={4} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders nothing for an empty session', () => {
    const { container } = render(<RemoteSessionViewers viewers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('sits beside the recording tag on the end user block', () => {
    render(
      <RemoteSessionSummary
        party={party}
        elapsed="5:23"
        showRecordingTag
        viewers={viewers}
        onOpenChat={() => {}}
        onEndSession={() => {}}
      />,
    );
    expect(screen.getByText('Session Recording')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^In this session/ })).toBeInTheDocument();
  });
});

const events = [
  { id: 'e1', offsetMs: 3_000, title: 'Input enabled', detail: 'technician took keyboard and mouse' },
  { id: 'e2', offsetMs: 52_000, title: 'Shortcut applied', detail: 'Ctrl + Shift + Esc' },
  { id: 'e3', offsetMs: 200_000, title: 'Elevated to administrator' },
];

describe('session events', () => {
  it('formats offsets as mm:ss, then h:mm:ss', () => {
    expect(formatRemoteSessionOffset(3_000)).toBe('00:03');
    expect(formatRemoteSessionOffset(100_000)).toBe('01:40');
    expect(formatRemoteSessionOffset(3_723_000)).toBe('1:02:03');
  });

  it('seeks to an event from the list and marks the current one', () => {
    const onSelect = vi.fn();
    render(<RemoteSessionEventList events={events} activeEventId="e2" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Input enabled/ }));
    expect(onSelect).toHaveBeenCalledWith(events[0]);
    expect(screen.getByRole('button', { name: /Shortcut applied/ })).toHaveAttribute('aria-current', 'true');
  });

  it('places a marker at each event share of the recording, pinning late ones to the end', () => {
    const onSelect = vi.fn();
    render(<RemoteSessionTimelineMarkers events={events} durationMs={104_000} onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Shortcut applied at 00:52' })).toHaveStyle({ left: '50%' });
    expect(screen.getByRole('button', { name: 'Elevated to administrator at 03:20' })).toHaveStyle({ left: '100%' });
    fireEvent.click(screen.getByRole('button', { name: 'Input enabled at 00:03' }));
    expect(onSelect).toHaveBeenCalledWith(events[0]);
  });
});

describe('recording retention', () => {
  it('shows the Keep holding a recording, its expiry, or that it expired', () => {
    const { rerender } = render(<RemoteSessionExpiry state="kept" keptBy="Roman Smith" reason="Client dispute" />);
    expect(screen.getByText('Kept by Roman Smith · Client dispute')).toBeInTheDocument();
    rerender(<RemoteSessionExpiry state="scheduled" date="09/29/26" remaining="Expires in 18 hours" />);
    expect(screen.getByText('Expires in 18 hours')).toBeInTheDocument();
    rerender(<RemoteSessionExpiry state="expired" />);
    expect(screen.getByText('Expired')).toBeInTheDocument();
  });

  it('names the plan capacity on the device banner only', () => {
    const { rerender } = render(<RemoteSessionStorageAlert scope="device" capacity="100 GB" />);
    expect(screen.getByRole('alert')).toHaveTextContent('All 100 GB of recording storage is used.');
    rerender(<RemoteSessionStorageAlert scope="session" />);
    expect(screen.getByRole('alert')).toHaveTextContent("This session isn't being recorded.");
  });

  it('keeps nothing until a reason is chosen', () => {
    render(<KeepRecordingModal isOpen onClose={() => {}} keptUsage="612 MB of 50 GB" onConfirm={() => {}} />);
    expect(screen.getByText(/Kept recordings use 612 MB of 50 GB/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeDisabled();
  });

  it('explains the grace period only when the recording is already past its date', () => {
    const props = {
      isOpen: true,
      onClose: () => {},
      onConfirm: () => {},
      keptBy: 'Dana Whitfield',
      keptOn: '27 Jul 2026',
      reason: 'Client dispute',
      ticket: 'TKT-4631',
      expiresOn: '3 Sep 2026',
    };
    const { rerender } = render(<ReleaseKeepingModal {...props} dueOn="31 Aug 2026" />);
    expect(screen.getByText('Kept by Dana Whitfield on 27 Jul 2026 for Client dispute.')).toBeInTheDocument();
    expect(screen.getByText('Ticket: TKT-4631')).toBeInTheDocument();
    expect(screen.getByText(/3 days' grace/)).toBeInTheDocument();
    rerender(<ReleaseKeepingModal {...props} />);
    expect(screen.queryByText(/3 days' grace/)).toBeNull();
  });
});
