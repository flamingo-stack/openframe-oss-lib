'use client';

import { PoliciesTable, PolicySummaryCards } from '../../features/policies';
import { DataTable } from '../../ui/data-table';
import { POLICIES_FIXTURE } from '../fixtures/policies';
import type { ProductScreenViewProps } from '../types';

/**
 * The product's fleet-wide Policies page without its title row and its empty
 * search field (the job is named above the picture): the compliance counters
 * and the table. The narrow rendering is the table alone.
 *
 * The wide table is the product's grid, its count in the grid's line above
 * it. The narrow rendering (a carousel card, a phone's or a tablet's width)
 * keeps the card rows: the grid would be cut past the card's edge, and a
 * picture cannot scroll.
 */
export default function PoliciesScreen({ compact = false }: ProductScreenViewProps) {
  const table = (
    <PoliciesTable
      rows={POLICIES_FIXTURE.rows}
      rowAsLink
      rightSlot={compact ? undefined : <DataTable.RowCount />}
      emptyMessage="No policies found."
      layout={compact ? 'cards' : 'grid'}
    />
  );

  return (
    <div className="flex h-full flex-col gap-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]">
      {!compact && <PolicySummaryCards summary={POLICIES_FIXTURE.summary} now={POLICIES_FIXTURE.now} />}
      {table}
    </div>
  );
}
