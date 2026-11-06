import type { RadioGroupBlockOption } from '../../ui';

/** What a software run does to its packages. */
export type SoftwareActionKind = 'INSTALL' | 'UPDATE';

export interface SoftwareActionCopy {
  /** The ACTION column, the first word of a log's STATUS, the start of a schedule's name. */
  verb: string;
  /** The Install / Update Software form. */
  formTitle: string;
  runLabel: string;
  scheduleLabel: string;
  modes: RadioGroupBlockOption[];
  started: string;
  scheduled: string;
  failed: string;
  /** One run's page, and the heading over its per-device logs. */
  detailTitle: string;
  logsHeading: string;
}

/**
 * The run modes say when a device actually gets the run, not only when it is sent. Both forms submit a software bundle
 * (`submitSoftwareBundle`), and the backend delivers it per device:
 * - Now: each device gets an online-dispatch sentinel (`SoftwareBundleService.armOnlineDispatch`), so an online device
 *   starts at once and an offline one when it comes online.
 * - Scheduled: the schedule is created with `offlineBehavior` RETRY_ON_RECONNECT and the reconnect window
 *   `openframe.rmm.software.bundle.schedule.reconnect-window-seconds` (604800 s, 7 days, in saas-tenant
 *   `configs/base/openframe-saas-api.yml`): a device offline at the start time gets the run when it reconnects within
 *   that window. Keep "within 7 days" in step with that key.
 */
const nowDescription = (noun: string) =>
  `The ${noun} starts now on online devices, and on the others when they come online.`;
const scheduleDescription = (noun: string) =>
  `The ${noun} runs at the scheduled time. Devices offline then get it when they come back online, within 7 days.`;

/** Everything the install and update flows word differently, on every page that shows one. */
export const SOFTWARE_ACTION_COPY: Record<SoftwareActionKind, SoftwareActionCopy> = {
  INSTALL: {
    verb: 'Install',
    formTitle: 'Install Software',
    runLabel: 'Run Installation',
    scheduleLabel: 'Schedule Install',
    modes: [
      { value: 'now', label: 'Install Now', description: nowDescription('install') },
      { value: 'schedule', label: 'Schedule Install', description: scheduleDescription('install') },
    ],
    started: 'Installation started',
    scheduled: 'Installation scheduled',
    failed: 'Failed to start the installation',
    detailTitle: 'Software Install Details',
    logsHeading: 'Install Logs',
  },
  UPDATE: {
    verb: 'Update',
    formTitle: 'Update Software',
    runLabel: 'Run Update',
    scheduleLabel: 'Schedule Update',
    modes: [
      { value: 'now', label: 'Update Now', description: nowDescription('update') },
      { value: 'schedule', label: 'Schedule Update', description: scheduleDescription('update') },
    ],
    started: 'Update started',
    scheduled: 'Update scheduled',
    failed: 'Failed to start the update',
    detailTitle: 'Software Update Details',
    logsHeading: 'Update Logs',
  },
};

/** A run's page title while the record has not said which action it is, or names one this build does not know. */
export const SOFTWARE_ACTION_DETAIL_TITLE = 'Software Action Details';

/** The copy for a run's `action` as the payload types it; undefined for an action this build does not know. */
export function softwareActionCopy(action: string): SoftwareActionCopy | undefined {
  return action in SOFTWARE_ACTION_COPY ? SOFTWARE_ACTION_COPY[action as SoftwareActionKind] : undefined;
}
