'use client';

import { type ReactNode, useMemo } from 'react';
import { SCRIPTS_TABS, ScriptSchedulesTable, type ScriptsTabId, ScriptsTable } from '../../features/scripts';
import { useProductDemoCast } from '../cast';
import { buildScriptsFixture } from '../fixtures/scripts';
import type { ProductScreenViewProps } from '../types';

/**
 * The picture has no row menu and nowhere to open a row. Each table gets half
 * the frame, so the library leaves out who added a script and keeps the room
 * for its name and what it does.
 */
const LIBRARY_COLUMNS_HIDDEN = ['authorId', 'open'];
const SCHEDULE_COLUMNS_HIDDEN = ['supportedPlatforms', 'open'];
const COMPACT_SCHEDULE_COLUMNS_HIDDEN = ['supportedPlatforms', 'deviceCount', 'open'];

/** One of the two Scripts pages, under the name and icon its tab carries in the product. */
function ScriptsPanel({ tab, children }: { tab: ScriptsTabId; children: ReactNode }) {
  const item = SCRIPTS_TABS.find(candidate => candidate.id === tab);
  const Icon = item?.icon;
  return (
    <section className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-s)]">
      <h3 className="flex items-center gap-[var(--spacing-system-xs)] text-ods-text-secondary text-h5">
        {Icon && <Icon className="h-5 w-5" />}
        {item?.label}
      </h3>
      {children}
    </section>
  );
}

/**
 * The product's two Scripts pages side by side, without their title rows and
 * search fields (the job is named above the picture): the library a team
 * keeps, and the schedules that run it across the fleet. The narrow rendering
 * is the schedules alone: what runs, when and how often.
 */
export default function ScriptsScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildScriptsFixture(cast), [cast]);

  const schedules = (
    <ScriptSchedulesTable
      rows={fixture.schedules}
      hideColumns={compact ? COMPACT_SCHEDULE_COLUMNS_HIDDEN : SCHEDULE_COLUMNS_HIDDEN}
    />
  );

  if (compact) return <div className="h-full bg-ods-bg p-[var(--spacing-system-l)]">{schedules}</div>;

  return (
    <div className="flex h-full gap-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]">
      <ScriptsPanel tab="list">
        <ScriptsTable rows={fixture.scripts} hideColumns={LIBRARY_COLUMNS_HIDDEN} />
      </ScriptsPanel>
      <ScriptsPanel tab="schedules">{schedules}</ScriptsPanel>
    </div>
  );
}
