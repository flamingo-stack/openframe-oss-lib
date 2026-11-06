import type { TenantRow } from '../../features/cloud-tenants';
import type { DemoCast, DemoOrganization } from '../cast';
import { DEMO_NOW, demoMinutesAgo } from './shared';

function tenant(
  organization: DemoOrganization,
  provider: TenantRow['provider'],
  rest: Pick<TenantRow, 'accessState' | 'userCount' | 'lastReadAt'>,
): TenantRow {
  return {
    id: `tenant-${organization.id}-${provider}`,
    name: organization.name,
    provider,
    domain: organization.domain,
    customer: { name: organization.name, imageUrl: organization.logoUrl },
    ...rest,
  };
}

export interface CloudTenantsFixture {
  rows: TenantRow[];
  /** The clock "Last read" is relative to. */
  now: Date;
}

/** The three customers' directories, a Microsoft 365 and a Google Workspace tenant each: all connected with write access but one that lost its connection. */
export function buildCloudTenantsFixture(cast: DemoCast): CloudTenantsFixture {
  return {
    rows: [
      tenant(cast.organization('acme'), 'MICROSOFT_365', {
        accessState: 'WRITE_ENABLED',
        userCount: 212,
        lastReadAt: demoMinutesAgo(9),
      }),
      tenant(cast.organization('northbridge'), 'GOOGLE_WORKSPACE', {
        accessState: 'WRITE_ENABLED',
        userCount: 48,
        lastReadAt: demoMinutesAgo(15),
      }),
      tenant(cast.organization('harbor'), 'GOOGLE_WORKSPACE', {
        accessState: 'DISCONNECTED',
        userCount: 31,
        lastReadAt: demoMinutesAgo(26 * 60),
      }),
      tenant(cast.organization('northbridge'), 'MICROSOFT_365', {
        accessState: 'WRITE_ENABLED',
        userCount: 52,
        lastReadAt: demoMinutesAgo(21),
      }),
      tenant(cast.organization('acme'), 'GOOGLE_WORKSPACE', {
        accessState: 'WRITE_ENABLED',
        userCount: 18,
        lastReadAt: demoMinutesAgo(34),
      }),
      tenant(cast.organization('harbor'), 'MICROSOFT_365', {
        accessState: 'WRITE_ENABLED',
        userCount: 29,
        lastReadAt: demoMinutesAgo(47),
      }),
    ],
    now: new Date(DEMO_NOW),
  };
}
