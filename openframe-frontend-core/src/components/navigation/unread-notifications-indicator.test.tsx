import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPush } from '../../../vitest.setup';
import { type ChatRuntime, ChatRuntimeContext } from '../../contexts/chat-runtime-context';
import { DevicesGrid } from '../features/devices/devices-grid';
import { DevicesTableBody } from '../features/devices/devices-table-columns';
import { DevicesViewConfigProvider } from '../features/devices/devices-view-config';
import type { DeviceRow } from '../features/devices/types';
import { UnreadNotificationsIndicator, unreadNotificationsLabel } from './unread-notifications-indicator';

const navigate = vi.fn().mockReturnValue(true);
const openExternal = vi.fn();

const RUNTIME = {
  endpoints: { chatStreamUrl: '/chat' },
  navigation: { mode: 'host', navigate, openExternal },
  source: 'flamingo',
} as unknown as ChatRuntime;

/** The host's runtime, as the product mounts it above every page: its `navigate` is where a click lands. */
function renderInHost(ui: ReactNode) {
  return render(<ChatRuntimeContext.Provider value={RUNTIME}>{ui}</ChatRuntimeContext.Provider>);
}

beforeEach(() => {
  navigate.mockClear();
  openExternal.mockClear();
  mockPush.mockClear();
});

describe('UnreadNotificationsIndicator', () => {
  it('draws nothing at 0', () => {
    const { container } = render(<UnreadNotificationsIndicator count={0} href="/notifications" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('is the count alone, named in words, without a destination', () => {
    render(<UnreadNotificationsIndicator count={3} />);
    const count = screen.getByRole('img', { name: '3 unread notifications' });
    expect(count).toHaveTextContent('3');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('caps the count the way the sidebar does', () => {
    render(<UnreadNotificationsIndicator count={120} />);
    expect(screen.getByRole('img', { name: '120 unread notifications' })).toHaveTextContent('99+');
  });

  it("opens the notifications through the host's navigation", () => {
    renderInHost(<UnreadNotificationsIndicator count={1} href="/notifications?entityId=m-1" />);
    fireEvent.click(screen.getByRole('button', { name: '1 unread notification' }));
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/notifications?entityId=m-1' }));
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('opens them in a new tab on a modifier click, as a link would', () => {
    renderInHost(<UnreadNotificationsIndicator count={1} href="/notifications?entityId=m-1" />);
    fireEvent.click(screen.getByRole('button', { name: '1 unread notification' }), { metaKey: true });
    expect(openExternal).toHaveBeenCalledWith('/notifications?entityId=m-1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('names one notification in the singular', () => {
    expect(unreadNotificationsLabel(1)).toBe('1 unread notification');
    expect(unreadNotificationsLabel(2)).toBe('2 unread notifications');
  });
});

const ROWS: DeviceRow[] = [
  { id: 'd-1', machineId: 'm-1', status: 'ONLINE', hostname: 'reception', nickname: null, unreadNotificationCount: 2 },
  { id: 'd-2', machineId: 'm-2', status: 'ONLINE', hostname: 'front-desk', nickname: null },
];

const CONFIG = {
  getDeviceHref: (device: DeviceRow) => `/devices/details?id=${device.machineId}`,
  getDeviceNotificationsHref: (device: DeviceRow) => `/notifications?entityId=${device.machineId}`,
};

describe('the devices list', () => {
  it('shows the count on the rows that have one, in the table', () => {
    renderInHost(
      <DevicesViewConfigProvider value={CONFIG}>
        <DevicesTableBody devices={ROWS} />
      </DevicesViewConfigProvider>,
    );
    expect(screen.getAllByRole('button', { name: /unread notification/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '2 unread notifications' })).toHaveTextContent('2');
  });

  it('opens the device notifications, not the device, from a table row', () => {
    renderInHost(
      <DevicesViewConfigProvider value={CONFIG}>
        <DevicesTableBody devices={ROWS} />
      </DevicesViewConfigProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '2 unread notifications' }));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/notifications?entityId=m-1' }));
  });

  it('shows the count on the cards that have one, in the grid, and opens the notifications only', () => {
    renderInHost(
      <DevicesViewConfigProvider value={CONFIG}>
        <DevicesGrid devices={ROWS} isLoading={false} />
      </DevicesViewConfigProvider>,
    );
    const indicator = screen.getByRole('button', { name: '2 unread notifications' });
    expect(screen.getAllByRole('button', { name: /unread notification/ })).toHaveLength(1);
    fireEvent.click(indicator);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ href: '/notifications?entityId=m-1' }));
    // The card's own click (the device page) never ran.
    expect(mockPush).not.toHaveBeenCalled();
  });
});
