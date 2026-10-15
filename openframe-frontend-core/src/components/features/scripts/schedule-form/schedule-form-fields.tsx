'use client';
'use no memo';

import { useCallback } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { useContentMdUp } from '../../../../hooks/ui/use-content-breakpoint';
import { OS_PLATFORMS, type OSPlatformOption } from '../../../../utils/os-platforms';
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { RadioGroupBlock } from '../../../ui/radio-group';
import { Textarea } from '../../../ui/textarea';
import { TruncateText } from '../../../ui/truncate-text';
import { SelectButton } from '../../select-button';
import type { ScheduleTimeReference } from './schedule-enums';
import {
  type RenderScheduleScriptSearch,
  SCHEDULE_TRIGGER_OPTIONS,
  type ScheduleFormData,
  type ScheduleFormGate,
  type ScheduleTimeSlot,
} from './schedule-form-types';
import { ScheduleOfflineFields } from './schedule-offline-fields';
import { ScheduleScriptsField } from './schedule-scripts-field';
import { ScheduleTimingFields } from './schedule-timing-fields';

export interface ScheduleFormFieldsProps {
  showErrors: boolean;
  /**
   * Locks every control. This is the edit page's loading state: the real fields,
   * in the geometry they will keep, with nothing in them yet — so there is no
   * placeholder to swap for them when the schedule lands.
   */
  disabled?: boolean;
  /**
   * The "Select Script" field of each script card. Searching the script library
   * is the host's query, so the field is a slot: the product passes its
   * data-bound search, a fixture a static one (both draw
   * `ScheduleScriptSearchField`).
   */
  renderScriptSearch: RenderScheduleScriptSearch;
  /** Whether the Timezone picker is offered: the host's flag, as a gate. Default `off`. */
  timeReferenceGate?: ScheduleFormGate;
  /** The platforms "Supported Platform" offers. Default: every OS platform. */
  platforms?: ReadonlyArray<OSPlatformOption>;
  /** Platform ids shown but not selectable yet ("Coming Soon"). Default none. */
  comingSoonPlatforms?: ReadonlyArray<string>;
  /** The Time dropdown's options; see `ScheduleTimingFields`. Default: the viewer's own clock. */
  getTimeSlots?: (date: Date | null, timeReference: ScheduleTimeReference) => ScheduleTimeSlot[];
  /**
   * `stacked` (default): the name is a row of its own, over the rest. `inline`:
   * on a wide form it sits beside the Date / Time / Repeat row, for a host that
   * shows only those (the sections between them hidden).
   */
  nameLayout?: 'stacked' | 'inline';
  /** The "Note" field. Default true. */
  showNote?: boolean;
  /** The trigger choice (on a schedule, or when a device comes online). Default true. */
  showTrigger?: boolean;
  /** "Supported Platform". Default true. */
  showPlatforms?: boolean;
  /** "If device is offline at scheduled time". Default true. */
  showOfflineBehavior?: boolean;
  /** The "Scheduled Scripts" heading over the script cards. Default true. */
  showScriptsHeading?: boolean;
  /** Each script card's arguments and environment variables. Default true. */
  showScriptParams?: boolean;
  /** Offer "Add Script". Default true; false is a form of the scripts it opens with. */
  addScripts?: boolean;
}

/**
 * Every field of the schedule form, in the order the design has them. Reads the
 * form off context, so the page around it only owns the chrome and the Save.
 *
 * The defaults are the product's page. The layout props are for a host that
 * shows the form in less room (a picture of it): fewer sections, and the name
 * beside the timing.
 */
