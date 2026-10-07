import {
  computePolicySummary,
  getPolicyTableStatus,
  type PolicyHostCounts,
  type PolicySummaryStats,
  type PolicyTableRow,
} from '../../features/policies';
import { DEMO_NOW, demoMinutesAgo } from './shared';

const noop = () => {};

/** The fleet the policies run on: every device of the demo's largest customer. */
const FLEET_SIZE = 213;
const FLEET_HOSTS: readonly unknown[] = Array.from({ length: FLEET_SIZE });

interface DemoPolicy extends PolicyHostCounts {
  id: string;
  name: string;
  description: string;
  critical: boolean;
}

function policy(id: string, name: string, description: string, critical: boolean, failing: number): DemoPolicy {
  return {
    id,
    name,
    description,
    critical,
    passing_host_count: FLEET_SIZE - failing,
    failing_host_count: failing,
    host_count_updated_at: demoMinutesAgo(12),
    hosts_include_any: FLEET_HOSTS,
  };
}

/** Seven laptops have fallen out of disk encryption; the other policies pass everywhere. */
const POLICIES: DemoPolicy[] = [
  policy(
    'policy-disk-encryption',
    'Disk encryption',
    'BitLocker on Windows and FileVault on macOS are turned on.',
    true,
    7,
  ),
  policy('policy-firewall', 'Firewall on', 'The system firewall is enabled on every device.', true, 0),
  policy('policy-screen-lock', 'Screen lock', 'The screen locks after five minutes without use.', false, 0),
  policy('policy-local-admins', 'No local admins', 'No everyday account is a local administrator.', false, 0),
];

export interface PoliciesFixture {
  summary: PolicySummaryStats;
  rows: PolicyTableRow[];
  /** The clock the "Updated" card is relative to. */
  now: Date;
}

/**
 * The product's fleet-wide policies page. The summary and every status cell
 * are computed from the host counts by the product's own functions.
 */
export const POLICIES_FIXTURE: PoliciesFixture = {
  summary: computePolicySummary(POLICIES),
  rows: POLICIES.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    critical: item.critical,
    severityLabel: item.critical ? 'Critical' : 'Low',
    status: getPolicyTableStatus(item),
    actions: [
      { label: 'Policy Details', onClick: noop },
      { label: 'Delete Policy', onClick: noop },
    ],
    href: '#',
  })),
  now: new Date(DEMO_NOW),
};
