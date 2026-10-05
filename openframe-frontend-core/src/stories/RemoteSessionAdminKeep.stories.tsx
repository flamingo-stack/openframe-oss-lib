import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';

import { KeepRecordingModal, ReleaseKeepingModal } from '../components/features/remote-session';

/**
 * Keep Recording holds a recording past its expiry date until someone releases
 * it; Release Keeping hands it back to the normal expiry.
 */
const meta = {
  title: 'Remote Session/Admin/Keep Recording',
  component: KeepRecordingModal,
  tags: ['autodocs'],
  args: {
    isOpen: true,
    onClose: fn(),
    keptUsage: '612 MB of 50 GB',
    onConfirm: fn(),
  },
} satisfies Meta<typeof KeepRecordingModal>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Pick a reason; "Other" asks for a short description. */
export const Keep: Story = {};

/** The Keep is being saved. */
export const Keeping: Story = {
  args: { isPending: true },
};

/** Releasing a recording already past its date: it gets 3 days' grace. */
export const Release: Story = {
  render: () => (
    <ReleaseKeepingModal
      isOpen
      onClose={fn()}
      onConfirm={fn()}
      keptBy="Dana Whitfield"
      keptOn="27 Jul 2026"
      reason="Client dispute"
      ticket="TKT-4631"
      expiresOn="3 Sep 2026"
      dueOn="31 Aug 2026"
    />
  ),
};

/** Releasing a recording that is still inside its retention period. */
export const ReleaseBeforeExpiry: Story = {
  render: () => (
    <ReleaseKeepingModal
      isOpen
      onClose={fn()}
      onConfirm={fn()}
      keptBy="Dana Whitfield"
      keptOn="27 Jul 2026"
      reason="Internal review"
      expiresOn="14 Sep 2026"
    />
  ),
};
