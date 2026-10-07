import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import {
  RemoteSessionEventList,
  RemoteSessionTimelineMarkers,
  formatRemoteSessionOffset,
  type RemoteSessionEvent,
} from '../components/features/remote-session';

/**
 * Session events on a recording: the marks above the player's track and the
 * SESSION EVENTS list under the player. Both seek the player.
 */
const events: RemoteSessionEvent[] = [
  { id: 'e1', offsetMs: 3_000, title: 'Input enabled', detail: 'technician took keyboard and mouse' },
  { id: 'e2', offsetMs: 7_000, title: 'Clipboard copied', detail: '1.2 KB from device' },
  { id: 'e3', offsetMs: 52_000, title: 'Shortcut applied', detail: 'Ctrl + Shift + Esc' },
  { id: 'e4', offsetMs: 100_000, title: 'Elevated to administrator', detail: 'UAC accepted on device' },
];

const DURATION_MS = 105_000;

const meta = {
  title: 'Remote Session/Admin/Session Events',
  component: RemoteSessionEventList,
  tags: ['autodocs'],
  args: { events, activeEventId: 'e3' },
} satisfies Meta<typeof RemoteSessionEventList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The list under the player, the event at the playhead highlighted. */
export const List: Story = {
  render: args => (
    <div className="w-[960px]">
      <RemoteSessionEventList {...args} />
    </div>
  ),
};

/** The marks over a stand-in track; picking a mark or a row moves the playhead. */
export const WithTrack: Story = {
  render: args => {
    const [positionMs, setPositionMs] = useState(52_000);
    const active = [...args.events].reverse().find(event => event.offsetMs <= positionMs);
    const seek = (event: RemoteSessionEvent) => setPositionMs(event.offsetMs);
    return (
      <div className="flex w-[960px] flex-col gap-[var(--spacing-system-l)]">
        <div className="flex flex-col gap-[var(--spacing-system-xxs)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-s)]">
          <RemoteSessionTimelineMarkers events={args.events} durationMs={DURATION_MS} onSelect={seek} />
          <div className="relative h-2 rounded-md border border-ods-border bg-ods-bg">
            <div
              className="absolute inset-y-0 left-0 rounded-md bg-ods-accent"
              style={{ width: `${(positionMs / DURATION_MS) * 100}%` }}
            />
          </div>
          <p className="text-ods-text-primary text-h4">
            {formatRemoteSessionOffset(positionMs)}{' '}
            <span className="text-ods-text-secondary">/ {formatRemoteSessionOffset(DURATION_MS)}</span>
          </p>
        </div>
        <RemoteSessionEventList events={args.events} activeEventId={active?.id} onSelect={seek} />
      </div>
    );
  },
};
