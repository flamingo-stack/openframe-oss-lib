import { columnFromTicketStatus, type BoardColumnDef, type BoardTicket } from '../../features/board';
import { DEMO_DEVICES, DEMO_ORGANIZATIONS, DEMO_PEOPLE } from './shared';

function ticket(
  id: string,
  title: string,
  status: string,
  rest: Omit<BoardTicket, 'id' | 'title' | 'status' | 'ticketNumber'> & { ticketNumber?: string },
): BoardTicket {
  return { id, title, status, ticketNumber: rest.ticketNumber ?? '', ...rest };
}

const dana = { id: DEMO_PEOPLE.dana.id, name: DEMO_PEOPLE.dana.name, initials: DEMO_PEOPLE.dana.initials };

/** A help desk mid-morning: Fae opened and closed most of it, one ticket waits for an approval. */
export const TICKETS_BOARD_FIXTURE: BoardColumnDef[] = [
  columnFromTicketStatus('ACTIVE', [
    ticket('tk-1051', 'Printer offline at the front desk', 'ACTIVE', {
      ticketNumber: '1051',
      agent: 'fae',
      deviceHostnames: [DEMO_DEVICES.frontDesk.hostname],
      organizationName: DEMO_ORGANIZATIONS.harbor.name,
      priority: 'medium',
      hasNewMessage: true,
      activity: { kind: 'ai-working' },
    }),
    ticket('tk-1052', 'New hire starts Monday', 'ACTIVE', {
      ticketNumber: '1052',
      agent: 'mingo',
      organizationName: DEMO_ORGANIZATIONS.acme.name,
      priority: 'low',
      tags: ['onboarding'],
    }),
  ]),
  columnFromTicketStatus('TECH_REQUIRED', [
    ticket('tk-1049', 'Acrobat Pro for Maya', 'TECH_REQUIRED', {
      ticketNumber: '1049',
      agent: 'fae',
      deviceHostnames: [DEMO_DEVICES.mayaAir.hostname],
      organizationName: DEMO_ORGANIZATIONS.northbridge.name,
      priority: 'high',
      assignees: [dana],
      pendingApproval: {
        id: 'approval-1049',
        approvalType: 'INSTALL',
        explanation: 'Install Adobe Acrobat Pro (paid license)',
      },
    }),
  ]),
  columnFromTicketStatus('ON_HOLD', [
    ticket('tk-1046', 'Replace the conference room display', 'ON_HOLD', {
      ticketNumber: '1046',
      organizationName: DEMO_ORGANIZATIONS.acme.name,
      priority: 'low',
      assignees: [dana],
      activity: { kind: 'waiting-external' },
    }),
  ]),
  columnFromTicketStatus(
    'RESOLVED',
    [
      ticket('tk-1048', 'Slow laptop', 'RESOLVED', {
        ticketNumber: '1048',
        agent: 'fae',
        deviceHostnames: [DEMO_DEVICES.samT14.hostname],
        organizationName: DEMO_ORGANIZATIONS.northbridge.name,
      }),
      ticket('tk-1047', 'Teams will not open', 'RESOLVED', {
        ticketNumber: '1047',
        agent: 'fae',
        deviceHostnames: [DEMO_DEVICES.mayaAir.hostname],
        organizationName: DEMO_ORGANIZATIONS.northbridge.name,
      }),
      ticket('tk-1045', 'Turned the firewall back on', 'RESOLVED', {
        ticketNumber: '1045',
        agent: 'mingo',
        deviceHostnames: [DEMO_DEVICES.leoThinkPad.hostname],
        organizationName: DEMO_ORGANIZATIONS.harbor.name,
      }),
    ],
    { total: 14 },
  ),
];
