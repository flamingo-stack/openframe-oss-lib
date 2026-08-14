import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button } from '../components/ui/button';
import {
  ReopenTicketModal,
  type ReopenTicketModalProps,
  type ReopenTicketSelection,
} from '../components/ui/reopen-ticket-modal';

const meta = {
  title: 'UI/ReopenTicketModal',
  component: ReopenTicketModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Reopen Ticket dialog (Figma openframe---tickets 8456-17581): shown when a technician reopens a ' +
          'Resolved/Archived ticket. Same Status + Assigned pair as TakeOverTicketModal - both required before ' +
          'the CTA unlocks - plus an optional free-text reason. Presentational - the consumer supplies option ' +
          'lists (design default pre-selects Tech Required), default selections, and performs the actual reopen ' +
          'in onConfirm.',
      },
    },
  },
  argTypes: {
    isPending: { control: 'boolean' },
    assigneesLoading: { control: 'boolean' },
  },
} satisfies Meta<typeof ReopenTicketModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo', color: '#2890fa' },
  { value: 'in-progress', label: 'In Progress', color: '#ffc008' },
  { value: 'tech-required', label: 'Technician Required', color: '#f36666' },
];

const ASSIGNEE_OPTIONS = [
  { value: 'u1', label: 'Roman Smith' },
  { value: 'u2', label: 'Olivia Carter' },
  { value: 'u3', label: 'James Wilson' },
];

function ControlledModal(props: Partial<ReopenTicketModalProps> & { pendingOnConfirm?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = (selection: ReopenTicketSelection) => {
    props.onConfirm?.(selection);
    if (!props.pendingOnConfirm) {
      setIsOpen(false);
      return;
    }
    // Simulate the consumer's reopen mutation round-trip.
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
      <ReopenTicketModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        ticketRef="1003: Email client synchronization issues"
        statusOptions={STATUS_OPTIONS}
        assigneeOptions={ASSIGNEE_OPTIONS}
        {...props}
        isPending={props.isPending ?? isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}

/** Design default: Tech Required pre-selected (mock annotation), previous assignee restored. */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    ticketRef: '1003: Email client synchronization issues',
    statusOptions: STATUS_OPTIONS,
    assigneeOptions: ASSIGNEE_OPTIONS,
    initialStatusId: 'tech-required',
    initialAssigneeId: 'u1',
  },
  render: args => <ControlledModal {...args} />,
};

/**
 * No assignee pre-selected (e.g. the ticket was unassigned): the CTA stays
 * locked until a technician is chosen - both fields are required, matching
 * Take Over.
 */
export const NoDefaultAssignee: Story = {
  args: { ...Default.args, initialAssigneeId: null },
  render: args => <ControlledModal {...args} />,
};

/** Confirm shows the pending state (buttons lock, modal refuses to close). */
export const PendingOnConfirm: Story = {
  args: { ...Default.args },
  render: args => <ControlledModal {...args} pendingOnConfirm />,
};
