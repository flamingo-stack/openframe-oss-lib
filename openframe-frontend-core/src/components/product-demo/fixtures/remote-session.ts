import type {
  RemoteDesktopChatPanelProps,
  RemoteDesktopViewProps,
  RemoteSessionChatMessage,
} from '../../features/remote-session';
import type { DemoCast } from '../cast';
import { DEMO_DEVICES, demoMinutesAgo } from './shared';

const device = DEMO_DEVICES.frontDesk;

function message(
  id: string,
  minutesAgo: number,
  rest: Omit<RemoteSessionChatMessage, 'id' | 'at'>,
): RemoteSessionChatMessage {
  return { id, at: new Date(demoMinutesAgo(minutesAgo)), ...rest };
}

export interface RemoteSessionFixture {
  view: Pick<
    RemoteDesktopViewProps,
    'deviceName' | 'organizationName' | 'currentDisplayLabel' | 'displayMenuGroups' | 'actionsMenuGroups'
  >;
  chat: Pick<RemoteDesktopChatPanelProps, 'messages' | 'technician'>;
  /** What the remote desktop itself shows. */
  desktop: { printer: string; clock: string; date: string };
}

/**
 * A connected session on the front desk laptop: the end user reports the
 * printer in the session chat, the technician restarts the spooler on the
 * remote desktop and says so. The technician's rows carry their portrait; the
 * end user's are a plain name, the way the product shows the other side.
 */
export function buildRemoteSessionFixture(cast: DemoCast): RemoteSessionFixture {
  const technician = cast.person('dana');
  const endUser = cast.person('leo');
  return {
    view: {
      deviceName: device.hostname,
      organizationName: cast.organization(device.organization).name,
      currentDisplayLabel: 'Display 1',
      displayMenuGroups: [],
      actionsMenuGroups: [],
    },
    chat: {
      technician: { name: technician.name, avatarUrl: technician.avatarUrl },
      messages: [
        message('rs-1', 6, { author: 'user', name: endUser.name, text: 'The front desk printer says offline again.' }),
        message('rs-2', 5, {
          author: 'technician',
          name: technician.name,
          text: 'On it. I am on your screen now, keep working.',
        }),
        message('rs-3', 2, {
          author: 'technician',
          name: technician.name,
          text: 'Print spooler restarted and a test page went through. Try it now.',
        }),
        message('rs-4', 1, { author: 'user', name: endUser.name, text: 'Printing. Thank you!' }),
      ],
    },
    desktop: { printer: 'Front Desk LaserJet', clock: '10:04 AM', date: '10/6/2026' },
  };
}
