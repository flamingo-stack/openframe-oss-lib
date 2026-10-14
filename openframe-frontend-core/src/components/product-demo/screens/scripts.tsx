'use client';

import { useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import {
  type RenderScheduleScriptSearch,
  type ScheduleFormData,
  ScheduleFormFields,
  ScheduleScriptSearchField,
  ScriptSchedulesTable,
  ScriptsTable,
} from '../../features/scripts';
import { useProductDemoCast } from '../cast';
import { buildScriptsFixture, type ScheduleFormFixture } from '../fixtures/scripts';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

/**
 * The picture has no row menu and nowhere to open a row. The library leaves out
 * who added a script: the picture is about what a script is and what runs it.
 */
const LIBRARY_COLUMNS_HIDDEN = ['authorId', 'open'];
const COMPACT_SCHEDULE_COLUMNS_HIDDEN = ['supportedPlatforms', 'deviceCount', 'open'];

/**
 * The product's "New Script Schedule" form with the fixture's schedule filled
 * in. It is the product's own fields in their densest arrangement: the name
 * beside the date, time and repeat, then the one script as one row. The note,
 * the trigger, the platforms and the offline rule are left out of the picture.
 * Nothing is saved and nothing is searched: "Select Script" offers the library
 * the table under it lists.
 */
function ScheduleFormPicture({ fixture }: { fixture: ScheduleFormFixture }) {
  const form = useForm<ScheduleFormData>({ defaultValues: fixture.values });
  const renderScriptSearch: RenderScheduleScriptSearch = field => (
    <ScheduleScriptSearchField
      scriptId={field.scriptId}
      name={field.name}
      scripts={fixture.scripts}
      onChange={noop}
      disabled={field.disabled}
    />
  );
  return (
    <FormProvider {...form}>
      <ScheduleFormFields
        showErrors={false}
        renderScriptSearch={renderScriptSearch}
        getTimeSlots={() => fixture.timeSlots}
        nameLayout="inline"
        showNote={false}
        showTrigger={false}
        showPlatforms={false}
        showOfflineBehavior={false}
        showScriptsHeading={false}
        showScriptParams={false}
        addScripts={false}
      />
    </FormProvider>
  );
}

/**
 * The product's Scripts pages, without their title rows and search fields (the
 * job is named above the picture): a schedule being set up, over the library
 * its script comes from (the frame cuts the library off after a few rows). The
 * narrow rendering is the schedules that result: what runs, when and how often.
 */
export default function ScriptsScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildScriptsFixture(cast), [cast]);

  if (compact) {
    return (
      <div className="h-full bg-ods-bg p-[var(--spacing-system-l)]">
        <ScriptSchedulesTable rows={fixture.schedules} hideColumns={COMPACT_SCHEDULE_COLUMNS_HIDDEN} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-[var(--spacing-system-l)] bg-ods-bg p-[var(--spacing-system-l)]">
      <ScheduleFormPicture fixture={fixture.scheduleForm} />
      <ScriptsTable rows={fixture.scripts} hideColumns={LIBRARY_COLUMNS_HIDDEN} />
    </div>
  );
}
