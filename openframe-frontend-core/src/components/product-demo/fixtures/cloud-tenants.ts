import type { TenantRow } from '../../features/cloud-tenants';
import { DEMO_NOW, DEMO_ORGANIZATIONS, demoMinutesAgo } from './shared';

type DemoOrganization = (typeof DEMO_ORGANIZATIONS)[keyof typeof DEMO_ORGANIZATIONS];

function tenant(
  organization: DemoOrganization,
  provider: TenantRow['provider'],
  rest: Pick<TenantRow, 'accessState' | 'userCount' | 'lastReadAt'>,
): TenantRow {
  return {
    id: `tenant-${organization.id}`,
    name: organization.name,
    provider,
    domain: organization.domain,
    customer: { name: organization.name },
    ...rest,
  };
}

export interface CloudTenantsFixture {
  rows: TenantRow[];
  /** The clock "Last read" is relative to. */
  now: Date;
}

/** Three customers' directories: two connected with write access, one that lost its connection. */
export const CLOUD_TENANTS_FIXTURE: CloudTenantsFixture = {
  rows: [
    tenant(DEMO_ORGANIZATIONS.acme, 'MICROSOFT_365', {
      accessState: 'WRITE_ENABLED',
      userCount: 212,
      lastReadAt: demoMinutesAgo(9),
    }),
    tenant(DEMO_ORGANIZATIONS.northbridge, 'GOOGLE_WORKSPACE', {
      accessState: 'WRITE_ENABLED',
      userCount: 48,
      lastReadAt: demoMinutesAgo(15),
    }),
    tenant(DEMO_ORGANIZATIONS.harbor, 'GOOGLE_WORKSPACE', {
      accessState: 'DISCONNECTED',
      userCount: null,
      lastReadAt: null,
    }),
  ],
  now: new Date(DEMO_NOW),
};
