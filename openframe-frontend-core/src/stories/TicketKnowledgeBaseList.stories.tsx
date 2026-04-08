import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TicketKnowledgeBaseList } from '../components/ui/ticket-knowledge-base-list';

const meta = {
  title: 'Tickets/TicketKnowledgeBaseList',
  component: TicketKnowledgeBaseList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Clickable list of knowledge base articles with title, description, and navigation chevron.',
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
} satisfies Meta<typeof TicketKnowledgeBaseList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    articles: [
      { id: '1', title: 'OpenFrame Initial Setup Guide', description: 'Complete platform configuration including SSO integration, API connections, and core settings.', onClick: () => {} },
      { id: '2', title: 'Data Migration Best Practices', description: 'Step-by-step process for transferring client data from existing MSP tools.', onClick: () => {} },
      { id: '3', title: 'Admin Training Certification Program', description: 'Structured learning modules and hands-on exercises to certify administrators.', onClick: () => {} },
      { id: '4', title: 'Go-Live Validation Checklist', description: 'Technical and user acceptance criteria to verify successful platform deployment.', onClick: () => {} },
    ],
  },
};

export const SingleArticle: Story = {
  args: {
    articles: [
      { id: '1', title: 'Getting Started', description: 'A quick start guide for new users.' },
    ],
  },
};

export const Empty: Story = {
  args: {
    articles: [],
  },
};
