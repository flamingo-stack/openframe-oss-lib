'use client';
'use no memo';

import { useController, useFormContext, useWatch } from 'react-hook-form';
import { cn } from '../../../../utils/cn';
import { Label } from '../../../ui/label';
import { RadioGroupBlock } from '../../../ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { TruncateText } from '../../../ui/truncate-text';
import { type ScheduleFormData, SCHEDULE_OFFLINE_BEHAVIOR_OPTIONS } from './schedule-form-types';
import { ScheduleIntervalInput } from './schedule-interval-input';
import {
  DURATION_UNIT_OPTIONS,
  type DurationUnit,
  isEventTrigger,
  isRetryOnReconnect,
  MIN_RECONNECT_MINUTES,
  snapReconnectInterval,
} from './schedule-timing';

interface ReconnectWindowFieldsProps {
  interval: number | null;
  unit: DurationUnit;
  onIntervalChange: (next: number | null) => void;
  onIntervalBlur: () => void;
  onUnitChange: (next: DurationUnit) => void;
  disabled: boolean;
  invalid: boolean;
  /**
   * Let the two controls share the width they are given instead of taking the
   * design's fixed 120px each — what the full-width row below `md` needs, where
   * the fixed pair plus its caption overflows a phone.
   */
  fluid?: boolean;
  className?: string;
}

/**
 * "Stop Retry after [1] [Week]" — how long a queued run stays worth running.
 *
 * Presentational and stateless: the two form fields are registered ONCE by the
 * block below and handed down, because this renders TWICE (see the two call
 * sites). Two `Controller`s on one name would also work, but one registration
 * with two views is the honest description of what this is.
 */
