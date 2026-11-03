'use client';

import { InfoCircleIcon } from '../../icons-v2-generated';
import {
  Alert,
  CheckboxBlock,
  Label,
  RadioGroupBlock,
  type RadioGroupBlockOption,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui';

/** What an update does on a device where the app is running. */
export type SoftwareUpdateMode = 'WAIT' | 'FORCE';

/** "If the app is running": one update's behaviour on a device where the app is open. */
export interface SoftwareUpdatePolicy {
  mode: SoftwareUpdateMode;
  /** WAIT only: "Countdown after the deadline". Off, the update waits for the user however long it takes. */
  deadlineEnabled: boolean;
  /** WAIT only: seconds after the first try before the countdown starts. */
  deadlineSeconds: number;
  /** Seconds of countdown before the app is closed: after the deadline (WAIT) or right away (FORCE). */
  countdownSeconds: number;
}

/** The Update Software form's "Update Settings": this update, and whether later releases follow it. */
export interface SoftwareUpdateSettingsValues {
  policy: SoftwareUpdatePolicy;
  /** "Keep it auto-updated": every new version is installed on the same devices after this update. */
  autoUpdate: boolean;
  /** "Same settings for auto-update": auto-updates run with `policy`; off, with `autoUpdatePolicy`. */
  sameForAutoUpdate: boolean;
  autoUpdatePolicy: SoftwareUpdatePolicy;
}

const DAY = 24 * 60 * 60;
const MINUTE = 60;

export const SOFTWARE_UPDATE_DEADLINE_OPTIONS: ReadonlyArray<{ seconds: number; label: string }> = [
  { seconds: DAY, label: '1 day after the first try' },
  { seconds: 3 * DAY, label: '3 days after the first try' },
  { seconds: 7 * DAY, label: '7 days after the first try' },
  { seconds: 14 * DAY, label: '14 days after the first try' },
  { seconds: 30 * DAY, label: '30 days after the first try' },
];

export const SOFTWARE_UPDATE_COUNTDOWN_OPTIONS: ReadonlyArray<{ seconds: number; label: string }> = [
  { seconds: MINUTE, label: '1 minute' },
  { seconds: 5 * MINUTE, label: '5 minutes' },
  { seconds: 15 * MINUTE, label: '15 minutes' },
  { seconds: 30 * MINUTE, label: '30 minutes' },
];

/** Wait & notify, a countdown 7 days after the first try, 5 minutes long: what the server applies when sent none. */
export const DEFAULT_SOFTWARE_UPDATE_POLICY: SoftwareUpdatePolicy = {
  mode: 'WAIT',
  deadlineEnabled: true,
  deadlineSeconds: 7 * DAY,
  countdownSeconds: 5 * MINUTE,
};

export const DEFAULT_SOFTWARE_UPDATE_SETTINGS: SoftwareUpdateSettingsValues = {
  policy: DEFAULT_SOFTWARE_UPDATE_POLICY,
  autoUpdate: true,
  sameForAutoUpdate: true,
  autoUpdatePolicy: DEFAULT_SOFTWARE_UPDATE_POLICY,
};

const MODE_OPTIONS: RadioGroupBlockOption[] = [
  {
    value: 'WAIT',
    label: 'Wait & notify',
    description: 'The user gets Update now or Ask Later. If they close the app, it updates then.',
  },
  {
    value: 'FORCE',
    label: 'Force Update',
    description: 'The user gets a short countdown, then the app closes and updates.',
  },
];

const SAME_SETTINGS_DESCRIPTION: Record<SoftwareUpdateMode, string> = {
  WAIT: 'Auto-updates follow "If the app is running" above. Uncheck to set them separately.',
  FORCE: 'Later releases will also be force-updated.',
};

const groupLabelClass = 'text-h5 text-ods-text-secondary';

function SecondsSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number;
  options: ReadonlyArray<{ seconds: number; label: string }>;
  onChange: (seconds: number) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
      <Label className="text-h4">{label}</Label>
      <Select value={String(value)} onValueChange={next => onChange(Number(next))}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.seconds} value={String(option.seconds)}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** "If the app is running" with its deadline and countdown. */
