import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { RemoteSessionBorder, RemoteSessionPill, RemoteSessionScope } from '../components/features/remote-session';

/**
 * The always-visible "your screen is being controlled" indicator: the yellow
 * border around every screen and the End Session pill hanging from its top
 * edge. The desktop chat draws each in its own click-through window.
 */

const meta = {
  title: 'Remote Session/Client/Screen Indicator',
  component: RemoteSessionPill,
  tags: ['autodocs'],
  args: { onEndSession: fn() },
  decorators: [
    Story => (
      <RemoteSessionScope>
        <Story />
      </RemoteSessionScope>
    ),
  ],
} satisfies Meta<typeof RemoteSessionPill>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The pill on its own. */
export const Pill: Story = {};

/** Border and pill together, on a screen-sized stand-in. */
export const Screen: Story = {
  render: args => (
    <div className="relative h-[360px] w-[640px] bg-ods-bg">
      <div className="absolute inset-0">
        <RemoteSessionBorder />
      </div>
      <div className="absolute inset-x-0 top-0 flex justify-center">
        <RemoteSessionPill {...args} />
      </div>
    </div>
  ),
};