function ReconnectWindowFields({
  interval,
  unit,
  onIntervalChange,
  onIntervalBlur,
  onUnitChange,
  disabled,
  invalid,
  fluid = false,
  className,
}: ReconnectWindowFieldsProps) {
  const controlWidth = fluid ? 'flex-1 min-w-0' : 'w-[120px]';
  return (
    <div className={cn('flex items-center gap-[var(--spacing-system-xsf)]', className)}>
      <span className={cn('shrink-0 text-h4', disabled ? 'text-ods-text-disabled' : 'text-ods-text-secondary')}>
        Stop Retry after
      </span>
      <ScheduleIntervalInput
        min={unit === 'minute' ? MIN_RECONNECT_MINUTES : 1}
        aria-label="Stop retry after"
        className={controlWidth}
        value={interval}
        onChange={onIntervalChange}
        onBlur={onIntervalBlur}
        // Where a failed Save should land. Without it the section marker below
        // hands focus to its first focusable descendant, which is the "Skip
        // this Run" radio — three controls away from the value to fix.
        data-invalid-focus
        disabled={disabled}
        invalid={invalid}
      />
      {/* Switching to minutes drags the interval up to the floor with it: "1 Day"
          would otherwise read "1 Minute", a value the user never typed and the
          form cannot save. Coarser units clear the floor by construction. */}
      <Select value={unit} onValueChange={(next: DurationUnit) => onUnitChange(next)} disabled={disabled}>
        <SelectTrigger className={controlWidth} aria-label="Stop retry after unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DURATION_UNIT_OPTIONS.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * "If device is offline at scheduled time" — Skip this Run vs Run when device
 * comes back online, plus the reconnect window the second one needs
 * (design node 460:63425).
 *
 * Maps to `offlineBehavior` (`SKIP` | `RETRY_ON_RECONNECT`) and
 * `reconnectWindowSeconds`. The window is submitted ONLY alongside
 * RETRY_ON_RECONNECT — the schema documents it as "set only when offlineBehavior
 * is RETRY_ON_RECONNECT" — which is also why it is required rather than
 * optional-meaning-forever: nothing in the contract says a null window queues a
 * run indefinitely, so the form never offers a reading it cannot back up.
 *
 * The block presupposes a scheduled time the device can be absent FOR, so it
 * collapses for DEVICE_ONLINE — which fires on the reconnect already — and
 * submits the SKIP default instead of what the collapsed controls hold.
 * DEVICE_LOCAL keeps it: its scheduled moment is the device's own wall clock.
 *
 * It collapses with the `0fr → 1fr` grid-rows technique, staying MOUNTED so
 * toggling the trigger back restores what was picked, `inert` to drop the
 * collapsed controls out of the tab order, and a padding/negative-margin pair:
 * the bottom padding is the room the absolutely-positioned error renders into,
 * and the constant negative margin cancels it so a collapsed block leaves no
 * hole.
 */
export function ScheduleOfflineFields({ showErrors, disabled = false }: { showErrors: boolean; disabled?: boolean }) {
  const { control } = useFormContext<ScheduleFormData>();
  const trigger = useWatch({ control, name: 'trigger' });
  // The one reading with no offline moment to decide about — see the docstring.
  const collapsed = isEventTrigger(trigger);

  const { field: behaviorField } = useController({ control, name: 'offlineBehavior' });
  const { field: intervalField, fieldState: intervalState } = useController({ control, name: 'reconnectInterval' });
  const { field: unitField } = useController({ control, name: 'reconnectUnit' });

  // The window belongs to the second option and only to it. Locked under SKIP
  // rather than hidden: the design keeps it on the row so the choice reads as
  // "skip, or retry for THIS long", and a click anywhere on that row selects the
  // option and unlocks it — the controls themselves are interactive content,
  // which a label's activation behavior skips, so using them never re-triggers
  // the radio they sit inside.
  const windowDisabled = disabled || !isRetryOnReconnect(behaviorField.value);
  const intervalError = showErrors ? intervalState.error?.message : undefined;

  // Switching TO minutes drags the interval up to the floor with it, the way the
  // repeat pair does: "1 Day" would otherwise read "1 Minute", a value the user
  // never typed and the form cannot save. A cleared field stays cleared.
  const handleUnitChange = (next: DurationUnit) => {
    unitField.onChange(next);
    const snapped = snapReconnectInterval(intervalField.value, next);
    if (snapped !== intervalField.value) intervalField.onChange(snapped);
  };

  const windowFieldsFor = (fluid: boolean) => (
    <ReconnectWindowFields
      interval={intervalField.value}
      unit={unitField.value}
      onIntervalChange={intervalField.onChange}
      onIntervalBlur={intervalField.onBlur}
      onUnitChange={handleUnitChange}
      disabled={windowDisabled}
      invalid={!!intervalError}
      fluid={fluid}
    />
  );

  const options = SCHEDULE_OFFLINE_BEHAVIOR_OPTIONS.map(option =>
    isRetryOnReconnect(option.value)
      ? // Desktop only. Below `md` the caption plus two controls cannot share a
        // row with the option's own label without squeezing it to nothing, so
        // the same fields render full-width under the group instead.
        { ...option, trailing: <div className="hidden content-md:flex">{windowFieldsFor(false)}</div> }
      : option,
  );

  return (
    <div
      inert={collapsed}
      style={{
        gridTemplateRows: collapsed ? '0fr' : '1fr',
        opacity: collapsed ? 0 : 1,
      }}
      className="mb-[calc(-1*var(--spacing-system-lf))] grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none"
    >
      <div className="min-h-0 overflow-hidden">
        {/* The bottom padding is the room the error below renders into, and it
            sits on a wrapper INSIDE the clipping box rather than on the box
            itself: a box is never shorter than its own padding — border-box
            included — so padding on the grid item would survive the 0fr track as
            24px of residue that the negative margin above then spends cancelling
            instead of closing the section gap. */}
        <div className="pb-[var(--spacing-system-lf)]">
          {/* `data-invalid` on the SECTION, not on the number inputs: one of
              those two copies is always display:none, and an ancestor is matched
              before either, so the marker is visible at every breakpoint. What
              it cannot say on its own is WHERE to put focus — the first
              focusable inside it is the "Skip this Run" radio — so the input
              carries `data-invalid-focus` and the helper prefers it. */}
          <div
            className="relative flex flex-col gap-[var(--spacing-system-xxs)]"
            data-invalid={intervalError ? true : undefined}
          >
            <Label className="text-h4">If device is offline at scheduled time</Label>
            <RadioGroupBlock
              variant="grouped"
              value={behaviorField.value}
              onValueChange={behaviorField.onChange}
              disabled={disabled}
              options={options}
            />
            <div className="pt-[var(--spacing-system-xs)] content-md:hidden">{windowFieldsFor(true)}</div>
            {intervalError && (
              <div className="absolute bottom-0 left-0 right-0 translate-y-full">
                <TruncateText variant="h6" className="text-ods-error">
                  {intervalError}
                </TruncateText>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
