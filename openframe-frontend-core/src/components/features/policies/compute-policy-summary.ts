import type { PolicyTableStatus } from './policy-table-row';

/**
 * The host counts of a fleet-wide policy, as Fleet reports them. The product's
 * own `Policy` model satisfies this structurally.
 */
export interface PolicyHostCounts {
  passing_host_count: number;
  failing_host_count: number;
  host_count_updated_at?: string;
  hosts_include_any?: readonly unknown[];
}

export interface PolicySummaryStats {
  totalPolicies: number;
  failingPolicies: number;
  failingPoliciesPercentage: number;
  compliantPolicies: number;
  compliantPoliciesPercentage: number;
  lastUpdatedAt: string | null;
}

export type PolicyStatus = 'compliant' | 'failing' | 'pending' | 'partial';

export const POLICY_STATUS_CONFIG: Record<PolicyStatus, { label: string; variant: 'success' | 'error' | 'warning' }> = {
  compliant: { label: 'Compliant', variant: 'success' },
  failing: { label: 'Failing', variant: 'error' },
  pending: { label: 'Pending', variant: 'warning' },
  partial: { label: 'Partial', variant: 'warning' },
};

/** Targeted hosts that have not answered the policy yet. */
function missingHostCount(policy: PolicyHostCounts): number {
  const responded = policy.passing_host_count + policy.failing_host_count;
  return (policy.hosts_include_any?.length ?? 0) - responded;
}

export function getPolicyStatus(policy: PolicyHostCounts): PolicyStatus {
  const failing = policy.failing_host_count;
  const responded = policy.passing_host_count + failing;
  const missing = missingHostCount(policy);

  if (missing > 0 && responded === 0) return 'pending';
  if (missing > 0) return 'partial';
  if (failing > 0) return 'failing';
  return 'compliant';
}

/**
 * The STATUS cell of a fleet-wide policy: its status tag, plus how many devices
 * fail it or have not answered yet.
 */
export function getPolicyTableStatus(policy: PolicyHostCounts): PolicyTableStatus {
  const status = getPolicyStatus(policy);
  const config = POLICY_STATUS_CONFIG[status];
  const failing = policy.failing_host_count;
  const missing = missingHostCount(policy);

  let note: PolicyTableStatus['note'];
  if (status === 'partial' && missing > 0) {
    note = { text: `${missing} ${missing === 1 ? 'device' : 'devices'} left`, tone: 'warning' };
  } else if (status === 'failing') {
    note = { text: `${failing} ${failing === 1 ? 'device' : 'devices'}`, tone: 'error' };
  }

  return { label: config.label, variant: config.variant, note };
}

const EMPTY_SUMMARY: PolicySummaryStats = {
  totalPolicies: 0,
  failingPolicies: 0,
  failingPoliciesPercentage: 0,
  compliantPolicies: 0,
  compliantPoliciesPercentage: 0,
  lastUpdatedAt: null,
};

/**
 * Compute policy compliance summary from a list of policies.
 * Only policies with a definitive status (compliant or failing) are included
 * in compliance stats. Pending and partial policies are excluded.
 */
export function computePolicySummary(policies: readonly PolicyHostCounts[]): PolicySummaryStats {
  const totalPolicies = policies.length;
  if (totalPolicies === 0) return EMPTY_SUMMARY;

  let failingPolicies = 0;
  let compliantPolicies = 0;
  let latestUpdate: string | null = null;

  for (const policy of policies) {
    const status = getPolicyStatus(policy);

    if (status === 'compliant') {
      compliantPolicies++;
    } else if (status === 'failing') {
      failingPolicies++;
    }

    if (policy.host_count_updated_at && (!latestUpdate || policy.host_count_updated_at > latestUpdate)) {
      latestUpdate = policy.host_count_updated_at;
    }
  }

  const resolvedPolicies = compliantPolicies + failingPolicies;

  return {
    totalPolicies,
    failingPolicies,
    failingPoliciesPercentage: resolvedPolicies > 0 ? Math.round((failingPolicies / resolvedPolicies) * 100) : 0,
    compliantPolicies,
    compliantPoliciesPercentage: resolvedPolicies > 0 ? Math.round((compliantPolicies / resolvedPolicies) * 100) : 0,
    lastUpdatedAt: latestUpdate,
  };
}
