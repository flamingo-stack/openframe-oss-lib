import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type React from 'react';
import { useState } from 'react';
import { fn } from 'storybook/test';

import {
  RemoteSessionBlockFrame,
  RemoteSessionChatPanel,
  RemoteSessionMinimizedChip,
  RemoteSessionScope,
  RemoteSessionSummary,
  type RemoteSessionChatMessage,
  type RemoteSessionParty,
  type RemoteSessionViewer,
} from '../components/features/remote-session';

/**
 * The session block the end user sees while a technician is connected: the
 * summary, the chat with the technician, and the minimized chip. In the
 * desktop chat it lives in its own 440 px window the user can drag around.
 */

const organization: RemoteSessionParty = { organizationName: 'TechFlow Solutions' };
const technician: RemoteSessionParty = { ...organization, technicianName: 'Mike Rodriguez' };

const viewers: RemoteSessionViewer[] = [
  { id: 'h', name: 'Mike Rodriguez', isHost: true },
  { id: 'v1', name: 'Michael Ellington' },
  { id: 'v2', name: 'Ilona Hawthorne' },
  { id: 'v3', name: 'Dana Whitfield' },
  { id: 'v4', name: 'Anthony Reed' },
];

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const messages: RemoteSessionChatMessage[] = [
  { id: 'm1', author: 'system', text: 'Mike Rodriguez joined the session', at: minutesAgo(6) },
  { id: 'm2', author: 'technician', text: 'Hi! I can see your screen now.', at: minutesAgo(5) },
  { id: 'm3', author: 'user', text: 'Great, the printer is the one on the left.', at: minutesAgo(4) },
  { id: 'm4', author: 'technician', text: 'Got it - reinstalling the driver now.', at: minutesAgo(2) },
];

function WindowDecorator(Story: React.ComponentType) {
  return (
    <RemoteSessionScope>
      <Story />
    </RemoteSessionScope>
  );
}

const meta = {
  title: 'Remote Session/Client/Session Block',
  component: RemoteSessionSummary,
  tags: ['autodocs'],
  decorators: [WindowDecorator],
  args: {
    party: technician,
    elapsed: '5:23',
    showRecordingTag: true,
    onOpenChat: fn(),
    onEndSession: fn(),
  },
  render: args => (
    <RemoteSessionBlockFrame onHide={fn()}>
      <RemoteSessionSummary {...args} dragHandlers={{ onPointerDown: fn() }} />
    </RemoteSessionBlockFrame>
  ),
} satisfies Meta<typeof RemoteSessionSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A named technician: avatar and "<name> connected". */
export const Technician: Story = {};

/** No technician name on the session: the organization's logo and "IT support team is connected". */
export const Organization: Story = {
  args: { party: organization },
};

/** Not recorded: no SESSION RECORDING tag. */
export const NotRecorded: Story = {
  args: { showRecordingTag: false },
};

/** Colleagues watch the session: who is in it sits beside the SESSION RECORDING tag. */
export const Watched: Story = {
  args: { viewers },
};

/** A long name truncates before the dragger in the corner. */
export const LongName: Story = {
  args: { party: { ...technician, technicianName: 'Maximilian Alexander Rodriguez-Fernandez' } },
};

/** The chat with the technician, opened from the block. */
export const Chat: Story = {
  render: args => {
    const [draft, setDraft] = useState('');
    return (
      <RemoteSessionBlockFrame expanded onHide={fn()}>
        <RemoteSessionChatPanel
          party={args.party}
          elapsed={args.elapsed}
          showRecordingTag={args.showRecordingTag}
          messages={messages}
          draft={draft}
          onDraftChange={setDraft}
          onSend={fn()}
          onCloseChat={fn()}
          onEndSession={args.onEndSession}
          dragHandlers={{ onPointerDown: fn() }}
        />
      </RemoteSessionBlockFrame>
    );
  },
};

/** The chat while colleagues watch the session. */
export const ChatWatched: Story = {
  render: args => {
    const [draft, setDraft] = useState('');
    return (
      <RemoteSessionBlockFrame expanded onHide={fn()}>
        <RemoteSessionChatPanel
          party={args.party}
          elapsed={args.elapsed}
          showRecordingTag={args.showRecordingTag}
          viewers={viewers}
          messages={messages}
          draft={draft}
          onDraftChange={setDraft}
          onSend={fn()}
          onCloseChat={fn()}
          onEndSession={args.onEndSession}
          dragHandlers={{ onPointerDown: fn() }}
        />
      </RemoteSessionBlockFrame>
    );
  },
};

/** The chat while it is still connecting: the composer is disabled. */
export const ChatConnecting: Story = {
  render: args => (
    <RemoteSessionBlockFrame expanded onHide={fn()}>
      <RemoteSessionChatPanel
        party={args.party}
        elapsed={args.elapsed}
        messages={[]}
        ready={false}
        draft=""
        onDraftChange={fn()}
        onSend={fn()}
        onCloseChat={fn()}
        onEndSession={args.onEndSession}
      />
    </RemoteSessionBlockFrame>
  ),
};

/** "Hide this Block": the technician's avatar and a chevron to bring the block back. */
export const MinimizedTechnician: Story = {
  render: args => <RemoteSessionMinimizedChip party={args.party} onExpand={fn()} />,
};

/** The minimized chip of the organization variant. */
export const MinimizedOrganization: Story = {
  render: () => <RemoteSessionMinimizedChip party={organization} onExpand={fn()} />,
};

/** The whole block, switching between summary, chat and the chip like the desktop window does. */
export const Interactive: Story = {
  render: args => {
    const [panel, setPanel] = useState<'summary' | 'chat'>('summary');
    const [minimized, setMinimized] = useState(false);
    const [draft, setDraft] = useState('');
    const [thread, setThread] = useState(messages);
    if (minimized) return <RemoteSessionMinimizedChip party={args.party} onExpand={() => setMinimized(false)} />;
    return (
      <RemoteSessionBlockFrame expanded={panel === 'chat'} onHide={() => setMinimized(true)}>
        {panel === 'summary' ? (
          <RemoteSessionSummary {...args} onOpenChat={() => setPanel('chat')} />
        ) : (
          <RemoteSessionChatPanel
            party={args.party}
            elapsed={args.elapsed}
            showRecordingTag={args.showRecordingTag}
            messages={thread}
            draft={draft}
            onDraftChange={setDraft}
            onSend={text =>
              setThread(current => [...current, { id: `m${current.length + 1}`, author: 'user', text, at: new Date() }])
            }
            onCloseChat={() => setPanel('summary')}
            onEndSession={args.onEndSession}
          />
        )}
      </RemoteSessionBlockFrame>
    );
  },
};