function UpdatePolicyFields({
  name,
  label,
  policy,
  onChange,
}: {
  /** The radio group's name: two policies on one page must not share it. */
  name: string;
  label: string;
  policy: SoftwareUpdatePolicy;
  onChange: (policy: SoftwareUpdatePolicy) => void;
}) {
  const waits = policy.mode === 'WAIT';
  const deadline = waits && policy.deadlineEnabled;
  const countdown = (
    <SecondsSelect
      label="Countdown"
      value={policy.countdownSeconds}
      options={SOFTWARE_UPDATE_COUNTDOWN_OPTIONS}
      onChange={countdownSeconds => onChange({ ...policy, countdownSeconds })}
    />
  );
  return (
    <div className="flex flex-col gap-[var(--spacing-system-m)]">
      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <span className={groupLabelClass}>{label}</span>
        <RadioGroupBlock
          name={name}
          aria-label={label}
          variant="grouped"
          value={policy.mode}
          onValueChange={mode => onChange({ ...policy, mode: mode as SoftwareUpdateMode })}
          options={MODE_OPTIONS}
          itemClassName="py-[var(--spacing-system-sf)]"
        />
      </div>
      {waits ? (
        <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
          <CheckboxBlock
            id={`${name}-deadline`}
            checked={policy.deadlineEnabled}
            onCheckedChange={deadlineEnabled => onChange({ ...policy, deadlineEnabled })}
            label="Countdown after the deadline"
            description="If the update still isn’t installed by the deadline, the user gets a countdown and then it installs."
          />
          {deadline && (
            <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-3 content-md:items-start">
              <SecondsSelect
                label="Deadline"
                value={policy.deadlineSeconds}
                options={SOFTWARE_UPDATE_DEADLINE_OPTIONS}
                onChange={deadlineSeconds => onChange({ ...policy, deadlineSeconds })}
              />
              {countdown}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-3">{countdown}</div>
      )}
    </div>
  );
}

export interface SoftwareUpdateSettingsFieldsProps {
  value: SoftwareUpdateSettingsValues;
  onChange: (value: SoftwareUpdateSettingsValues) => void;
}

/**
 * Update Software's "Update Settings" (design 988:21462, the separate auto-update
 * rules 1034:8173): what happens on a device where the app is running, and
 * whether later releases are installed the same way.
 */
export function SoftwareUpdateSettingsFields({ value, onChange }: SoftwareUpdateSettingsFieldsProps) {
  return (
    <section aria-labelledby="software-update-settings" className="flex flex-col gap-[var(--spacing-system-l)]">
      <h2 id="software-update-settings" className="pt-[var(--spacing-system-l)] text-ods-text-primary text-h2">
        Update Settings
      </h2>

      <UpdatePolicyFields
        name="updatePolicy"
        label="If the app is running"
        policy={value.policy}
        onChange={policy => onChange({ ...value, policy })}
      />

      <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
        <span className={groupLabelClass}>Auto-update</span>
        <div className="flex flex-col gap-[var(--spacing-system-sf)]">
          <CheckboxBlock
            id="software-auto-update"
            checked={value.autoUpdate}
            onCheckedChange={autoUpdate => onChange({ ...value, autoUpdate })}
            label="Keep it auto-updated"
            description="After this update, OpenFrame installs each new version from Winget or Brew on the selected devices. When off, only this update runs."
          />
          {value.autoUpdate && (
            <>
              <CheckboxBlock
                id="software-auto-update-same"
                checked={value.sameForAutoUpdate}
                onCheckedChange={sameForAutoUpdate => onChange({ ...value, sameForAutoUpdate })}
                label="Same settings for auto-update"
                description={SAME_SETTINGS_DESCRIPTION[value.policy.mode]}
              />
              {!value.sameForAutoUpdate && (
                <div className="rounded-[6px] border border-ods-border p-[var(--spacing-system-m)]">
                  <UpdatePolicyFields
                    name="autoUpdatePolicy"
                    label="For auto-updates"
                    policy={value.autoUpdatePolicy}
                    onChange={autoUpdatePolicy => onChange({ ...value, autoUpdatePolicy })}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Core Alert on the card surface, as a note: it is there from the start, nothing to announce. The icon sits in
          a span so Alert's `[&>svg]` positioning does not apply. */}
      <Alert
        role="note"
        className="flex items-center gap-[var(--spacing-system-m)] rounded-[6px] border-ods-border bg-ods-card p-[var(--spacing-system-m)]"
      >
        <span className="shrink-0 text-ods-text-secondary">
          <InfoCircleIcon size={24} color="currentColor" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-xxs)]">
          <p className="text-ods-text-primary text-h3">Apps installed by hand get reinstalled</p>
          <p className="text-ods-text-secondary text-h6">
            On the first update, OpenFrame reinstalls them with Winget or Brew so it can keep them updated.
          </p>
        </div>
      </Alert>
    </section>
  );
}
