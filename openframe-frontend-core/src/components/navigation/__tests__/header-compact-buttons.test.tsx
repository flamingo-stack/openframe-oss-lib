/**
 * The `compact` header buttons: the bell, the time tracker and the ticket alerts
 * for the navigation sidebar's foot — a row's cell in the 56px rail, a 32px icon
 * button beside the account row once expanded — so a host puts them there without
 * restyling a top-bar cell.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/** What `TicketAlertsButton` reads from the live ticket stream. */
interface TicketLiveStub {
  authed: boolean;
  unreadTotal: number;
  nextUnreadTicketId: string | null;
}
const ticketLive = vi.hoisted(() => {
  const state: { value: TicketLiveStub | null } = {
    value: { authed: true, unreadTotal: 3, nextUnreadTicketId: 't-9' },
  };
  return state;
});
vi.mock('../../tickets/ticket-live-provider', () => ({ useOptionalTicketLive: () => ticketLive.value }));

import { NotificationsProvider } from '../../features/notifications/notifications-context';
import { TimeTrackerProvider } from '../../features/time-tracker/time-tracker-context';
import { TimeTrackerHeaderButton } from '../../features/time-tracker/time-tracker-header-button';
import type { TimeTrackerData } from '../../features/time-tracker/types';
import { HeaderButton } from '../header-button';
import { NotificationsBellButton } from '../notifications-bell-button';
import { TicketAlertsButton } from '../ticket-alerts-button';

const tracker: TimeTrackerData = {
  status: 'ready',
  ticketOptions: [],
  selectedTicketId: null,
  onSelectedTicketChange: () => {},
  notes: '',
  onNotesChange: () => {},
  lastEntries: [],
  onStart: () => {},
  onPause: () => {},
  onResume: () => {},
  onCancel: () => {},
  onSubmit: () => {},
};

/** The glyph and the dot have no role to query: read them off the button's markup. */
const glyphIs20px = (button: HTMLElement) => expect(button.innerHTML).toMatch(/<svg[^>]*class="[^"]*\bh-5 w-5\b/);
const hasDot = (button: HTMLElement) => /class="[^"]*\bbg-ods-warning\b/.test(button.innerHTML);

/** The rail's row cell (44px, the rail's width), 32px from 140px of sidebar; never the bar's full-height cell. */
function expectCompactBox(button: HTMLElement) {
  expect(button).toHaveClass('h-11', 'min-h-0', 'w-full', '@[140px]/of-nav-sidebar:size-8', 'rounded-md');
  expect(button.className).not.toMatch(/--top-nav-cell/);
  expect(button.className).not.toMatch(/(^|\s)(min-)?h-full\b/);
}

describe('HeaderButton size="compact"', () => {
  it('is the compact cell with a pressed look and the fixed unread dot', () => {
    const { rerender } = render(<HeaderButton size="compact" aria-label="Thing" icon={<svg />} showUnreadDot />);
    const button = screen.getByRole('button', { name: 'Thing' });
    expectCompactBox(button);
    expect(button).toHaveClass('bg-transparent');
    expect(button.innerHTML).toMatch(/class="[^"]*\bbg-ods-warning h-2 w-2\b/);

    rerender(<HeaderButton size="compact" aria-label="Thing" icon={<svg />} isActive />);
    expect(screen.getByRole('button', { name: 'Thing' })).toHaveAttribute('data-state', 'active');
  });

  it('keeps the bar cell by default', () => {
    render(<HeaderButton aria-label="Cell" icon={<svg />} />);
    expect(screen.getByRole('button', { name: 'Cell' })).toHaveClass(
      'min-h-full',
      'self-stretch',
      'w-[var(--top-nav-cell,3.5rem)]',
    );
  });
});

describe('NotificationsBellButton variant="compact"', () => {
  it('toggles the drawer, shows the dot, and is pressed while open', () => {
    render(
      <NotificationsProvider initialNotifications={[{ id: 'n1', title: 'Disk almost full', createdAt: Date.now() }]}>
        <NotificationsBellButton variant="compact" />
      </NotificationsProvider>,
    );
    const bell = screen.getByRole('button', { name: 'Notifications' });
    expectCompactBox(bell);
    expect(bell).not.toHaveClass('border');
    glyphIs20px(bell);
    expect(hasDot(bell)).toBe(true);

    fireEvent.click(bell);
    const close = screen.getByRole('button', { name: 'Close notifications' });
    expect(close).toHaveAttribute('data-state', 'active');
    expect(hasDot(close)).toBe(false);
  });
});

describe('TimeTrackerHeaderButton variant="compact"', () => {
  it('stays the compact cell while a session runs: the glyph turns accent and the clock goes to the tooltip', () => {
    render(
      <TimeTrackerProvider {...tracker} status="tracking" runningSince={Date.now() - 65_000}>
        <TimeTrackerHeaderButton variant="compact" />
      </TimeTrackerProvider>,
    );
    const button = screen.getByRole('button', { name: 'Time tracker' });
    expectCompactBox(button);
    expect(button.className).not.toMatch(/min-w-\[144px\]/);
    expect(button.innerHTML).toMatch(/<svg[^>]*class="[^"]*\bh-5 w-5 text-ods-accent\b/);
    expect(button).toHaveAttribute('title', expect.stringMatching(/^Time tracker · \d/));
  });

  it('is pressed while its panel is open', () => {
    render(
      <TimeTrackerProvider {...tracker}>
        <TimeTrackerHeaderButton variant="compact" />
      </TimeTrackerProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Time tracker' }));
    expect(screen.getByRole('button', { name: 'Time tracker' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('keeps the wide cell by default', () => {
    render(
      <TimeTrackerProvider {...tracker} status="tracking" runningSince={Date.now()}>
        <TimeTrackerHeaderButton />
      </TimeTrackerProvider>,
    );
    expect(screen.getByRole('button', { name: 'Time tracker' }).className).toMatch(/md:min-w-\[144px\]/);
  });
});

describe('TicketAlertsButton variant="compact"', () => {
  it('is the compact cell with a 20px glyph and the count pill, routing to the newest unread ticket', () => {
    const onNavigate = vi.fn();
    render(<TicketAlertsButton variant="compact" href="/help-center/tickets" onNavigate={onNavigate} />);
    const button = screen.getByRole('button', { name: /Support tickets/ });
    expectCompactBox(button);
    glyphIs20px(button);
    expect(button).toHaveTextContent('3');
    fireEvent.click(button);
    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('t-9'));
  });

  it('still renders nothing with nothing unread', () => {
    ticketLive.value = { authed: true, unreadTotal: 0, nextUnreadTicketId: null };
    render(<TicketAlertsButton variant="compact" href="/help-center/tickets" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
