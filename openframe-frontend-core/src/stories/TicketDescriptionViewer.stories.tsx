import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TicketDescriptionViewer } from '../components/ui/ticket-description-viewer';

const meta = {
  title: 'Tickets/TicketDescriptionViewer',
  component: TicketDescriptionViewer,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Renders ticket description content (markdown/HTML) with ODS-themed typography matching the RichTextEditor output.',
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
} satisfies Meta<typeof TicketDescriptionViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainText: Story = {
  args: {
    content: 'Goal: Reduce new client onboarding from 4 weeks to 10 days while maintaining 95% satisfaction and minimizing support issues.\n\nThis is a plain text description with line breaks.',
  },
};

export const HtmlContent: Story = {
  args: {
    content: `
      <h2>Core Activities</h2>
      <ul>
        <li>Platform setup and configuration</li>
        <li>Data migration and SSO integration</li>
        <li>Team training and certification</li>
        <li>Go-live support</li>
      </ul>
      <h2>Key Deliverables</h2>
      <ol>
        <li>Welcome package with access and timeline</li>
        <li>Technical assessment and migration plan</li>
        <li>Configured dashboard with user roles</li>
      </ol>
      <p>Timeline: 10-day implementation across 4 phases (Discovery → Setup → Training → Monitoring)</p>
      <blockquote>Acceptance: Client approval when all integrations work and admins are proficient.</blockquote>
    `,
  },
};

export const WithCode: Story = {
  args: {
    content: `
      <p>Run the following command:</p>
      <pre><code>npm install @flamingo-stack/openframe-frontend-core</code></pre>
      <p>Then use <code>import { Button }</code> in your component.</p>
    `,
  },
};

export const Empty: Story = {
  args: {
    content: '',
  },
};
