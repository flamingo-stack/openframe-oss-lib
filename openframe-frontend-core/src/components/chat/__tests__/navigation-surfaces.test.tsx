/**
 * Components that follow a link go through the lib's navigation executor with the host's runtime: the announcement
 * bar's CTA, the header's ticket alerts button and the contact form's redirect after a successful send.
 */
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ChatRuntime, ChatRuntimeContext } from '../../../contexts/chat-runtime-context';
import { type EndpointsRuntime, EndpointsRuntimeContext } from '../../../contexts/endpoints-runtime-context';
import { useContactSubmission } from '../../../hooks/use-contact-submission';
import type { Announcement } from '../../../types/announcement';
import { AnnouncementBar } from '../../announcement-bar';
import { TicketAlertsButton } from '../../navigation/ticket-alerts-button';

vi.mock('../../tickets/ticket-live-provider', () => ({
  useOptionalTicketLive: () => ({ authed: true, unreadTotal: 2, nextUnreadTicketId: 't-9' }),
}));

const navigate = vi.fn(() => true);
const openExternal = vi.fn();

function runtimeIn(mode: 'host' | 'embed'): ChatRuntime {
  return {
    endpoints: { chatStreamUrl: '/chat' },
    navigation: { mode, navigate, openExternal, defaultContentOrigin: 'https://hub.example.test' },
    source: 'openframe',
  } as unknown as ChatRuntime;
}

function Providers({ children, mode = 'host' }: { children: ReactNode; mode?: 'host' | 'embed' }) {
  return (
    <EndpointsRuntimeContext.Provider value={{ contactUrl: '/api/contact' } as EndpointsRuntime}>
      <ChatRuntimeContext.Provider value={runtimeIn(mode)}>{children}</ChatRuntimeContext.Provider>
    </EndpointsRuntimeContext.Provider>
  );
}

const announcement = (cta: Partial<Announcement>): Announcement => ({
  id: 'a1',
  title: 'New release',
  description: 'Read about it',
  background_color: '#000000',
  is_active: true,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  surfaces: null,
  cta_enabled: true,
  cta_text: 'Read more',
  ...cta,
});

beforeEach(() => {
  navigate.mockClear();
  openExternal.mockClear();
});

describe('announcement bar CTA', () => {
  it('moves this tab through the host for a same-tab CTA', () => {
    render(
      <Providers>
        <AnnouncementBar initialAnnouncement={announcement({ cta_url: '/releases/1-2', cta_target: '_self' })} />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Read more/ }));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: expect.stringMatching(/\/releases\/1-2$/) }));
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('opens a new tab through the host for a CTA set to open in one', () => {
    render(
      <Providers>
        <AnnouncementBar
          initialAnnouncement={announcement({ cta_url: 'https://example.com/post', cta_target: '_blank' })}
        />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Read more/ }));
    expect(openExternal).toHaveBeenCalledWith('https://example.com/post');
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe('ticket alerts button', () => {
  it('opens the newest unread ticket through the host', () => {
    render(
      <Providers>
        <TicketAlertsButton href="/help-center/tickets" />
      </Providers>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(navigate).toHaveBeenCalledWith(
      expect.objectContaining({ href: expect.stringContaining('/help-center/tickets?ticket=t-9') }),
    );
  });
});

describe('contact form redirect', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("replaces an embedded host's page with its own relative route, never a new tab", () => {
    const { result } = renderHook(() => useContactSubmission({ successRedirectUrl: '/thank-you' }), {
      wrapper: ({ children }) => <Providers mode="embed">{children}</Providers>,
    });
    act(() => result.current.setIsSuccess(true));
    act(() => vi.advanceTimersByTime(1500));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/thank-you' }));
    expect(openExternal).not.toHaveBeenCalled();
  });
});
