import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { Button } from '../components/ui/button';
import {
  TakeOverTicketModal,
  type TakeOverTicketModalProps,
  type TakeOverTicketSelection,
} from '../components/ui/take-over-ticket-modal';

const meta = {
  title: 'UI/TakeOverTicketModal',
  component: TakeOverTicketModal,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Take Over Ticket confirmation (Figma openframe---tickets 8482-112154 desktop / 8482-112169 mobile): ' +
          'shown when a technician takes a ticket over from the AI assistant instead of a one-click status/assign ' +
          'change. Presentational - the consumer supplies option lists (already ordered: custom statuses first, ' +
          'signed-in user first), default selections, and performs the actual take-over in onConfirm.',
      },
    },
  },
  argTypes: {
    isPending: { control: 'boolean' },
    assigneesLoading: { control: 'boolean' },
  },
} satisfies Meta<typeof TakeOverTicketModal>;

export default meta;
type Story = StoryObj<typeof meta>;

const STATUS_OPTIONS = [
  { value: 'todo', label: 'Todo', color: '#2890fa' },
  { value: 'in-progress', label: 'In Progress', color: '#ffc008' },
  { value: 'tech-required', label: 'Technician Required', color: '#f36666' },
  { value: 'resolved', label: 'Resolved', color: '#5ea62e' },
];

const ASSIGNEE_OPTIONS = [
  { value: 'u1', label: 'Roman Smith' },
  { value: 'u2', label: 'Olivia Carter' },
  { value: 'u3', label: 'James Wilson' },
];

function ControlledModal(props: Partial<TakeOverTicketModalProps> & { pendingOnConfirm?: boolean }) {
  const [isOpen, setIsOpen] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = (selection: TakeOverTicketSelection) => {
    props.onConfirm?.(selection);
    if (!props.pendingOnConfirm) {
      setIsOpen(false);
      return;
    }
    // Simulate the consumer's take-over mutation round-trip.
    setIsPending(true);
    setTimeout(() => {
      setIsPending(false);
      setIsOpen(false);
    }, 1500);
  };

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        Take Over Ticket
      </Button>
      <TakeOverTicketModal
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

/** Design default: first (custom) status pre-selected, signed-in user pre-selected. */
export const Default: Story = {
  args: {
    isOpen: true,
    onClose: fn(),
    onConfirm: fn(),
    ticketRef: '1003: Email client synchronization issues',
    statusOptions: STATUS_OPTIONS,
    assigneeOptions: ASSIGNEE_OPTIONS,
    initialAssigneeId: 'u1',
  },
  render: args => <ControlledModal {...args} />,
};

/** Trigger pre-fills a specific status (e.g. board drag into a column, status dropdown pick). */
export const PrefilledStatus: Story = {
  args: { ...Default.args, initialStatusId: 'tech-required', initialAssigneeId: 'u2' },
  render: args => <ControlledModal {...args} />,
};

/** No assignee pre-selected: Take Over stays disabled until one is chosen. */
export const NoDefaultAssignee: Story = {
  args: { ...Default.args, initialAssigneeId: null },
  render: args => <ControlledModal {...args} />,
};

/** Confirm shows the pending state (buttons lock, modal refuses to close). */
export const PendingOnConfirm: Story = {
  args: { ...Default.args },
  render: args => <ControlledModal {...args} pendingOnConfirm />,
};
