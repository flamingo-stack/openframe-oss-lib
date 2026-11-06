'use client';
'use no memo';

import { Controller, useFormContext } from 'react-hook-form';
import { useContentMdUp } from '../../../../hooks/ui/use-content-breakpoint';
import { DraggerIcon } from '../../../icons-v2-generated/interface/dragger-icon';
import { TrashIcon } from '../../../icons-v2-generated/interface/trash-icon';
import { ScriptArguments } from '../../../platform/ScriptArguments';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../../ui/accordion';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { SortableMoveButtons } from '../../sortable-list/sortable-move-buttons';
import { useSortableItem } from '../../sortable-list/use-sortable-item';
import {
  EMPTY_SCHEDULE_SCRIPT_ROW,
  type RenderScheduleScriptSearch,
  type ScheduleFormData,
  type ScheduleFormScriptRow,
} from './schedule-form-types';

/** Sentinel for "no script picked yet" — the field is locked and renders empty. */
const UNSET_TIMEOUT = 0;

interface ScheduleScriptPickerCardProps {
  index: number;
  /** How many cards the list has — disables the move buttons at the ends. */
  count: number;
  /** UI platform ids the schedule targets — what the host narrows its script search by. */
  supportedPlatforms: string[];
  /** The card's "Select Script" field: the host's search over its script library. */
  renderScriptSearch: RenderScheduleScriptSearch;
  onRemove: () => void;
  canRemove: boolean;
  disabled?: boolean;
  /**
   * Controls inline error visibility — the parent flips this true once the
   * user attempts Save, so errors stay hidden on a pristine form (mirrors
   * `ScriptFormFields.showErrors`).
   */
  showErrors?: boolean;
  /**
   * The script's arguments and environment variables under the first row.
   * Default true; false is the card as one row (the script and its timeout).
   */
  showParams?: boolean;
}

/**
 * One card of the schedule's ordered script list: drag handle, script
 * autocomplete, timeout and the script's arguments / environment variables.
 *
 * **Order is the payload.** The card index IS the run order — the backend
 * stores `scriptIds: [ID!]` in run order, so reordering rewrites that array.
 *
 * Sorting runs on the core library's `SortableList` (`useSortableItem`), the
 * same Pragmatic stack the ticket board uses. Only the handle starts a drag,
 * so text selection inside the fields keeps working, and the handle carries
 * the keyboard path (Arrow Up / Arrow Down, one press one move) with
 * live-region announcements wired up by the list. On touch/narrow viewports
 * no drag exists at all — an up/down button pair renders beside the delete
 * button instead.
 *
 * Arguments and env vars ARE persisted, as this schedule's per-script override
 * (`scriptCustomParams`): they seed from the picked script's defaults, and only
 * a half the user moves off those defaults is written back — so leaving a card
 * untouched keeps the schedule following later edits to the script itself.
 *
 * ⚠ **Timeout is still editable but not persisted**: the override input carries
 * args and env vars only. It is
 * seeded from the script's own default, which is what the run actually uses, so
 * the card shows the truth — it just cannot be changed per schedule yet.
 */
