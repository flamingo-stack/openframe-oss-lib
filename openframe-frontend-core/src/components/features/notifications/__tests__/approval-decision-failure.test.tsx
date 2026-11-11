/**
 * A failed Approve or Reject is SAID, in every look of an approval: the optimistic status rolls back and the lib's
 * error toast carries the request's own message (the buttons coming back alone read as nothing happened).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalRequestNotificationTile } from '../approval-request-notification-tile';
import { MINGO_APPROVAL_REQUEST_TYPE, type Notification } from '../types';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('../../../../hooks/use-toast', () => ({ useToast: () => ({ toast }), toast }));

const notification: Notification = {
  id: 'n-fail',
  type: 'Fae asks',
  title: 'Install Figma for Jen?',
  createdAt: Date.now(),
  read: true,
  meta: {
    notificationType: MINGO_APPROVAL_REQUEST_TYPE,
    approvalRequestId: 'req-fail',
    resolution: null,
    toolCalls: [{ toolName: 'install', toolTitle: 'Install Figma', requiresApproval: true }],
  },
};

beforeEach(() => toast.mockClear());

describe.each(['row', 'card'] as const)('a failed decision, presentation="%s"', presentation => {
  it('rolls back to the buttons, says why, and completes nothing', async () => {
    const onComplete = vi.fn();
    render(
      <ApprovalRequestNotificationTile
        notification={notification}
        presentation={presentation}
        onApprove={vi.fn(() => Promise.reject(new Error('Approval service is down')))}
        onReject={vi.fn()}
        onComplete={onComplete}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByRole('button', { name: 'Approve' })).toBeEnabled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Could not approve',
        description: 'Approval service is down',
        variant: 'destructive',
      }),
    );
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
