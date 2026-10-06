import type {
  RemoteDesktopChatPanelProps,
  RemoteDesktopViewProps,
  RemoteSessionChatMessage,
} from '../../features/remote-session';
import { DEMO_DEVICES, DEMO_ORGANIZATIONS, DEMO_PEOPLE, demoMinutesAgo } from './shared';

const device = DEMO_DEVICES.frontDesk;
const technician = DEMO_PEOPLE.dana;

function message(
  id: string,
  minutesAgo: number,
  rest: Omit<RemoteSessionChatMessage, 'id' | 'at'>,
): RemoteSessionChatMessage {
  return { id, at: new Date(demoMinutesAgo(minutesAgo)), ...rest };
}

/** The header of a connected session on the front desk laptop: one display, chat open. */
export const REMOTE_SESSION_VIEW_FIXTURE: Pick<
  RemoteDesktopViewProps,
  'deviceName' | 'organizationName' | 'currentDisplayLabel' | 'displayMenuGroups' | 'actionsMenuGroups'
> = {
  deviceName: device.hostname,
  organizationName: DEMO_ORGANIZATIONS[device.organization].name,
  currentDisplayLabel: 'Display 1',
  displayMenuGroups: [],
  actionsMenuGroups: [],
};

/** The session chat: the end user reports the printer, the technician fixes it. */
export const REMOTE_SESSION_CHAT_FIXTURE: Pick<RemoteDesktopChatPanelProps, 'messages' | 'technician'> = {
  technician: { name: technician.name },
  messages: [
    // The end user's rows carry no name: the product shows a plain "User".
    message('rs-1', 5, { author: 'user', text: 'Printer says offline again' }),
    message('rs-2', 1, { author: 'technician', name: technician.name, text: 'Fixed, try now' }),
  ],
};
