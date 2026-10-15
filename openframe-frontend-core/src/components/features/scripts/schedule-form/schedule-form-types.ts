import type { ReactNode } from 'react';
import type { ScriptArgument } from '../../../platform/ScriptArguments';
import {
  SCHEDULE_OFFLINE_BEHAVIOR,
  SCHEDULE_TIME_REFERENCE,
  type ScheduleOfflineBehavior,
  type ScheduleTimeReference,
  SCRIPT_SCHEDULE_TRIGGER,
  type ScriptScheduleTrigger,
} from './schedule-enums';
import { DEFAULT_RECONNECT_WINDOW, type DurationUnit } from './schedule-timing';

/** One of a script's own environment variables. `value` is null for a secret: the server masks it on every read. */
export interface ScheduleFormEnvVar {
  name: string;
  value: string | null;
  secret: boolean;
}

/** One card of "Scheduled Scripts": the picked script and what the schedule runs it with. */
export interface ScheduleFormScriptRow {
  /** `''` = no script picked yet. */
  scriptId: string;
  name: string;
  /** The picked script's OWN platforms (UI ids) — a host checks them against the schedule's. */
  supportedPlatforms: string[];
  // 0 = no script picked yet, so the field is locked and empty; a real
  // timeout only exists once a script is chosen (it seeds this).
  timeoutSeconds: number;
  args: ScriptArgument[];
  envVars: ScriptArgument[];
  /**
   * The picked script's OWN defaults, carried with no control of their
   * own: an override is written only for the half that differs from
   * them, so a schedule keeps inheriting later edits to the script
   * instead of freezing a copy the day it was saved.
   */
  defaultArgs: string[];
  defaultEnvVars: ScheduleFormEnvVar[];
}

/**
 * Everything the schedule form holds. The fields read it off the
 * react-hook-form context; the host owns the form itself (its schema, its
 * seeding, its submit), and checks its own form type against this one.
 */
export interface ScheduleFormData {
  name: string;
  /** "Note" in the UI. */
  description: string;
  trigger: ScriptScheduleTrigger;
  scheduledDate: Date | null;
  /** `HH:mm` on the 30-minute grid; `''` = the user hasn't picked a time yet. */
  scheduledTime: string;
  /** Which clock the pair above means — the "Timezone" control. Held even when the control is not rendered. */
  timeReference: ScheduleTimeReference;
  repeatEnabled: boolean;
  /** `null` while the box is EMPTY — the user is mid-edit, not proposing zero. */
  repeatInterval: number | null;
  repeatUnit: DurationUnit;
  /** The stored cadence the form was seeded with, carried with no control of its own. */
  repeatSecondsStored: number | null;
  /**
   * The stored start the form was seeded with, carried with no control of its
   * own: a start that has already passed stays legal for as long as the form
   * still shows exactly it (see `isStartInPastAndChanged`).
   */
  startAtStored: string | null;
  offlineBehavior: ScheduleOfflineBehavior;
  /** "Stop Retry after", as the `[interval] [unit]` pair. `null` while the box is empty. */
  reconnectInterval: number | null;
  reconnectUnit: DurationUnit;
  /** The stored reconnect window the form was seeded with, carried with no control of its own. */
  reconnectWindowSecondsStored: number | null;
  /** UI platform ids the schedule targets. */
  supportedPlatforms: string[];
  /** Card order IS the run order. */
  scripts: ScheduleFormScriptRow[];
}

export const EMPTY_SCHEDULE_SCRIPT_ROW: ScheduleFormScriptRow = {
  scriptId: '',
  name: '',
  supportedPlatforms: [],
  // 0 keeps the Timeout field locked and empty until a script is picked.
  timeoutSeconds: 0,
  args: [],
  envVars: [],
  defaultArgs: [],
  defaultEnvVars: [],
};

