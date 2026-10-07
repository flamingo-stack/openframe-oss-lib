import type { KnowledgeBaseArticleViewProps } from '../../features/knowledge-base';
import type { DemoCast } from '../cast';
import { DEMO_DEVICES } from './shared';

export interface KnowledgeFixture {
  article: Pick<KnowledgeBaseArticleViewProps, 'title' | 'tags' | 'author' | 'updatedLabel' | 'status'>;
  /** The article's body, in the markdown the product stores. */
  content: string;
}

/**
 * One article of a client's knowledge base, open: the runbook a technician (or
 * the assistant) follows to set up a new hire's laptop. It names the client,
 * its author and the steps, so the page says what the knowledge base is for.
 */
export function buildKnowledgeFixture(cast: DemoCast): KnowledgeFixture {
  const client = cast.organization('acme');
  const author = cast.person('dana');
  return {
    article: {
      title: `New laptop runbook: ${client.name}`,
      tags: [
        { id: 'kb-tag-client', label: client.name },
        { id: 'kb-tag-onboarding', label: 'onboarding' },
        { id: 'kb-tag-runbook', label: 'runbook' },
      ],
      author: { name: author.name, imageUrl: author.avatarUrl },
      updatedLabel: '10/06/2026',
      status: 'PUBLISHED',
    },
    content: [
      `How ${client.name} sets up a laptop for a new hire. Every step can be run by a technician or asked of the assistant.`,
      '',
      '## Before the first day',
      '',
      '1. **Enroll the laptop.** Sign in with the enrollment account. It appears in Devices within a minute.',
      '2. **Turn on disk encryption.** The "Disk encryption" policy does it. Check that the recovery key is saved.',
      '3. **Install the standard apps.** Chrome, Slack, Microsoft 365 and the VPN client from the software catalog.',
      `4. **Create the accounts.** Mailbox, groups and MFA in the ${client.name} Microsoft 365 tenant.`,
      '',
      '## On the first day',
      '',
      `1. **Join the office Wi-Fi.** Staff network only. The guest network is for visitors.`,
      `2. **Add the printers.** Front desk and second floor, the same drivers as ${DEMO_DEVICES.reception.hostname}.`,
      '3. **Hand over.** Sign in together once and close the onboarding ticket.',
    ].join('\n'),
  };
}