export function ScheduleScriptPickerCard({
  index,
  count,
  supportedPlatforms,
  renderScriptSearch,
  onRemove,
  canRemove,
  disabled = false,
  showErrors = true,
  showParams = true,
}: ScheduleScriptPickerCardProps) {
  const { control, setValue, watch } = useFormContext<ScheduleFormData>();
  const selected = watch(`scripts.${index}`);

  // Timeout / arguments / env vars all belong to the picked script and are
  // seeded from it, so they stay locked until there is a script to belong to.
  const runParamsLocked = disabled || !selected?.scriptId;

  const { itemRef, dragHandleProps, isDragging, dragAndDropEnabled } = useSortableItem();
  // Mobile folds the args/env editors into accordions; `undefined` (SSR/first
  // render) keeps the expanded variant and settles before first paint.
  const isMdUp = useContentMdUp();

  const handleScriptPick = (row: ScheduleFormScriptRow | null) => {
    if (!row) {
      // Back to the locked state: the run parameters belong to the script, so
      // clearing the script clears them rather than leaving a stale timeout.
      setValue(`scripts.${index}`, EMPTY_SCHEDULE_SCRIPT_ROW, { shouldValidate: true });
      return;
    }
    // The row the host seeds from the script itself — that IS what the
    // schedule will run with, so the card never shows blanks for a real script.
    // A freshly picked script therefore starts UNCUSTOMISED: the defaults ride
    // along beside the editable copy, and submit writes an override only for a
    // half the user actually moved off them.
    setValue(`scripts.${index}`, row, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div
      ref={itemRef}
      // No inline style here — the list writes `transform` straight onto this
      // node during a drag (see `SortableList`).
      className={`flex flex-col gap-[var(--spacing-system-sf)] rounded-[6px] border bg-ods-bg p-[var(--spacing-system-l)] content-md:gap-[var(--spacing-system-lf)] ${
        isDragging ? 'relative z-10 border-ods-accent shadow-lg' : 'border-ods-border'
      }`}
    >
      {/* Touch (no DnD): the mock stacks the rows on every width and puts the
          move buttons + delete in the Select Script row, spaced by a fixed 8px;
          with DnD the approved desktop layout stays — handle beside the select,
          delete beside the timeout, the two halves side by side from md. */}
      <div
        className={`flex flex-col gap-[var(--spacing-system-sf)] content-md:gap-[var(--spacing-system-lf)] ${dragAndDropEnabled ? 'content-md:flex-row content-md:items-end' : ''}`}
      >
        <div
          className={`flex min-w-0 flex-1 items-end ${
            dragAndDropEnabled ? 'gap-[var(--spacing-system-xs)]' : 'gap-[var(--spacing-system-xsf)]'
          }`}
        >
          {dragAndDropEnabled && (
            <Button
              variant="bare"
              size="icon"
              type="button"
              {...dragHandleProps}
              disabled={disabled}
              aria-label={`Reorder ${selected?.name || `script ${index + 1}`}`}
              className={`shrink-0 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <DraggerIcon size={24} />
            </Button>
          )}

          <Controller
            name={`scripts.${index}.scriptId`}
            control={control}
            render={({ fieldState }) => (
              <>
                {renderScriptSearch({
                  scriptId: selected?.scriptId ?? '',
                  name: selected?.name ?? '',
                  supportedPlatforms,
                  onPick: handleScriptPick,
                  disabled,
                  error: showErrors ? fieldState.error?.message : undefined,
                  invalid: showErrors && !!fieldState.error,
                })}
              </>
            )}
          />

          {!dragAndDropEnabled && (
            <>
              <SortableMoveButtons index={index} count={count} label={selected?.name || `script ${index + 1}`} />
              <Button
                variant="outline"
                size="icon"
                onClick={onRemove}
                disabled={!canRemove || disabled}
                aria-label="Remove script from schedule"
                className="text-ods-error disabled:opacity-30"
              >
                <TrashIcon size={20} />
              </Button>
            </>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-end gap-[var(--spacing-system-xs)]">
          <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
            <Label className="text-h4">Timeout</Label>
            <Controller
              name={`scripts.${index}.timeoutSeconds`}
              control={control}
              render={({ field, fieldState }) => (
                // Locked until a script is picked: the timeout belongs to the
                // script, so the field stays EMPTY until there is one — the
                // sentinel is a "nothing here yet" marker, and rendering it as
                // a literal 0 would read as a real (and invalid) timeout.
                // Picking a script writes its own timeout in.
                <Input
                  type="number"
                  min={1}
                  className="w-full"
                  value={field.value ? String(field.value) : ''}
                  onChange={e => field.onChange(e.target.value ? Number(e.target.value) : UNSET_TIMEOUT)}
                  disabled={runParamsLocked}
                  endAdornment={<span className="text-ods-text-secondary text-h6">Seconds</span>}
                  error={showErrors ? fieldState.error?.message : undefined}
                  invalid={showErrors && !!fieldState.error}
                />
              )}
            />
          </div>

          {dragAndDropEnabled && (
            <Button
              variant="outline"
              size="icon"
              onClick={onRemove}
              disabled={!canRemove || disabled}
              aria-label="Remove script from schedule"
              className="text-ods-error disabled:opacity-30"
            >
              <TrashIcon size={20} />
            </Button>
          )}
        </div>
      </div>

      {/* Arguments / env vars are the same class of field as Timeout — they
          belong to the picked script and are seeded from it — so they stay
          locked until there is a script to belong to.
          Mobile folds the two editors into "Edit Default …" accordions (per the
          mock); from md up they stay expanded side by side. The editors are the
          only difference — both branches render the same controlled fields. */}
      {!showParams ? null : isMdUp === false ? (
        <Accordion type="multiple" className="overflow-hidden rounded-[6px] border border-ods-border">
          <AccordionItem value="args" className="border-ods-border data-[state=closed]:bg-ods-card">
            <AccordionTrigger className="h-14 px-[var(--spacing-system-sf)] py-0 text-ods-text-primary text-h6 hover:no-underline [&>svg]:text-ods-text-secondary">
              Edit Default Script Arguments
            </AccordionTrigger>
            {/* The editor's own title would duplicate the trigger — an empty
                titleLabel renders an empty <label>, hidden by :empty. */}
            <AccordionContent className="px-[var(--spacing-system-sf)] [&_label:empty]:hidden">
              <Controller
                name={`scripts.${index}.args`}
                control={control}
                render={({ field }) => (
                  <ScriptArguments
                    arguments={field.value}
                    onArgumentsChange={field.onChange}
                    keyPlaceholder="Key"
                    valuePlaceholder="Enter Value (empty=flag)"
                    addButtonLabel="Add Script Argument"
                    titleLabel=""
                    disabled={runParamsLocked}
                  />
                )}
              />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="env" className="border-b-0 border-ods-border data-[state=closed]:bg-ods-card">
            <AccordionTrigger className="h-14 px-[var(--spacing-system-sf)] py-0 text-ods-text-primary text-h6 hover:no-underline [&>svg]:text-ods-text-secondary">
              Edit Default Environment Vars
            </AccordionTrigger>
            <AccordionContent className="px-[var(--spacing-system-sf)] [&_label:empty]:hidden">
              <Controller
                name={`scripts.${index}.envVars`}
                control={control}
                render={({ field }) => (
                  <ScriptArguments
                    arguments={field.value}
                    onArgumentsChange={field.onChange}
                    keyPlaceholder="Key"
                    valuePlaceholder="Enter Value"
                    addButtonLabel="Add Environment Var"
                    addSecretButtonLabel="Add Secret"
                    titleLabel=""
                    disabled={runParamsLocked}
                  />
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : (
        <div className="flex flex-col items-start gap-[var(--spacing-system-lf)] content-md:flex-row">
          <div className="w-full min-w-0 flex-1">
            <Controller
              name={`scripts.${index}.args`}
              control={control}
              render={({ field }) => (
                <ScriptArguments
                  arguments={field.value}
                  onArgumentsChange={field.onChange}
                  keyPlaceholder="Key"
                  valuePlaceholder="Enter Value (empty=flag)"
                  addButtonLabel="Add Script Argument"
                  titleLabel="Script Arguments"
                  labelVariant="large"
                  disabled={runParamsLocked}
                />
              )}
            />
          </div>
          <div className="w-full min-w-0 flex-1">
            <Controller
              name={`scripts.${index}.envVars`}
              control={control}
              render={({ field }) => (
                <ScriptArguments
                  arguments={field.value}
                  onArgumentsChange={field.onChange}
                  keyPlaceholder="Key"
                  valuePlaceholder="Enter Value"
                  addButtonLabel="Add Environment Var"
                  addSecretButtonLabel="Add Secret"
                  titleLabel="Environment Vars"
                  labelVariant="large"
                  disabled={runParamsLocked}
                />
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
