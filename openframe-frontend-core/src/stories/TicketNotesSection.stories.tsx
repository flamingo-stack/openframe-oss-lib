import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { TicketNotesSection } from '../components/ui/ticket-notes-section';
import type { TicketNote } from '../components/ui/ticket-note-card';

const meta = {
  title: 'Tickets/TicketNotesSection',
  component: TicketNotesSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Notes section with note cards (avatar, text, author, date), edit/delete for own notes, and input to add new notes.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '600px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TicketNotesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockNotes: TicketNote[] = [
  {
    id: '1',
    text: 'Started immediate cleanup. Cleared 8GB from temp files and IIS logs. Current disk usage at 91%. Exchange services stable but still in critical zone.',
    authorName: 'Marcus Chen',
    createdAt: '2025/08/27 14:45',
    isOwn: true,
  },
  {
    id: '2',
    text: 'Found 12GB of old .pst files in user profiles and 6GB of outdated Exchange transaction logs. Moving to archive storage.',
    authorName: 'Marcus Chen',
    createdAt: '2025/08/27 15:20',
    isOwn: true,
  },
  {
    id: '3',
    text: 'Reviewed backup agent logs. Recommend reducing retention to 14 days. Need client approval for storage expansion.',
    authorName: 'Sarah Kim',
    createdAt: '2025/08/27 16:30',
    isOwn: false,
  },
];

export const Default: Story = {
  args: {
    notes: mockNotes,
    onAddNote: () => {},
    onEditNote: () => {},
    onDeleteNote: () => {},
  },
};

export const Interactive: Story = {
  args: {
    notes: [],
    onAddNote: () => {},
  },
  render: function InteractiveNotes() {
    const [notes, setNotes] = useState<TicketNote[]>(mockNotes);

    return (
      <TicketNotesSection
        notes={notes}
        onAddNote={(text) => {
          setNotes(prev => [...prev, {
            id: String(Date.now()),
            text,
            authorName: 'You',
            createdAt: new Date().toLocaleString(),
            isOwn: true,
          }]);
        }}
        onEditNote={(id) => alert(`Edit note: ${id}`)}
        onDeleteNote={(id) => setNotes(prev => prev.filter(n => n.id !== id))}
      />
    );
  },
};

export const ReadOnly: Story = {
  args: {
    notes: mockNotes,
  },
};

export const Empty: Story = {
  args: {
    notes: [],
    onAddNote: () => {},
  },
};
