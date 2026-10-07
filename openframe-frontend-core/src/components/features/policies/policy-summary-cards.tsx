'use client';

import { formatRelativeTimeFrom } from '../../../utils/date-utils';
import { DashboardInfoCard } from '../../ui/dashboard-info-card';
import { Skeleton } from '../../ui/skeleton';
import type { PolicySummaryStats } from './compute-policy-summary';

/** What a card shows when there is no value to show. */
const EMPTY_VALUE = '—';

const CARD_SKELETON_KEYS = ['total', 'compliance', 'failed', 'updated'] as const;

export interface PolicySummaryCardsProps {
  summary: PolicySummaryStats;
  isLoading?: boolean;
  /**
   * Whether the summary describes loaded data. It decides the VALUES, never
   * whether the cards render: without data every card shows the empty mark,
   * because "Total Policies 0 / Failed 0" is an all-clear a failed load has
   * not earned.
   */
  hasData?: boolean;
  /** The clock "Updated" is relative to. Default: the moment of the render. */
  now?: Date;
}

/** The four counters above the fleet-wide policies table. */
export function PolicySummaryCards({ summary, isLoading = false, hasData = true, now }: PolicySummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 content-md:grid-cols-2 content-lg:grid-cols-4">
      {isLoading ? (
        // `h-16 content-md:h-[104px]` is `DashboardInfoCard`'s own height, so the
        // grid does not jump when the real cards replace the placeholders.
        CARD_SKELETON_KEYS.map(key => <Skeleton key={key} className="h-16 w-full content-md:h-[104px]" />)
      ) : (
        <>
          <DashboardInfoCard title="Total Policies" value={hasData ? summary.totalPolicies : EMPTY_VALUE} />
          <DashboardInfoCard
            title="Compliance Rate"
            value={
              hasData
                ? `${summary.compliantPolicies}/${summary.compliantPolicies + summary.failingPolicies}`
                : EMPTY_VALUE
            }
            percentage={hasData ? summary.compliantPoliciesPercentage : undefined}
            showProgress={hasData}
          />
          <DashboardInfoCard
            title="Failed Policies"
            value={hasData ? summary.failingPolicies : EMPTY_VALUE}
            percentage={hasData ? summary.failingPoliciesPercentage : undefined}
            showProgress={hasData}
            progressVariant="error"
          />
          <DashboardInfoCard
            title="Updated"
            value={
              hasData && summary.lastUpdatedAt
                ? formatRelativeTimeFrom(summary.lastUpdatedAt, now ?? new Date())
                : EMPTY_VALUE
            }
            valueClassName="!text-h3"
            tooltip="Policy compliance stats are updated hourly. View a policy's devices for real-time status."
          />
        </>
      )}
    </div>
  );
}
