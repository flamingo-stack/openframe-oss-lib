import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import {
  RemoteSessionExpiry,
  RemoteSessionStatusTag,
  RemoteSessionStorageAlert,
} from '../components/features/remote-session';

/**
 * How the Remote Sessions tab marks a session: its status beside the date, the
 * EXPIRES cell of its recording, and the banners shown while the tenant's
 * recording storage is full.
 */
const meta = {
  title: 'Remote Session/Admin/Status',
  component: RemoteSessionStatusTag,
  tags: ['autodocs'],
  args: { status: 'live' },
} satisfies Meta<typeof RemoteSessionStatusTag>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A session running right now; the dot pulses unless reduced motion is on. */
export const Live: Story = {};

/** The session ended and its recording is being stored. */
export const Processing: Story = {
  args: { status: 'processing' },
};

/** The recording is incomplete or could not be processed. */
export const Failed: Story = {
  args: { status: 'failed' },
};

/** The EXPIRES cell in each state, as the list rows show it. */
export const Expiry: Story = {
  render: () => (
    <div className="grid w-[320px] gap-[var(--spacing-system-l)]">
      <RemoteSessionExpiry state="kept" keptBy="Roman Smith" reason="Client dispute" />
      <RemoteSessionExpiry state="scheduled" date="09/29/26" remaining="Expires in 18 hours" />
      <RemoteSessionExpiry state="scheduled" date="10/01/26" />
      <RemoteSessionExpiry state="expired" />
      <RemoteSessionExpiry state="none" />
    </div>
  ),
};

/** Recording storage is full: the device page, and a session that runs unrecorded. */
export const StorageFull: Story = {
  render: () => (
    <div className="flex w-[960px] flex-col gap-[var(--spacing-system-l)]">
      <RemoteSessionStorageAlert scope="device" capacity="100 GB" />
      <RemoteSessionStorageAlert scope="session" />
    </div>
  ),
};