export const SCHEDULE_TRIGGER_OPTIONS = [
  {
    value: SCRIPT_SCHEDULE_TRIGGER.DATE_TIME,
    label: 'Run on schedule',
    description: 'Runs at the set date and time, whether or not the device is online.',
  },
  {
    value: SCRIPT_SCHEDULE_TRIGGER.DEVICE_ONLINE,
    label: 'Run when device comes online',
    description: "Waits for the device to connect, then runs as soon as it's reachable.",
  },
];

/**
 * The "Timezone" dropdown (design node 793:61340), in the designer's own
 * wording: the account's clock, or each device's.
 *
 * SERVER first — it is the backend's documented default for a null
 * `timeReference`, and it is what every schedule authored before the field
 * existed already means.
 */
export const SCHEDULE_TIME_REFERENCE_OPTIONS = [
  { value: SCHEDULE_TIME_REFERENCE.SERVER, label: 'Your account timezone' },
  { value: SCHEDULE_TIME_REFERENCE.DEVICE_LOCAL, label: 'Device local timezone' },
];

/**
 * The two answers to "if device is offline at scheduled time" (design node
 * 460:63425). SKIP first, because it is both the design's default and the
 * behavior every schedule authored before this field existed already has — the
 * backend reads a null `offlineBehavior` as SKIP.
 */
export const SCHEDULE_OFFLINE_BEHAVIOR_OPTIONS = [
  {
    value: SCHEDULE_OFFLINE_BEHAVIOR.SKIP,
    label: 'Skip this Run',
    description: 'Next run stays on schedule. Missed runs are logged.',
  },
  {
    value: SCHEDULE_OFFLINE_BEHAVIOR.RETRY_ON_RECONNECT,
    label: 'Run when device comes back online',
    description: 'Executes on the next reconnect.',
  },
];

export const DEFAULT_SCHEDULE_FORM_VALUES: ScheduleFormData = {
  name: '',
  description: '',
  trigger: SCRIPT_SCHEDULE_TRIGGER.DATE_TIME,
  scheduledDate: null,
  scheduledTime: '',
  timeReference: SCHEDULE_TIME_REFERENCE.SERVER,
  repeatEnabled: false,
  repeatInterval: 1,
  repeatUnit: 'day',
  repeatSecondsStored: null,
  startAtStored: null,
  offlineBehavior: SCHEDULE_OFFLINE_BEHAVIOR.SKIP,
  reconnectInterval: DEFAULT_RECONNECT_WINDOW.interval,
  reconnectUnit: DEFAULT_RECONNECT_WINDOW.unit,
  reconnectWindowSecondsStored: null,
  supportedPlatforms: ['windows'],
  scripts: [EMPTY_SCHEDULE_SCRIPT_ROW],
};

/**
 * A flag a host has asked about and may not have an answer to yet. `loading`
 * is never read as `off`: the fields it decides are locked until it settles.
 */
export type ScheduleFormGate = 'on' | 'off' | 'loading';

/** One option of the Time dropdown: `value` is 24h `HH:mm`, `label` what the viewer reads. */
export interface ScheduleTimeSlot {
  value: string;
  label: string;
}

/**
 * What a card's "Select Script" slot is told. Searching the script library is
 * the host's query, so the field is a slot: the product passes its data-bound
 * search, a fixture passes a static one. Both draw `ScheduleScriptSearchField`.
 */
export interface ScheduleScriptSearchSlotProps {
  /** The card's script: `''` while nothing is picked. */
  scriptId: string;
  /** Its name — the label shown when the script is not on the current search page. */
  name: string;
  /** UI platform ids the schedule targets — what a host narrows its search by. */
  supportedPlatforms: string[];
  /** Writes the card: the row a picked script seeds, or null when the field is cleared. */
  onPick: (row: ScheduleFormScriptRow | null) => void;
  disabled: boolean;
  error: string | undefined;
  invalid: boolean;
}

export type RenderScheduleScriptSearch = (field: ScheduleScriptSearchSlotProps) => ReactNode;
