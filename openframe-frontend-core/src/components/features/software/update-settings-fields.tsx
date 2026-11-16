'use client';

import { CheckboxBlock, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui';

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

/** Force Update, with a 7-day deadline ready for when Wait is picked: what the form opens with without notifications. */
const FORCE_UPDATE_POLICY: SoftwareUpdatePolicy = {
  ...DEFAULT_SOFTWARE_UPDATE_POLICY,
  mode: 'FORCE',
  deadlineEnabled: false,
};

/**
 * What the form opens with. With user notifications, the server's own defaults. Without them, Force Update: an app is
 * never closed unannounced a week later, and nobody is promised a prompt that cannot be shown.
 */
export function defaultSoftwareUpdateSettings(userNotifications: boolean): SoftwareUpdateSettingsValues {
  if (userNotifications) return DEFAULT_SOFTWARE_UPDATE_SETTINGS;
  return { ...DEFAULT_SOFTWARE_UPDATE_SETTINGS, policy: FORCE_UPDATE_POLICY, autoUpdatePolicy: FORCE_UPDATE_POLICY };
}

/**
 * What each choice does on the device, worded for a client that cannot notify the user. The agent shows nothing on the
 * device (no prompt, no countdown on screen; there is no end-user UI yet), so the line under the deadline says what
 * happens:
 * - Update when app closes (WAIT, no deadline): the agent reports Waiting and installs once the app is closed.
 * - A deadline (WAIT + `deadlineSeconds`): counted from the first time the agent finds the app running; at the deadline
 *   the backend sends the update again as FORCE (`armDeadline` / `driveDeadlineForce` in openframe-client-core), and
 *   withdraws that if the update finished first.
 * - Force update right away (FORCE): the agent waits `countdownSeconds` (clamped to 60–1800 s), asks the app to close,
 *   stops it after a 10 s grace and installs (`run.rs` / `close.rs` in openframe-client). The wait is silent, so it is
 *   not offered as a control; the line states it, since the app is not closed at once.
 * With user notifications the countdown is a control of its own and the design has no line under the deadline.
 */
function silentOutcome(policy: SoftwareUpdatePolicy): string {
  const delay = closeDelay(policy.countdownSeconds);
  if (policy.mode === 'FORCE') return `The app is closed without warning ${delay} later, then updated.`;
  if (!policy.deadlineEnabled) return 'The update waits until the user closes the app.';
  return `If the app is still open by the deadline, it is closed without warning ${delay} later, then updated.`;
}

/** "5 minutes": the silent wait before a forced close, worded as the countdown options word it. */
function closeDelay(countdownSeconds: number): string {
  const option = SOFTWARE_UPDATE_COUNTDOWN_OPTIONS.find(candidate => candidate.seconds === countdownSeconds);
  if (option) return option.label;
  const minutes = Math.max(1, Math.round(countdownSeconds / 60));
  return minutes === 1 ? '1 minute' : `${minutes} minutes`;
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

/** The deadlines in the order the design lists them (1572:3193): right away, after the first try, the app closing. */
const DEADLINE_CHOICES: ReadonlyArray<{ value: string; label: string }> = [
  { value: FORCE_NOW, label: 'Force update right away' },
  ...SOFTWARE_UPDATE_DEADLINE_OPTIONS.map(option => ({ value: String(option.seconds), label: option.label })),
  { value: WHEN_APP_CLOSES, label: 'Update when app closes' },
];

const COUNTDOWN_CHOICES = SOFTWARE_UPDATE_COUNTDOWN_OPTIONS.map(option => ({
  value: String(option.seconds),
  label: option.label,
}));

const SAME_SETTINGS_DESCRIPTION: Record<SoftwareUpdateMode, string> = {
  WAIT: 'Auto-updates follow "Deadline if app is open" above. Uncheck to set them separately.',
  FORCE: 'Later releases will also be force-updated.',
};

/**
 * "Keep it auto-updated", as the backend runs it (`PackageAutoUpdatePolicyService.turnOn`, `PackageAutoUpdateTrigger`):
 * a run with it on enables a policy per device for the package, and the trigger orders each new catalog version (Brew
 * and winget catalogs) on those devices. A run with it off leaves an earlier policy as it is: only Turn Off Auto-Update
 * (`turnOffSoftwareAutoUpdate`) or the package leaving the device turns one off, so "off" does not mean "stop".
 */
const AUTO_UPDATE_DESCRIPTION =
  'After this update, OpenFrame installs each new version from Winget or Brew on the selected devices. Leaving it off does not turn off auto-update that is already on there.';

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

export interface SoftwareUpdatePolicyFieldsProps {
  /** Prefixes the fields' ids: two policies on one page must not share them. */
  name: string;
  policy: SoftwareUpdatePolicy;
  /**
   * The devices can notify the user: the countdown before closing is a choice of its own. Off, there is no countdown to
   * set (the user would not see it) and a line under the deadline says what the device does with nobody told.
   */
  userNotifications?: boolean;
  onChange: (policy: SoftwareUpdatePolicy) => void;
}

/**
 * "Deadline if app is open" and "Countdown before closing" (design 1572:2004, its dropdowns 1572:3193 / 1572:4431):
 * what one update does on a device where the app is running. Also the whole of the Auto-update settings page's update
 * rules (1569:1890).
 */
export function SoftwareUpdatePolicyFields({
  name,
  policy,
  userNotifications = false,
  onChange,
}: SoftwareUpdatePolicyFieldsProps) {
  // Waiting for the app to close never closes it, so there is nothing to count down to.
  const closesApp = policy.mode === 'FORCE' || policy.deadlineEnabled;
  return (
    <div className="flex flex-col gap-[var(--spacing-system-xsf)]">
      <div className="grid grid-cols-1 gap-[var(--spacing-system-lf)] content-md:grid-cols-3 content-md:items-start">
        <SettingSelect
          id={`${name}-deadline`}
          label="Deadline if app is open"
          value={deadlineValue(policy)}
          options={DEADLINE_CHOICES}
          onChange={value => onChange(withDeadline(policy, value))}
        />
        {userNotifications && closesApp && (
          <SettingSelect
            id={`${name}-countdown`}
            label="Countdown before closing"
            value={String(policy.countdownSeconds)}
            options={COUNTDOWN_CHOICES}
            onChange={value => onChange({ ...policy, countdownSeconds: Number(value) })}
          />
        )}
      </div>
      {!userNotifications && <p className="text-ods-text-secondary text-h6">{silentOutcome(policy)}</p>}
    </div>
  );
}

export interface SoftwareUpdateSettingsFieldsProps {
  value: SoftwareUpdateSettingsValues;
  onChange: (value: SoftwareUpdateSettingsValues) => void;
  /**
   * The devices can notify the user: the countdown before closing is offered. Default false, as today, when the client
   * has no notifications: the deadline alone, with a line saying the app is closed without warning.
   */
  userNotifications?: boolean;
  /**
   * "Keep it auto-updated" under the update rules. Default true; a host that keeps auto-update on a page of its own
   * (the software's Auto-update settings, design 1569:1890) passes false, and the form then submits it off.
   */
  showAutoUpdate?: boolean;
}

/**
 * Update Software's update settings (design 1572:2004; the separate auto-update rules 1034:8173): what happens on a
 * device where the app is running, under the timing, and whether later releases are installed the same way. No heading
 * of their own: the deadline and the countdown read as part of when the update runs.
 */
export function SoftwareUpdateSettingsFields({
  value,
  onChange,
  userNotifications = false,
  showAutoUpdate = true,
}: SoftwareUpdateSettingsFieldsProps) {
  return (
    <section aria-label="Update Settings" className="flex flex-col gap-[var(--spacing-system-l)]">
      <SoftwareUpdatePolicyFields
        name="updatePolicy"
        policy={value.policy}
        userNotifications={userNotifications}
        onChange={policy => onChange({ ...value, policy })}
      />

      {showAutoUpdate && (
        <div className="flex flex-col gap-[var(--spacing-system-xxs)]">
          <span className={groupLabelClass}>Auto-update</span>
          <div className="flex flex-col gap-[var(--spacing-system-sf)]">
            <CheckboxBlock
              id="software-auto-update"
              checked={value.autoUpdate}
              onCheckedChange={autoUpdate => onChange({ ...value, autoUpdate })}
              label="Keep it auto-updated"
              description={AUTO_UPDATE_DESCRIPTION}
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
                    <SoftwareUpdatePolicyFields
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
      )}

      {/* No note that apps installed by hand get reinstalled on the first update: the agent does not do that. A copy no
          package manager installed is left alone (brew probes it as not installed, winget as "not installed from a
          winget source"), so it is neither updated nor reinstalled. Reinstalling it with a package manager is Adopt
          (`adoptSoftware`), which the backend does not implement yet. */}
    </section>
  );
}
