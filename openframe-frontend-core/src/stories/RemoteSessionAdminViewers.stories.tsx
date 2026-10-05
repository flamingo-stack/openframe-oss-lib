import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { RemoteSessionViewers, type RemoteSessionViewer } from '../components/features/remote-session';

/**
 * Who is in a live session: the host ringed in the accent colour, then the
 * colleagues watching. The chevron opens the full list.
 */
const viewers: RemoteSessionViewer[] = [
  { id: 'h', name: 'Roman Smith', isHost: true },
  { id: 'v1', name: 'Michael Ellington' },
  { id: 'v2', name: 'Maria Pizzeria', isYou: true },
  { id: 'v3', name: 'Ilona Hawthorne' },
  { id: 'v4', name: 'Dana Whitfield' },
  { id: 'v5', name: 'Anthony Reed' },
  { id: 'v6', name: 'Oksana Kifer' },
];

const meta = {
  title: 'Remote Session/Admin/Viewers',
  component: RemoteSessionViewers,
  tags: ['autodocs'],
  args: { viewers },
} satisfies Meta<typeof RemoteSessionViewers>;

export default meta;
type Story = StoryObj<typeof meta>;

/** More people than faces: the rest collapse into "+N". */
export const Crowded: Story = {};

/** Only the host and one watcher. */
export const Few: Story = {
  args: { viewers: viewers.slice(0, 2) },
};

/** On the bar over the live screen, as the watcher's page shows it. */
export const OverScreen: Story = {
  render: args => (
    <div className="flex w-[720px] items-center gap-[var(--spacing-system-xs)] rounded-b-md border border-t-0 border-ods-border bg-ods-card/50 py-[var(--spacing-system-xs)] pl-[var(--spacing-system-mf)] pr-[var(--spacing-system-xs)]">
      <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h6">Roman Smith (host)</span>
      <RemoteSessionViewers {...args} />
    </div>
  ),
};
