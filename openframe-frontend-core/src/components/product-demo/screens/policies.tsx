'use client';

import { PoliciesTable, PolicySummaryCards } from '../../features/policies';
import { PlusCircleIcon } from '../../icons-v2-generated';
import { SearchIcon } from '../../icons-v2-generated/interface/search-icon';
import { PageLayout } from '../../layout/page-layout';
import { DataTable } from '../../ui/data-table';
import { Input } from '../../ui/input';
import type { PageActionButton } from '../../ui/page-actions';
import { POLICIES_FIXTURE } from '../fixtures/policies';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

/** The page action of the product's Policies tab. */
const PAGE_ACTIONS: PageActionButton[] = [
  {
    label: 'Add Policy',
    variant: 'outline',
    icon: <PlusCircleIcon size={24} className="text-ods-text-secondary" />,
    onClick: noop,
  },
];

/**
 * The product's fleet-wide Policies page: the compliance counters, the search
 * and the table. The narrow rendering is the table alone.
 */
export default function PoliciesScreen({ compact = false }: ProductScreenViewProps) {
  const table = (
    <PoliciesTable
      rows={POLICIES_FIXTURE.rows}
      rowAsLink
      rightSlot={compact ? undefined : <DataTable.RowCount />}
      emptyMessage="No policies found."
    />
  );

  if (compact) {
    return <div className="h-full bg-ods-bg p-[var(--spacing-system-l)]">{table}</div>;
  }

  return (
    <div className="h-full bg-ods-bg">
      <PageLayout
        title="Policies"
        actions={PAGE_ACTIONS}
        className="px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]"
      >
        <PolicySummaryCards summary={POLICIES_FIXTURE.summary} now={POLICIES_FIXTURE.now} />
        <Input placeholder="Search for Policies" value="" onChange={noop} startAdornment={<SearchIcon />} />
        {table}
      </PageLayout>
    </div>
  );
}
