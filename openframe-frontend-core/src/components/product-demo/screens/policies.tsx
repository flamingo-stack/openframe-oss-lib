'use client';

import { PoliciesTable, PolicySummaryCards } from '../../features/policies';
import { DataTable } from '../../ui/data-table';
import { POLICIES_FIXTURE } from '../fixtures/policies';
import type { ProductScreenViewProps } from '../types';

/**
 * The product's fleet-wide Policies page without its title row and its empty
 * search field (the job is named above the picture): the compliance counters
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

  return (
    <div className="flex h-full flex-col gap-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]">
      {!compact && <PolicySummaryCards summary={POLICIES_FIXTURE.summary} now={POLICIES_FIXTURE.now} />}
      {table}
    </div>
  );
}
