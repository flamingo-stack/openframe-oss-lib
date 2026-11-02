/**
 * `ApprovalRequestNotificationTile` without `onComplete`: a card built from a
 * chat's or a ticket's pending approval has no notification behind it, so it
 * draws no ✓ "Mark notification complete" and a decision completes nothing.
 * With `onComplete` (every notification surface) it is as before.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalRequestNotificationTile } from '../approval-request-notification-tile';
import { NotificationTile } from '../notification-tile';
import { MINGO_APPROVAL_REQUEST_TYPE, type Notification } from '../types';

/** Read and an hour old: past the live window, where the ✓ takes the X's place. */
const APPROVAL: Notification = {
  id: 'n-1',
  title: 'Clear stuck print queue',
  description: 'Mingo wants to restart the Spooler service on SRV-PRINT01.',
  createdAt: Date.now() - 60 * 60 * 1000,
  read: true,
  meta: {
    notificationType: MINGO_APPROVAL_REQUEST_TYPE,
    approvalRequestId: 'req-1',
    approvalType: 'ADMIN',
    toolCalls: [{ toolName: 'run_command', toolTitle: 'Restart print spooler', requiresApproval: true }],
  },
};

const complete = () => screen.queryByRole('button', { name: 'Mark notification complete' });

describe('ApprovalRequestNotificationTile onComplete', () => {
  it('draws the ✓ and completes the notification after a decision when given (as before)', async () => {
    const onComplete = vi.fn();
    const onApprove = vi.fn(async () => {});
    render(
      <ApprovalRequestNotificationTile
        notification={APPROVAL}
        onApprove={onApprove}
        onReject={vi.fn()}
        onComplete={onComplete}
      />,
    );
    expect(complete()).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith('n-1'));
    expect(onApprove).toHaveBeenCalledWith('req-1');
  });

  it('draws no ✓ without it, and a decision still goes through', async () => {
    const onApprove = vi.fn(async () => {});
    render(<ApprovalRequestNotificationTile notification={APPROVAL} onApprove={onApprove} onReject={vi.fn()} />);
    expect(complete()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();
    expect(onApprove).toHaveBeenCalledWith('req-1');
    expect(complete()).not.toBeInTheDocument();
  });
});

describe('NotificationTile onComplete', () => {
  it('keeps the live X to dismiss even without it', () => {
    const onSettle = vi.fn();
    render(
      <NotificationTile
        notification={{ id: 'n-2', title: 'Disk almost full', createdAt: Date.now() }}
        liveDurationMs={60_000}
        onSettle={onSettle}
      />,
    );
    expect(complete()).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(onSettle).toHaveBeenCalledWith('n-2');
  });
});
