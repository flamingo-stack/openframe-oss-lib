import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { MingoWelcome } from '../components/chat/mingo-welcome'
import { MingoChatHistory } from '../components/chat/mingo-chat-history'

const SAMPLE_HISTORY = (
  <MingoChatHistory
    dialogs={[
      { id: 'd1', title: 'PowerShell script for bulk user creation', unreadMessagesCount: 1 },
      { id: 'd2', title: 'Setting up automated backup verification', unreadMessagesCount: 1 },
      { id: 'd3', title: 'Network segmentation best practices for client' },
      { id: 'd4', title: 'Creating GPO for software deployment' },
      { id: 'd5', title: 'WSUS patching strategy optimization' },
      { id: 'd6', title: 'Analyzing unusual network traffic patterns' },
    ]}
    onSelectDialog={(id) => console.log('select', id)}
    onRequestRename={(d) => console.log('request rename', d.id)}
    onRequestArchive={(d) => console.log('request archive', d.id)}
  />
)

const meta: Meta<typeof MingoWelcome> = {
  title: 'Chat/MingoWelcome',
  component: MingoWelcome,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Figma node `113:69208`. Default (Mingo-mode) chat empty state — a vertically-centred greeting, an optional "New to OpenFrame?" Guide-chat promo, and a quick-action chip row. Content is configurable with OpenFrame defaults; the only wired action is "Start Guide Chat" (`onStartGuideChat`).',
      },
    },
  },
  argTypes: {
    title: { control: false },
    subtitle: { control: false },
    promo: { control: false },
    quickActions: { control: false },
    onStartGuideChat: { control: false },
    hasExistingChats: { control: 'boolean' },
  },
  decorators: [
    (Story) => (
      // Mimic the narrow drawer panel the empty state lives in: fixed height so
      // the greeting's `flex-1` centring and the pinned grid/chips read
      // correctly.
      <div className="flex h-[760px] w-[440px] flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg px-5 py-4">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof MingoWelcome>

/** Full default state with the Guide CTA wired (promo card + yellow chip). */
export const Default: Story = {
  args: {
    onStartGuideChat: () => console.log('switch to guide mode'),
  },
}

/** Guide mode not configured → the promo card and "Start Guide Chat" chip are
 *  suppressed (no dead-end CTA). */
export const WithoutGuide: Story = {
  args: {},
}

/** Extra quick-action chips appended after the built-in Guide chip. */
export const WithQuickActions: Story = {
  args: {
    onStartGuideChat: () => console.log('switch to guide mode'),
    quickActions: [
      { id: 'weekly', label: 'Weekly Log Summary' },
      { id: 'more', label: '…' },
    ],
  },
}

/** Returning user (`hasExistingChats`) — the "New to OpenFrame?" notification
 *  is hidden and the "Start Guide Chat" chip drops to the muted outline style. */
export const ReturningUser: Story = {
  args: {
    onStartGuideChat: () => console.log('switch to guide mode'),
    hasExistingChats: true,
    dialogHistory: SAMPLE_HISTORY,
    quickActions: [
      { id: 'weekly', label: 'Weekly Log Summary' },
      { id: 'more', label: '…' },
    ],
  },
}

/** Wide panel (e.g. in-layout / desktop). */
export const Wide: Story = {
  args: {
    onStartGuideChat: () => console.log('switch to guide mode'),
    quickActions: [
      { id: 'weekly', label: 'Weekly Log Summary' },
      { id: 'more', label: '…' },
    ],
  },
  decorators: [
    (Story) => (
      <div className="flex h-[760px] w-[960px] flex-col overflow-hidden rounded-md border border-ods-border bg-ods-bg px-5 py-4">
        <Story />
      </div>
    ),
  ],
}
