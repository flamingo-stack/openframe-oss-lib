import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Badge } from '../components/ui/badge';
import { InfoSection, type InfoSectionRow } from '../components/ui/info-section';

const meta = {
  title: 'Tickets/InfoSection',
  component: InfoSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A labelled info card: a vertical stack of `label —— value` rows. Each value is configurable — plain text (with an optional trailing image), an inline assignee picker (autocomplete with search), an inline status dropdown, or an arbitrary node.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    Story => (
      <div style={{ width: '360px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InfoSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const assigneeOptions = [
  { value: 'u1', label: 'Roman Smith' },
  { value: 'u2', label: 'John Doe' },
  { value: 'u3', label: 'Marcus Chen' },
];

const statusOptions = [
  { id: 's1', name: 'AI Assistance', color: '#3a3a3a' },
  { id: 's2', name: 'Tech Required', color: '#f59e0b' },
  { id: 's3', name: 'Resolved', color: '#5ea62e' },
];

/**
 * The "Ticket Details" card from the design: text, text-with-avatar, an inline
 * assignee picker, and an inline status dropdown.
 */
export const TicketDetails: Story = {
  args: {
    title: 'Ticket Details',
    rows: [
      { id: 'customer', label: 'Customer', value: { text: 'Acme Corp', imageFallback: 'Acme Corp' } },
      { id: 'device', label: 'Device', value: { text: 'TB-156-SEA', onClick: () => alert('Navigate to device') } },
      {
        id: 'assigned',
        label: 'Assigned',
        value: { type: 'assignee', options: assigneeOptions, onAssign: id => alert(`Assign: ${id}`) },
      },
      { id: 'created', label: 'Created', value: { text: '07/12/25, 10:03 AM' } },
      { id: 'created-by', label: 'Created by', value: { text: 'Fae', imageFallback: 'Fae' } },
      {
        id: 'status',
        label: 'Status',
        value: { type: 'status', status: 'AI_ASSISTANCE', options: statusOptions, onSelect: id => alert(`Status: ${id}`) },
      },
    ],
  },
};

/**
 * Live state: assigning a user and changing status update the rows in place.
 */
export const Interactive: Story = {
  args: { title: 'Ticket Details', rows: [] },
  render: function InteractiveStory() {
    const [assignee, setAssignee] = useState<string | null>(null);
    const [statusId, setStatusId] = useState('s1');

    const current = assigneeOptions.find(o => o.value === assignee);
    const status = statusOptions.find(o => o.id === statusId);

    const rows: InfoSectionRow[] = [
      { id: 'customer', label: 'Customer', value: { text: 'Acme Corp', imageFallback: 'Acme Corp' } },
      {
        id: 'assigned',
        label: 'Assigned',
        value: {
          type: 'assignee',
          currentAssignee: current ? { id: current.value, name: current.label } : undefined,
          options: assigneeOptions,
          onAssign: setAssignee,
        },
      },
      {
        id: 'status',
        label: 'Status',
        value: {
          type: 'status',
          status: 'AI_ASSISTANCE',
          label: status?.name,
          color: status?.color,
          options: statusOptions,
          onSelect: setStatusId,
        },
      },
      { id: 'priority', label: 'Priority', value: { type: 'custom', content: <Badge>High</Badge> } },
    ];

    return <InfoSection title="Ticket Details" rows={rows} />;
  },
};
