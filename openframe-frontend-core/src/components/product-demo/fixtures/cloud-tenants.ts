import type { TenantRow } from '../../features/cloud-tenants';
import type { DemoCast, DemoOrganization } from '../cast';
import { DEMO_NOW, demoMinutesAgo } from './shared';

function tenant(
  organization: DemoOrganization,
  provider: TenantRow['provider'],
  rest: Pick<TenantRow, 'accessState' | 'userCount' | 'unattributedUserCount' | 'lastReadAt' | 'licenses'>,
  /** Other customers the same directory serves. */
  sharedWith: readonly DemoOrganization[] = [],
): TenantRow {
  return {
    id: `tenant-${organization.id}-${provider}`,
    name: organization.name,
    provider,
    domain: organization.domain,
    customers: [organization, ...sharedWith].map(customer => ({ name: customer.name, imageUrl: customer.logoUrl })),
    ...rest,
  };
}

export interface CloudTenantsFixture {
  rows: TenantRow[];
  /** The clock "Last read" is relative to. */
  now: Date;
}

/**
 * The three customers' directories, a Microsoft 365 and a Google Workspace tenant each: all connected with write
 * access but one that lost its connection. Acme's Microsoft 365 directory also serves Harbor, and its rules leave a
 * few accounts to no customer.
 */
export function buildCloudTenantsFixture(cast: DemoCast): CloudTenantsFixture {
  return {
    rows: [
      tenant(
        cast.organization('acme'),
        'MICROSOFT_365',
        {
          accessState: 'WRITE_ENABLED',
          userCount: 212,
          unattributedUserCount: 14,
          licenses: { assigned: 198, purchased: 240, unused: 42 },
          lastReadAt: demoMinutesAgo(9),
        },
        [cast.organization('harbor')],
      ),
      tenant(cast.organization('northbridge'), 'GOOGLE_WORKSPACE', {
        accessState: 'WRITE_ENABLED',
        userCount: 48,
        licenses: { assigned: 48, purchased: null, unused: null },
        lastReadAt: demoMinutesAgo(15),
      }),
      tenant(cast.organization('harbor'), 'GOOGLE_WORKSPACE', {
        accessState: 'DISCONNECTED',
        userCount: 31,
        licenses: { assigned: 31, purchased: null, unused: null },
        lastReadAt: demoMinutesAgo(26 * 60),
      }),
      tenant(cast.organization('northbridge'), 'MICROSOFT_365', {
        accessState: 'WRITE_ENABLED',
        userCount: 52,
        licenses: { assigned: 50, purchased: 52, unused: 2 },
        lastReadAt: demoMinutesAgo(21),
      }),
      tenant(cast.organization('acme'), 'GOOGLE_WORKSPACE', {
        accessState: 'WRITE_ENABLED',
        userCount: 18,
        licenses: { assigned: 18, purchased: null, unused: null },
        lastReadAt: demoMinutesAgo(34),
      }),
      tenant(cast.organization('harbor'), 'MICROSOFT_365', {
        accessState: 'WRITE_ENABLED',
        userCount: 29,
        licenses: { assigned: 25, purchased: 30, unused: 5 },
        lastReadAt: demoMinutesAgo(47),
      }),
    ],
    now: new Date(DEMO_NOW),
  };
}
