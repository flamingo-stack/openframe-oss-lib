import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button } from '../components/ui/button';
import {
  ReopenTicketRequestModal,
  type ReopenTicketRequestModalProps,
  type ReopenTicketRequestSelection,
} from '../components/ui/reopen-ticket-request-modal';

const meta = {
  title: 'UI/ReopenTicketRequestModal',
  component: ReopenTicketRequestModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Client-side Reopen Ticket dialog (Figma openframe---fae-chat 346-10518): the end user reopening their ' +
          'own resolved ticket from the closed chat. No status/assignee pair - the backend picks the target via ' +
          'requestTicketReopen; the user supplies an optional reason and, for Fae-closed tickets, the ' +
          'hand-off-to-a-technician choice. Tech-closed tickets hide the checkbox and omit the field entirely.',
      },
    },
  },
  argTypes: {
    isPending: { control: 'boolean' },
    showHandoffOption: { control: 'boolean' },
  },
} satisfies Meta<typeof ReopenTicketRequestModal>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledModal(props: Partial<ReopenTicketRequestModalProps> & { pendingOnConfirm?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = (selection: ReopenTicketRequestSelection) => {
    props.onConfirm?.(selection);
    if (!props.pendingOnConfirm) {
      setIsOpen(false);
      return;
    }
    // Simulate the requestTicketReopen round-trip.
    setIsPending(true);
    setTimeout(() => {
      setIsPending(false);
      setIsOpen(false);
    }, 1500);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Reopen Ticket
      </Button>
      <ReopenTicketRequestModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        {...props}
        isPending={props.isPending ?? isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}

/** Fae-closed ticket (`resolvedBy === END_USER`) - the handoff checkbox is offered. */
export const FaeClosed: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    showHandoffOption: true,
  },
  render: args => <ControlledModal {...args} />,
};

/** Technician-closed ticket - no checkbox; the selection omits `handoffToTechnician`. */
export const TechnicianClosed: Story = {
  args: { ...FaeClosed.args, showHandoffOption: false },
  render: args => <ControlledModal {...args} />,
};

/** Confirm shows the pending state (buttons lock, modal refuses to close). */
export const PendingOnConfirm: Story = {
  args: { ...FaeClosed.args },
  render: args => <ControlledModal {...args} pendingOnConfirm />,
};
