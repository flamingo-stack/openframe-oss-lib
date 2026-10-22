import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type React from 'react';
import { fn } from 'storybook/test';

import { RemoteSessionDialog, RemoteSessionScope } from '../components/features/remote-session';

/** The session's terminal dialogs, each shown by the desktop chat in its own 600 px window. */

function WindowDecorator(Story: React.ComponentType) {
  return (
    <RemoteSessionScope className="w-[600px]">
      <Story />
    </RemoteSessionScope>
  );
}

const meta = {
  title: 'Remote Session/Client/Dialogs',
  component: RemoteSessionDialog,
  tags: ['autodocs'],
  decorators: [WindowDecorator],
  args: {
    variant: 'end-confirm',
    organizationName: 'TechFlow Solutions',
    onEndSession: fn(),
    onClose: fn(),
  },
} satisfies Meta<typeof RemoteSessionDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** End Session from the block or the pill asks first. */
export const EndConfirm: Story = {};

/** The end call is in flight. */
export const Ending: Story = {
  args: { ending: true },
};

/** The technician (or the user) ended the session. */
export const SessionEnded: Story = {
  args: { variant: 'session-ended' },
};

/** The relay dropped: the session is over, there is no rejoin. */
export const ConnectionLost: Story = {
  args: { variant: 'connection-lost' },
};
