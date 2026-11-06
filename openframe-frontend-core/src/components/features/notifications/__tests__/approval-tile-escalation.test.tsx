/**
 * An approval Mingo escalated reads as one on its tile with the commands folded away, as it does under the command
 * row in the chat: the "Mingo Escalated" band, once, and Approve in the warning colour.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalRequestNotificationTile } from '../approval-request-notification-tile';
import { MINGO_APPROVAL_REQUEST_TYPE, type Notification } from '../types';

function approval(policyReview?: Record<string, unknown>): Notification {
  return {
    id: 'n-1',
    title: 'Install NordVPN',
    createdAt: Date.now() - 60 * 60 * 1000,
    read: true,
    meta: {
      notificationType: MINGO_APPROVAL_REQUEST_TYPE,
      approvalRequestId: 'req-1',
      approvalType: 'ADMIN',
      toolCalls: [
        {
          toolExecutionRequestId: 'te-1',
          toolName: 'run_command',
          toolTitle: 'Install NordVPN',
          requiresApproval: true,
          toolCallArguments: { command: 'brew install nordvpn' },
          ...(policyReview ? { policyReview } : {}),
        },
      ],
    },
  };
}

const ESCALATED = {
  decision: 'SOFT_DENY',
  approvalLevel: 'ASK_USER',
  policyLevel: 'ALLOW',
  reason: 'Installs software from the web',
  operationCodes: ['DOWNLOAD_WEB', 'INSTALL_PACKAGE'],
  matchedRules: [],
};

function renderTile(notification: Notification) {
  render(<ApprovalRequestNotificationTile notification={notification} onApprove={vi.fn()} onReject={vi.fn()} />);
}

describe('ApprovalRequestNotificationTile escalation', () => {
  it('shows the band and a warning Approve while the commands are folded', () => {
    renderTile(approval(ESCALATED));
    expect(screen.getByRole('button', { name: 'Show command section' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByText('Mingo Escalated')).toHaveLength(1);
    expect(screen.getByText('Installs software from the web')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' }).className).toContain('bg-ods-warning');
  });

  it('keeps the one band when the commands open', () => {
    renderTile(approval(ESCALATED));
    fireEvent.click(screen.getByRole('button', { name: 'Show command section' }));
    expect(screen.getAllByText('Mingo Escalated')).toHaveLength(1);
  });

  it('is a plain approval when nothing was escalated', () => {
    renderTile(approval({ decision: 'POLICY', approvalLevel: 'ASK_USER', policyLevel: 'ASK_USER' }));
    expect(screen.queryByText('Mingo Escalated')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' }).className).not.toContain('bg-ods-warning');
  });
});
