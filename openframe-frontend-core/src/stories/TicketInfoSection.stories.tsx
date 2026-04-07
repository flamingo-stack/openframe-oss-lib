import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { TicketInfoSection } from '../components/ui/ticket-info-section';

const meta = {
  title: 'Tickets/TicketInfoSection',
  component: TicketInfoSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Collapsible ticket info bar showing organization, user, device, status, and expanded details including description, attachments, tags, knowledge base articles, and notes.',
      },
    },
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: '900px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TicketInfoSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockNotes = [
  {
    id: '1',
    text: 'Started immediate cleanup. Cleared 8GB from temp files and IIS logs. Current disk usage at 91%.',
    authorName: 'Marcus Chen',
    createdAt: '2025/08/27 14:45',
    isOwn: true,
  },
  {
    id: '2',
    text: 'Found 12GB of old .pst files in user profiles. Moving to archive storage. Disk now at 85%.',
    authorName: 'Marcus Chen',
    createdAt: '2025/08/27 15:20',
    isOwn: true,
  },
  {
    id: '3',
    text: 'Reviewed backup agent logs. Recommend reducing retention to 14 days for this server.',
    authorName: 'Sarah Kim',
    createdAt: '2025/08/27 16:30',
    isOwn: false,
  },
];

const mockAttachments = [
  { id: '1', fileName: 'acme-logo.png', fileSize: '5.6 MB', thumbnailSrc: undefined, onDownload: () => {} },
  { id: '2', fileName: 'acme-logo.svg', fileSize: '5.6 MB', onDownload: () => {} },
  { id: '3', fileName: 'acme-teaser.mp4', fileSize: '5.6 MB', onDownload: () => {} },
];

const mockArticles = [
  { id: '1', title: 'OpenFrame Initial Setup Guide', description: 'Complete platform configuration including SSO integration, API connections, and core settings.' },
  { id: '2', title: 'Data Migration Best Practices', description: 'Step-by-step process for transferring client data from existing MSP tools.' },
  { id: '3', title: 'Admin Training Certification Program', description: 'Structured learning modules and hands-on exercises to certify client administrators.' },
];

/**
 * Collapsed state — default view.
 */
export const Collapsed: Story = {
  args: {
    organization: { name: 'Acme Corp' },
    user: 'Unassigned',
    device: { name: 'WIN-SERVER-01', icon: <Monitor className="size-4" /> },
    statusTag: { label: 'TECH REQUIRED', variant: 'primary' },
    expanded: false,
  },
};

/**
 * Expanded state with all sections populated.
 */
export const Expanded: Story = {
  args: {
    organization: { name: 'Acme Corp' },
    user: 'Unassigned',
    device: { name: 'WIN-SERVER-01', icon: <Monitor className="size-4" /> },
    statusTag: { label: 'TECH REQUIRED', variant: 'primary' },
    expanded: true,
    assigned: { name: 'Roman Smith', statusTag: { label: 'Status', variant: 'primary' } },
    createdAt: '2025/07/12, 22:27',
    description: 'Goal: Reduce new client onboarding from 4 weeks to 10 days while maintaining 95% satisfaction.\n\nCore Activities:\n- Platform setup and configuration\n- Data migration and SSO integration\n- Team training and certification\n- Go-live support',
    attachments: mockAttachments,
    tags: ['Client-onboarding', 'Process-management', 'Project-template'],
    knowledgeBaseArticles: mockArticles,
    notes: mockNotes,
    onAddNote: () => {},
    onEditNote: () => {},
    onDeleteNote: () => {},
  },
};

/**
 * Interactive expand/collapse.
 */
export const Interactive: Story = {
  args: {
    organization: { name: 'Acme Corp' },
    user: 'John Doe',
    device: { name: 'LINUX-WEB-02', icon: <Monitor className="size-4" />, onClick: () => alert('Navigate to device') },
    statusTag: { label: 'ACTIVE', variant: 'success' },
  },
  render: function InteractiveStory(args) {
    const [expanded, setExpanded] = useState(false);
    return (
      <TicketInfoSection
        {...args}
        expanded={expanded}
        onExpand={() => setExpanded(prev => !prev)}
        assigned={{ name: 'Roman Smith' }}
        createdAt="2025/07/12, 22:27"
        description="This is a sample ticket description with **markdown** content."
        attachments={mockAttachments}
        tags={['Linux', 'Production', 'High-Risk']}
        knowledgeBaseArticles={mockArticles}
        notes={mockNotes}
        onAddNote={(text) => alert(`Add note: ${text}`)}
        onEditNote={(id) => alert(`Edit note: ${id}`)}
        onDeleteNote={(id) => alert(`Delete note: ${id}`)}
      />
    );
  },
};

/**
 * Minimal — no expanded data, just the header row.
 */
export const Minimal: Story = {
  args: {
    organization: { name: 'Unassigned' },
    user: 'Unassigned',
    device: { name: 'Unassigned' },
    statusTag: { label: 'ACTIVE', variant: 'success' },
    expanded: true,
    assigned: { name: 'Unassigned' },
    createdAt: '2025/01/01, 00:00',
  },
};
