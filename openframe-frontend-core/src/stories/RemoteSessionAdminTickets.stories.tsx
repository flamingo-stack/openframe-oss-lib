import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { AssignTicketModal, UnassignTicketModal } from '../components/features/remote-session';

const tickets = [
  { value: 't-3891', label: 'Privileged Access Audit', description: '#3891' },
  { value: 't-3874', label: 'System Health & Performance', description: '#3874' },
  { value: 't-3860', label: 'Page not found error on the client portal', description: '#3860' },
  { value: 't-3842', label: 'Printer offline after the driver update', description: '#3842' },
  { value: 't-3815', label: 'VPN drops every 20 minutes', description: '#3815' },
];

/**
 * Assign Ticket links one or more tickets to a recording; they show in the
 * Assigned Tickets table on the recording page, where Unassign Ticket unlinks one.
 */
const meta = {
  title: 'Remote Session/Admin/Assign Ticket',
  component: AssignTicketModal,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    options: tickets,
    onConfirm: fn(),
  },
} satisfies Meta<typeof AssignTicketModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick tickets in the field; Assign stays off until one is picked. */
export const Assign: Story = {};

/** The ticket search is in flight. */
export const Searching: Story = {
  args: { options: [], loading: true, onSearch: fn() },
};

/** The assignment is being saved. */
export const Assigning: Story = {
  args: { isPending: true },
};

/** Unlinking one ticket from the recording. */
export const Unassign: Story = {
  render: () => <UnassignTicketModal isOpen onClose={fn()} onConfirm={fn()} />,
};

/** The unassignment is being saved. */
export const Unassigning: Story = {
  render: () => <UnassignTicketModal isOpen isPending onClose={fn()} onConfirm={fn()} />,
};
