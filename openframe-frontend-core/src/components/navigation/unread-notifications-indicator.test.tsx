import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { mockPush } from '../../../vitest.setup';
import { DevicesGrid } from '../features/devices/devices-grid';
import { DevicesTableBody } from '../features/devices/devices-table-columns';
import { DevicesViewConfigProvider } from '../features/devices/devices-view-config';
import type { DeviceRow } from '../features/devices/types';
import { UnreadNotificationsIndicator, unreadNotificationsLabel } from './unread-notifications-indicator';

beforeEach(() => {
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

  it('opens the notifications on click', () => {
    render(<UnreadNotificationsIndicator count={1} href="/notifications?entityId=m-1" />);
    fireEvent.click(screen.getByRole('button', { name: '1 unread notification' }));
    expect(mockPush).toHaveBeenCalledWith('/notifications?entityId=m-1');
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
    render(
      <DevicesViewConfigProvider value={CONFIG}>
        <DevicesTableBody devices={ROWS} />
      </DevicesViewConfigProvider>,
    );
    expect(screen.getAllByRole('button', { name: /unread notification/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: '2 unread notifications' })).toHaveTextContent('2');
  });

  it('opens the device notifications, not the device, from a table row', () => {
    render(
      <DevicesViewConfigProvider value={CONFIG}>
        <DevicesTableBody devices={ROWS} />
      </DevicesViewConfigProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '2 unread notifications' }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/notifications?entityId=m-1');
  });

  it('shows the count on the cards that have one, in the grid, and opens the notifications only', () => {
    render(
      <DevicesViewConfigProvider value={CONFIG}>
        <DevicesGrid devices={ROWS} isLoading={false} />
      </DevicesViewConfigProvider>,
    );
    const indicator = screen.getByRole('button', { name: '2 unread notifications' });
    expect(screen.getAllByRole('button', { name: /unread notification/ })).toHaveLength(1);
    fireEvent.click(indicator);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/notifications?entityId=m-1');
  });
});
