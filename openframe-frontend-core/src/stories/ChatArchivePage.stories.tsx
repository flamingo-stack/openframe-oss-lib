import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { ChatArchivePage } from '../components/chat/chat-archive-page';
import type { DialogItem } from '../components/chat/types/component.types';

const NOW = new Date();
const DAY = 24 * 60 * 60 * 1000;
const ARCHIVED: DialogItem[] = [
  { id: 'a', title: 'osquery cert renewal', timestamp: NOW },
  { id: 'b', title: 'Exchange migration', timestamp: new Date(NOW.getTime() - DAY) },
  { id: 'c', title: 'Patch report for Acme', timestamp: new Date(NOW.getTime() - 9 * DAY) },
];

const meta = {
  title: 'Chat/ChatArchivePage',
  component: ChatArchivePage,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: false },
    docs: {
      description: {
        component:
          'The archived chats, grouped by day. `embedded` drops its own header (a host page provides one). `loadError` + `onRetry`: a failed first page shows the shared "Couldn’t load your chats" block instead of the empty state.',
      },
    },
  },
  decorators: [
    Story => (
      <div className="flex h-[480px] w-[560px] flex-col border border-ods-border bg-ods-card">
        <Story />
      </div>
    ),
  ],
  args: { embedded: true, dialogs: ARCHIVED, onSelectDialog: fn() },
} satisfies Meta<typeof ChatArchivePage>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Archived chats, embedded in a host page. */
export const Embedded: Story = {};

/** Nothing archived. */
export const Empty: Story = { args: { dialogs: [] } };

/** The first page failed: the shared load error with Try again. */
export const LoadError: Story = { args: { dialogs: [], loadError: true, onRetry: fn() } };
