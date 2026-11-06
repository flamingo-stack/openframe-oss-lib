'use client';

import { InfoCircleIcon } from '../../icons-v2-generated';
import { Alert, CheckboxBlock, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

/** What an update does on a device where the app is running. */
export type SoftwareUpdateMode = 'WAIT' | 'FORCE';

/** "Deadline if app is open": one update's behaviour on a device where the app is open. */
export interface SoftwareUpdatePolicy {
  mode: SoftwareUpdateMode;
  /** WAIT only: a deadline after the first try. Off, the update waits until the app closes, however long it takes. */
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

/**
 * Without user notifications nobody can be asked to update, or told the app is about to close: an update on a device
 * where the app is running closes it ("Force update right away"), or waits until the user closes it ("Update when app
 * closes"). A deadline is the prompt's offer (postpone until then), which nobody can show, so it falls back to Force
 * Update; `countdownSeconds` is kept, since the input requires it.
 */
function withoutNotifications(policy: SoftwareUpdatePolicy): SoftwareUpdatePolicy {
  return policy.mode === 'WAIT' && policy.deadlineEnabled
    ? { ...policy, mode: 'FORCE', deadlineEnabled: false }
    : policy;
}

/**
 * The settings as the form can offer them: unchanged with user notifications; without them, a deadline on either policy
 * reads as Force Update (a draft or a saved policy included). What the fields draw and the form submits.
 */
export function availableSoftwareUpdateSettings(
  settings: SoftwareUpdateSettingsValues,
  userNotifications: boolean,
): SoftwareUpdateSettingsValues {
  if (userNotifications) return settings;
  const policy = withoutNotifications(settings.policy);
  const autoUpdatePolicy = withoutNotifications(settings.autoUpdatePolicy);
  return policy === settings.policy && autoUpdatePolicy === settings.autoUpdatePolicy
    ? settings
    : { ...settings, policy, autoUpdatePolicy };
}

/** The "Deadline if app is open" choices that are not a deadline. */
const FORCE_NOW = 'FORCE';
const WHEN_APP_CLOSES = 'WHEN_APP_CLOSES';

/** "Deadline if app is open" as one value: Force now, a deadline (its seconds), or waiting for the app to close. */
function deadlineValue(policy: SoftwareUpdatePolicy): string {
  if (policy.mode === 'FORCE') return FORCE_NOW;
  return policy.deadlineEnabled ? String(policy.deadlineSeconds) : WHEN_APP_CLOSES;
}

function withDeadline(policy: SoftwareUpdatePolicy, value: string): SoftwareUpdatePolicy {
  if (value === FORCE_NOW) return { ...policy, mode: 'FORCE', deadlineEnabled: false };
  if (value === WHEN_APP_CLOSES) return { ...policy, mode: 'WAIT', deadlineEnabled: false };
  return { ...policy, mode: 'WAIT', deadlineEnabled: true, deadlineSeconds: Number(value) };
}

/** The deadlines in the order the design lists them: right away, after the first try, never (the app closing). */
function deadlineOptions(userNotifications: boolean): ReadonlyArray<{ value: string; label: string }> {
  return [
    { value: FORCE_NOW, label: 'Force update right away' },
    ...(userNotifications
      ? SOFTWARE_UPDATE_DEADLINE_OPTIONS.map(option => ({ value: String(option.seconds), label: option.label }))
      : []),
    { value: WHEN_APP_CLOSES, label: 'Update when app closes' },
  ];
}

const SAME_SETTINGS_DESCRIPTION: Record<SoftwareUpdateMode, string> = {
  WAIT: 'Auto-updates follow "Deadline if app is open" above. Uncheck to set them separately.',
  FORCE: 'Later releases will also be force-updated.',
};

const groupLabelClass = 'text-h5 text-ods-text-secondary';

function SettingSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[var(--spacing-system-xxs)]">
      <Label htmlFor={id} className="text-h4">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** "Deadline if app is open" and "Countdown before closing" (design 1572:2004, its dropdowns 1572:3193 / 1572:4431). */
function UpdatePolicyFields({
  name,
  policy,
  userNotifications,
  onChange,
}: {
  /** Prefixes the fields' ids: two policies on one page must not share them. */
  name: string;
  policy: SoftwareUpdatePolicy;
  /**
   * Off, the deadline offers only what needs nobody warned (right away, or when the app closes) and there is no
   * countdown to set: the user would not see it.
   */
  userNotifications: boolean;
  onChange: (policy: SoftwareUpdatePolicy) => void;
}) {
  // Waiting for the app to close never closes it, so there is nothing to count down to.
  const closesApp = policy.mode === 'FORCE' || policy.deadlineEnabled;
  return (
    <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-3 content-md:items-start">
      <SettingSelect
        id={`${name}-deadline`}
        label="Deadline if app is open"
        value={deadlineValue(policy)}
        options={deadlineOptions(userNotifications)}
        onChange={value => onChange(withDeadline(policy, value))}
      />
      {userNotifications && closesApp && (
        <SettingSelect
          id={`${name}-countdown`}
          label="Countdown before closing"
          value={String(policy.countdownSeconds)}
          options={SOFTWARE_UPDATE_COUNTDOWN_OPTIONS.map(option => ({
            value: String(option.seconds),
            label: option.label,
          }))}
          onChange={value => onChange({ ...policy, countdownSeconds: Number(value) })}
        />
      )}
    </div>
  );
}

export interface SoftwareUpdateSettingsFieldsProps {
  value: SoftwareUpdateSettingsValues;
  onChange: (value: SoftwareUpdateSettingsValues) => void;
  /**
   * The devices can notify the user: the deadlines after the first try and the countdowns are offered. Default false,
   * as today, when the client has no notifications: "Force update right away" or "Update when app closes", nothing
   * else to set.
   */
  userNotifications?: boolean;
}

/**
 * Update Software's update settings (design 1572:2004; the separate auto-update rules 1034:8173): what happens on a
 * device where the app is running, under the timing, and whether later releases are installed the same way. No heading
 * of their own: the deadline and the countdown read as part of when the update runs.
 */
export function SoftwareUpdateSettingsFields({
  value: settings,
  onChange,
  userNotifications = false,
}: SoftwareUpdateSettingsFieldsProps) {
  const value = availableSoftwareUpdateSettings(settings, userNotifications);
  return (
    <section aria-label="Update Settings" className="flex flex-col gap-[var(--spacing-system-l)]">
      <UpdatePolicyFields
        name="updatePolicy"
        policy={value.policy}
        userNotifications={userNotifications}
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
                <div className="flex flex-col gap-[var(--spacing-system-xsf)] rounded-[6px] border border-ods-border p-[var(--spacing-system-m)]">
                  <span className={groupLabelClass}>For auto-updates</span>
                  <UpdatePolicyFields
                    name="autoUpdatePolicy"
                    policy={value.autoUpdatePolicy}
                    userNotifications={userNotifications}
                    onChange={autoUpdatePolicy => onChange({ ...value, autoUpdatePolicy })}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Core Alert on the card surface, as a note: it comes with "Keep it auto-updated" and goes with it, since the
          reinstall is what lets OpenFrame keep a hand-installed app updated, and a one-off update promises no more. The
          icon sits in a span so Alert's `[&>svg]` positioning does not apply. */}
      {value.autoUpdate && (
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
      )}
    </section>
  );
}
