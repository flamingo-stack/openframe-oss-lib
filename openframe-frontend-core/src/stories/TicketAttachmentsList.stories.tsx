import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TicketAttachmentsList } from '../components/ui/ticket-attachments-list';

const meta = {
  title: 'Tickets/TicketAttachmentsList',
  component: TicketAttachmentsList,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'View-only file attachment list with file icon/thumbnail, name, size, and download action.',
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
} satisfies Meta<typeof TicketAttachmentsList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    attachments: [
      { id: '1', fileName: 'acme-logo.png', fileSize: '5.6 MB', onDownload: () => {} },
      { id: '2', fileName: 'acme-logo.svg', fileSize: '5.6 MB', onDownload: () => {} },
      { id: '3', fileName: 'acme-teaser.mp4', fileSize: '5.6 MB', onDownload: () => {} },
    ],
  },
};

export const SingleFile: Story = {
  args: {
    attachments: [
      { id: '1', fileName: 'report.pdf', fileSize: '2.3 MB', onDownload: () => {} },
    ],
  },
};

export const NoDownload: Story = {
  args: {
    attachments: [
      { id: '1', fileName: 'readonly-file.txt', fileSize: '128 KB' },
    ],
  },
};

export const Empty: Story = {
  args: {
    attachments: [],
  },
};
