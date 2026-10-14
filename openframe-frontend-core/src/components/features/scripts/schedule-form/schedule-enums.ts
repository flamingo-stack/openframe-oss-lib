/**
 * The three schedule enums the form branches on, with the values the OpenFrame
 * API uses. A host's generated enums carry the same strings, so its values and
 * these are assignable both ways.
 */

/** What fires a schedule: a date and time, or a device coming online. */
export const SCRIPT_SCHEDULE_TRIGGER = {
  DATE_TIME: 'DATE_TIME',
  DEVICE_ONLINE: 'DEVICE_ONLINE',
} as const;
export type ScriptScheduleTrigger = (typeof SCRIPT_SCHEDULE_TRIGGER)[keyof typeof SCRIPT_SCHEDULE_TRIGGER];

/** Which clock a schedule's date and time mean: the account's, or each device's. */
export const SCHEDULE_TIME_REFERENCE = {
  SERVER: 'SERVER',
  DEVICE_LOCAL: 'DEVICE_LOCAL',
} as const;
export type ScheduleTimeReference = (typeof SCHEDULE_TIME_REFERENCE)[keyof typeof SCHEDULE_TIME_REFERENCE];

/** What a schedule does with a device that is offline when it fires. */
export const SCHEDULE_OFFLINE_BEHAVIOR = {
  SKIP: 'SKIP',
  RETRY_ON_RECONNECT: 'RETRY_ON_RECONNECT',
} as const;
export type ScheduleOfflineBehavior = (typeof SCHEDULE_OFFLINE_BEHAVIOR)[keyof typeof SCHEDULE_OFFLINE_BEHAVIOR];
