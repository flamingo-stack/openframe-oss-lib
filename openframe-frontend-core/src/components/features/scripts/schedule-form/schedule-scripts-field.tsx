'use client';
'use no memo';

import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import { PlusCircleIcon } from '../../../icons-v2-generated/signs-and-symbols/plus-circle-icon';
import { Button } from '../../../ui/button';
import { SortableList } from '../../sortable-list/sortable-list';
import {
  EMPTY_SCHEDULE_SCRIPT_ROW,
  type RenderScheduleScriptSearch,
  type ScheduleFormData,
} from './schedule-form-types';
import { ScheduleScriptPickerCard } from './schedule-script-picker-card';

export interface ScheduleScriptsFieldProps {
  showErrors: boolean;
  disabled?: boolean;
  /** The "Select Script" field of each card. */
  renderScriptSearch: RenderScheduleScriptSearch;
  /** The "Scheduled Scripts" heading over the cards. Default true. */
  showHeading?: boolean;
  /** Each card's arguments and environment variables. Default true; false is one row per card. */
  showScriptParams?: boolean;
  /** Offer "Add Script" (several scripts in one schedule). Default true. */
  addScripts?: boolean;
}

/**
 * "Scheduled Scripts" — the ordered list of script cards. Card order IS the run
 * order: it is submitted as `scriptIds` verbatim, so a reorder is a real,
 * persisted change.
 *
 * Reordering runs on the core library's `SortableList` (Pragmatic drag and
 * drop): drag on desktop, an up/down button pair per card on touch/narrow
 * viewports, where no DnD is initialized at all. The list owns the live-region
 * announcements (`getItemLabel`) and the keyboard path on the handle.
 */
export function ScheduleScriptsField({
  showErrors,
  disabled = false,
  renderScriptSearch,
  showHeading = true,
  showScriptParams = true,
  addScripts = true,
}: ScheduleScriptsFieldProps) {
  const { control, getValues } = useFormContext<ScheduleFormData>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'scripts' });
  const supportedPlatforms = useWatch({ control, name: 'supportedPlatforms' });

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      {showHeading && (
        <div className="flex min-h-[72px] items-end pt-[var(--spacing-system-l)]">
          <h2 className="text-ods-text-primary text-h2">Scheduled Scripts</h2>
        </div>
      )}

      {/* Rows are keyed by the `useFieldArray` field id, stable across reorders
          and safe for duplicate scripts; the reorder itself is DOM-order based. */}
      <SortableList
        onReorder={move}
        disabled={disabled}
        getItemLabel={index => getValues(`scripts.${index}.name`) || `script ${index + 1}`}
        className="flex flex-col gap-[var(--spacing-system-lf)]"
      >
        {fields.map((field, index) => (
          <ScheduleScriptPickerCard
            key={field.id}
            index={index}
            count={fields.length}
            supportedPlatforms={supportedPlatforms}
            renderScriptSearch={renderScriptSearch}
            onRemove={() => remove(index)}
            canRemove={fields.length > 1}
            disabled={disabled}
            showErrors={showErrors}
            showParams={showScriptParams}
          />
        ))}
      </SortableList>

      {addScripts && (
        <Button
          type="button"
          variant="outline"
          size="small"
          onClick={() => append(EMPTY_SCHEDULE_SCRIPT_ROW)}
          disabled={disabled}
          className="self-start"
          leftIcon={<PlusCircleIcon className="text-ods-text-secondary" />}
        >
          Add Script
        </Button>
      )}
    </div>
  );
}