export function ScheduleFormFields({
  showErrors,
  disabled = false,
  renderScriptSearch,
  timeReferenceGate = 'off',
  platforms = OS_PLATFORMS,
  comingSoonPlatforms = [],
  getTimeSlots,
  nameLayout = 'stacked',
  showNote = true,
  showTrigger = true,
  showPlatforms = true,
  showOfflineBehavior = true,
  showScriptsHeading = true,
  showScriptParams = true,
  addScripts = true,
}: ScheduleFormFieldsProps) {
  const { control, formState, getValues, setValue } = useFormContext<ScheduleFormData>();
  const isMdUp = useContentMdUp();
  const supportedPlatforms = useWatch({ control, name: 'supportedPlatforms' });

  const togglePlatform = useCallback(
    (platform: string) => {
      const current = getValues('supportedPlatforms');
      const has = current.includes(platform);
      // Allow deselecting any item, including the last one — the "at least one
      // platform" rule is enforced by validation on submit (mirrors the script form).
      setValue('supportedPlatforms', has ? current.filter(p => p !== platform) : [...current, platform], {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [getValues, setValue],
  );

  const nameField = (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
      <Label className="text-h4">Schedule Name</Label>
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <Input
            placeholder="Enter schedule name"
            value={field.value}
            onChange={field.onChange}
            disabled={disabled}
            className="w-full"
            error={showErrors ? fieldState.error?.message : undefined}
            invalid={showErrors && !!fieldState.error}
          />
        )}
      />
    </div>
  );

  // The min-1 error overlays the section gap below the row (same absolute
  // pattern as the script form) — no layout shift. `data-invalid`: the block
  // has no input of its own, so it carries the marker itself, which is what
  // `scrollToFirstInvalidField` looks for.
  const platformField = (
    <div
      className="relative flex flex-col gap-[var(--spacing-system-xxs)]"
      data-invalid={(showErrors && !!formState.errors.supportedPlatforms) || undefined}
    >
      <Label className="text-h4">Supported Platform</Label>
      <div className="grid grid-cols-2 gap-[var(--spacing-system-mf)] content-md:grid-cols-4">
        {platforms.map(platform => {
          const comingSoon = comingSoonPlatforms.includes(platform.id);
          return (
            <SelectButton
              key={platform.id}
              title={platform.name}
              icon={<platform.icon className="h-5 w-5" />}
              selected={!comingSoon && supportedPlatforms.includes(platform.id)}
              disabled={comingSoon || disabled}
              tag={comingSoon ? (isMdUp ? 'Coming Soon' : 'Soon') : undefined}
              onClick={comingSoon || disabled ? undefined : () => togglePlatform(platform.id)}
            />
          );
        })}
      </div>
      {showErrors && formState.errors.supportedPlatforms && (
        <div className="absolute bottom-0 left-0 right-0 translate-y-full">
          <TruncateText variant="h6" className="text-ods-error">
            {formState.errors.supportedPlatforms.message ?? ''}
          </TruncateText>
        </div>
      )}
    </div>
  );

  const timingFields = (
    <ScheduleTimingFields
      showErrors={showErrors}
      disabled={disabled}
      timeReferenceGate={timeReferenceGate}
      getTimeSlots={getTimeSlots}
    />
  );
  const nameInline = nameLayout === 'inline';

  return (
    <div className="flex flex-col gap-[var(--spacing-system-lf)]">
      {nameInline ? (
        <div className="flex flex-col gap-[var(--spacing-system-lf)] content-md:flex-row content-md:items-start">
          <div className="min-w-0 content-md:flex-1">{nameField}</div>
          <div className="min-w-0 content-md:flex-[3]">{timingFields}</div>
        </div>
      ) : (
        nameField
      )}

      {/* "Note" in the UI, `description` on the backend. */}
      {showNote && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <Label className="text-h4">Note</Label>
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <Textarea
                placeholder="Enter note here (optional)"
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
                className="min-h-[96px] w-full"
              />
            )}
          />
        </div>
      )}

      {/* What fires the schedule. DEVICE_ONLINE is event-driven and carries no
          timing, so picking it collapses the Date & Time row below. */}
      {showTrigger && (
        <Controller
          name="trigger"
          control={control}
          render={({ field }) => (
            <RadioGroupBlock
              variant="grouped"
              value={field.value}
              onValueChange={field.onChange}
              disabled={disabled}
              options={SCHEDULE_TRIGGER_OPTIONS}
            />
          )}
        />
      )}

      {showPlatforms && platformField}

      {!nameInline && timingFields}

      {/* Hangs off the same answer as the timing above it — "if device is
          offline at scheduled time" presupposes one — so it collapses for the
          event trigger too, and the two blocks animate together. */}
      {showOfflineBehavior && <ScheduleOfflineFields showErrors={showErrors} disabled={disabled} />}

      <ScheduleScriptsField
        showErrors={showErrors}
        disabled={disabled}
        renderScriptSearch={renderScriptSearch}
        showHeading={showScriptsHeading}
        showScriptParams={showScriptParams}
        addScripts={addScripts}
      />
    </div>
  );
}
