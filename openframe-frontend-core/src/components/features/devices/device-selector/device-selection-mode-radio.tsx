'use client';

import { RadioGroupBlock, type RadioGroupBlockOption, Tag } from '../../../ui';
import { useDevicesViewConfig } from '../devices-view-config';
import type { DeviceSelectionMode } from './device-selector.types';

/**
 * The two assignment modes (design 460:71430).
 *
 * The copy stays generic ("this selection") rather than the design's "this
 * script schedule": this block also renders on the monitoring query and policy
 * pages, where naming a schedule would simply be wrong.
 */
const SPECIFIC_MODE_OPTION: RadioGroupBlockOption = {
  value: 'specific',
  label: 'Select Specific Devices',
  description: 'Choose individual devices to include in this selection',
};

const CRITERIA_MODE_DESCRIPTION =
  'Automatically include all devices (current and future) that match your defined criteria';

/**
 * "By criteria" is only offered where a consumer can actually store a rule ,
 * i.e. where `value` / `onChange` are wired up. Everywhere else it keeps the
 * design's "Coming Soon" treatment: a tag rather than a dimmed row is how the
 * design says so, and `disabled` is what keeps it unselectable and out of the
 * tab order. In the mobile shell that row is dropped entirely, which leaves
 * this list with a single option and the block renders nothing at all.
 */
const SELECTION_MODE_OPTIONS: RadioGroupBlockOption[] = [
  SPECIFIC_MODE_OPTION,
  {
    value: 'criteria',
    label: 'Select Devices by Criteria',
    description: CRITERIA_MODE_DESCRIPTION,
    disabled: true,
    trailing: <Tag label="Coming Soon" variant="grey" />,
  },
];

const SELECTION_MODE_OPTIONS_ENABLED: RadioGroupBlockOption[] = [
  SPECIFIC_MODE_OPTION,
  {
    value: 'criteria',
    label: 'Select Devices by Criteria',
    description: CRITERIA_MODE_DESCRIPTION,
  },
];

export interface DeviceSelectionModeRadioProps {
  /**
   * The chosen mode. `''` is a real value here: the block with NOTHING marked,
   * for a page whose stored mode has not arrived yet, marking one would be a
   * guess at the answer being loaded. Omit the prop entirely for the
   * uncontrolled, criteria-disabled block.
   */
  value?: DeviceSelectionMode | '';
  onChange?: (mode: DeviceSelectionMode) => void;
  disabled?: boolean;
}

/**
 * The mode block above a device picker.
 *
 * Its own component, and not just markup inside `DeviceSelector`, because a
 * page whose two modes are separate data islands has to keep it OUTSIDE the
 * subtree that swaps: mounted inside, the radio unmounts and remounts with the
 * content, restarting its own transitions, the switch you just clicked blinks.
 * Such a page renders this directly and passes `showSelectionModeRadio={false}`.
 *
 * Renders nothing when fewer than two modes survive, which is the mobile
 * shell's uncontrolled case, where the only other mode is "Coming Soon".
 */
export function DeviceSelectionModeRadio({ value, onChange, disabled }: DeviceSelectionModeRadioProps) {
  // Controlled whenever the consumer PASSES a value, including `''`, which is a
  // consumer that owns the answer but is still waiting for it. Only an omitted
  // prop means "decorative", which is what keeps the old criteria-disabled
  // block for the pages that cannot store a rule.
  const isControlled = value !== undefined;
  const { isMobileShell: isMobile = false } = useDevicesViewConfig();

  const allOptions = isControlled ? SELECTION_MODE_OPTIONS_ENABLED : SELECTION_MODE_OPTIONS;
  // A disabled option is one nobody can pick, on a phone it is a row of screen
  // spent announcing a feature. Dropping it costs nothing there, and it leaves
  // the controlled block (where criteria IS selectable) untouched.
  const options = isMobile ? allOptions.filter(option => !option.disabled) : allOptions;

  // One option is not a choice. The mode that survived is what the picker below
  // already does, so the group would only be asking a question with a single
  // answer.
  if (options.length < 2) return null;

  return (
    <RadioGroupBlock
      name="selectionMode"
      variant="grouped"
      {...(isControlled ? { value, onValueChange: onChange } : { defaultValue: 'specific' })}
      disabled={disabled}
      options={options}
      // Design 460:71430 rows are 68px, a 24px title over a 20px description
      // with 12px above and below. The grouped variant pads `py-xs` (8px on
      // desktop) by default, which would come out 8px short.
      itemClassName="py-[var(--spacing-system-sf)]"
    />
  );
}
