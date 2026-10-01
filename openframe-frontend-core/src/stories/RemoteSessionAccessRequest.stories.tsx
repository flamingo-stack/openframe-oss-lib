import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type React from 'react';
import { fn } from 'storybook/test';

import {
  RemoteAccessRequestCard,
  RemoteSessionScope,
  type RemoteSessionParty,
} from '../components/features/remote-session';

/**
 * The end user's consent dialog for a remote access request, shown by the
 * desktop chat in a 600 px always-on-top window. The host owns the request,
 * the delivery ack and the decision call; the card only renders and reports
 * the click.
 */

const party: RemoteSessionParty = {
  organizationName: 'TechFlow Solutions',
  organizationSiteUrl: 'https://www.techflow.com',
  technicianName: 'Mike Rodriguez',
};

function WindowDecorator(Story: React.ComponentType) {
  return (
    <RemoteSessionScope className="w-[600px]">
      <Story />
    </RemoteSessionScope>
  );
}

const meta = {
  title: 'Remote Session/Client/Access Request',
  component: RemoteAccessRequestCard,
  tags: ['autodocs'],
  decorators: [WindowDecorator],
  args: { party, onDecide: fn(), onOpenSite: fn() },
} satisfies Meta<typeof RemoteAccessRequestCard>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A recorded session: the recording notice above the consent line. */
export const Recorded: Story = {
  args: { showRecordingNotice: true },
};

/** Not recorded: no notice. */
export const NotRecorded: Story = {
  args: { showRecordingNotice: false },
};

/** No site and no logo: the OpenFrame mark, no website button. */
export const WithoutSite: Story = {
  args: { party: { organizationName: 'TechFlow Solutions' } },
};

/** A non-https site is shown but never offered as a link. */
export const PlainHttpSite: Story = {
  args: { party: { ...party, organizationSiteUrl: 'http://techflow.local' } },
};

/** Allow Access sent: both buttons lock, the chosen one spins. */
export const Allowing: Story = {
  args: { showRecordingNotice: true, deciding: 'APPROVED' },
};

/** The decision could not be sent: the error replaces the closing line. */
export const DecisionFailed: Story = {
  args: { showRecordingNotice: true, error: 'Could not reach the server. Try again.' },
};
