/**
 * `ApprovalRequestNotificationTile presentation="row"`: the lockscreen approval in one line. The agent's label is the
 * mark's accessible name (not printed), the title stays first after the mark in every state, Approve resolves to the
 * status, and in a loading scope the row draws its own skeleton.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoadingScope } from '../../../ui/loading-scope';
import { ApprovalRequestNotificationTile } from '../approval-request-notification-tile';
import { MINGO_APPROVAL_REQUEST_TYPE, type Notification } from '../types';

const notification = (resolution: 'APPROVED' | null = null): Notification => ({
  id: 'n-row',
  type: 'Fae asks',
  icon: <span data-testid="mark" />,
  title: 'Install Figma for Jen?',
  description: 'Never shown in a row.',
  createdAt: Date.now(),
  read: true,
  meta: {
    notificationType: MINGO_APPROVAL_REQUEST_TYPE,
    approvalRequestId: 'req-row',
    resolution,
    toolCalls: [{ toolName: 'install', toolTitle: 'Install Figma', requiresApproval: true }],
  },
});

const renderRow = (n: Notification, onApprove = vi.fn(async () => {})) =>
  render(
    <ApprovalRequestNotificationTile notification={n} presentation="row" onApprove={onApprove} onReject={vi.fn()} />,
  );

describe('ApprovalRequestNotificationTile presentation="row"', () => {
  it('names the agent on its mark, shows the title and both buttons, and no description or time', () => {
    renderRow(notification());
    expect(screen.getByRole('img', { name: 'Fae asks' })).toContainElement(screen.getByTestId('mark'));
    expect(screen.getByText('Install Figma for Jen?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    expect(screen.queryByText('Never shown in a row.')).not.toBeInTheDocument();
    expect(screen.queryByText('Fae asks')).not.toBeInTheDocument();
  });

  it('turns into the status once approved, the title still right after the mark', async () => {
    const onApprove = vi.fn(async () => {});
    renderRow(notification(), onApprove);
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();
    expect(onApprove).toHaveBeenCalledWith('req-row');
    // The mark has no text: the row reads the title, then the status.
    expect(screen.getByRole('status')).toHaveTextContent(/^Install Figma for Jen\?Approved$/);
  });

  it('shows a resolved request as its status, with no buttons', () => {
    renderRow(notification('APPROVED'));
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
  });

  it("draws the notification's image over its icon, and falls back to the icon when the image fails", () => {
    renderRow({ ...notification(), imageUrl: 'https://example.test/jen.png' });
    const mark = within(screen.getByRole('img', { name: 'Fae asks' }));
    const image = mark.getByRole('presentation');
    expect(image).toHaveAttribute('src', expect.stringContaining('jen.png'));
    expect(mark.queryByTestId('mark')).not.toBeInTheDocument();
    fireEvent.error(image);
    expect(mark.queryByRole('presentation')).not.toBeInTheDocument();
    expect(mark.getByTestId('mark')).toBeInTheDocument();
  });

  it('dims Approve while the scripted tap lands', () => {
    render(
      <ApprovalRequestNotificationTile
        notification={notification()}
        presentation="row"
        approvePressed
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toHaveAttribute('data-pressed', 'true');
  });

  it('draws its loading form for each presentation when given `loading`, with no notification yet', () => {
    const { rerender } = render(<ApprovalRequestNotificationTile loading presentation="row" />);
    expect(screen.getByRole('status', { hidden: true })).toHaveAttribute('aria-hidden');
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    rerender(<ApprovalRequestNotificationTile loading presentation="lockscreen" />);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(screen.queryByText('Install Figma for Jen?')).not.toBeInTheDocument();
  });

  it('draws its own skeleton in a loading scope', () => {
    render(
      <LoadingScope>
        <ApprovalRequestNotificationTile
          notification={notification()}
          presentation="row"
          onApprove={vi.fn()}
          onReject={vi.fn()}
        />
      </LoadingScope>,
    );
    expect(screen.queryByText('Install Figma for Jen?')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { hidden: true })).toHaveAttribute('aria-hidden');
  });
});
