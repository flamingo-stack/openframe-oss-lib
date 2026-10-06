import type { KnowledgeBaseRow, KnowledgeBaseTableBodyProps } from '../../features/knowledge-base';
import { DEMO_DEVICES, DEMO_ORGANIZATIONS, DEMO_PEOPLE, demoMinutesAgo } from './shared';

const acme = DEMO_ORGANIZATIONS.acme.name;

const HOUR = 60;
const DAY = 24 * HOUR;

function folder(id: string, name: string): KnowledgeBaseRow {
  return { id, type: 'FOLDER', name, parentId: null };
}

function article(
  id: string,
  name: string,
  summary: string,
  createdMinutesAgo: number,
  rest: Pick<KnowledgeBaseRow, 'status' | 'tags'> = {},
): KnowledgeBaseRow {
  const createdAt = demoMinutesAgo(createdMinutesAgo);
  return {
    id,
    type: 'ARTICLE',
    name,
    summary,
    parentId: null,
    status: 'PUBLISHED',
    createdAt,
    updatedAt: createdAt,
    ...rest,
  };
}

/**
 * The knowledge base an MSP keeps for one client: folders first, then the
 * articles of the root, newest first. An article row carries a name, a summary,
 * a status and a created time; the table shows no author column, so the people
 * of the cast appear where a real summary would name them.
 */
export const KNOWLEDGE_FIXTURE: Required<Pick<KnowledgeBaseTableBodyProps, 'items' | 'totalCount'>> = {
  items: [
    folder('kb-folder-runbooks', 'Runbooks'),
    folder('kb-folder-vendors', 'Vendors and warranties'),
    article(
      'kb-new-laptop',
      'New laptop runbook',
      `How ${acme} sets up a laptop for a new hire: enrollment, disk encryption, the standard apps.`,
      35,
      { tags: [{ id: 'kb-tag-onboarding', key: 'onboarding' }] },
    ),
    article(
      'kb-offboarding',
      'Offboarding checklist',
      `Draft by ${DEMO_PEOPLE.dana.name}: accounts to close, devices to collect and wipe on a last day.`,
      3 * HOUR,
      { status: 'DRAFT' },
    ),
    article(
      'kb-wifi',
      'Office Wi-Fi setup',
      `Staff and guest networks at the ${acme} office, and how to join a new device to each.`,
      DAY + 2 * HOUR,
    ),
    article(
      'kb-network-diagram',
      'Network diagram',
      `Firewall, switches and access points, with ${DEMO_DEVICES.buildServer.hostname} and ${DEMO_DEVICES.reception.hostname} marked.`,
      3 * DAY,
    ),
    article(
      'kb-printer',
      'Front desk printer',
      `Driver, tray settings and the fix ${DEMO_PEOPLE.sam.name} uses when the queue stalls.`,
      6 * DAY,
    ),
    article(
      'kb-backup',
      'Backup and restore',
      'What is backed up every night, where it is kept and how to restore one file or a whole machine.',
      9 * DAY,
    ),
  ],
  totalCount: 8,
};
