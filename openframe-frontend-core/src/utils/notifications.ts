/**
 * What an OpenFrame notification can say about itself: its severity and the
 * dashboard section (category) it belongs to, as the backend's enums name them.
 * Stated once for every host that writes or draws one: the OpenFrame app's
 * notification tiles, the Backoffice API's announcement request and the hub's
 * preview of an announcement before it is sent.
 *
 * Pure and server-safe; also published as the granular subpath
 * `./utils/notifications`, so server code reads the vocabulary without React.
 */

/** The backend's notification severities, drawn as the tile's colour. */
export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'DANGER'] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const NOTIFICATION_SEVERITY_LABELS: Readonly<Record<NotificationSeverity, string>> = {
  INFO: 'Info',
  SUCCESS: 'Success',
  WARNING: 'Warning',
  DANGER: 'Danger',
};

/** The severity a notification has when it states none. */
export const DEFAULT_NOTIFICATION_SEVERITY: NotificationSeverity = 'INFO';

/**
 * The backend's `NotificationCategory`: the dashboard section a notification
 * belongs to. Any section but GENERIC shows an unread counter on its menu item.
 */
export const NOTIFICATION_CATEGORIES = [
  'DASHBOARD',
  'CUSTOMERS',
  'DEVICES',
  'SCRIPTS',
  'MONITORING',
  'SOFTWARE',
  'LOGS',
  'TICKETS',
  'INSIGHTS',
  'MINGO',
  'INTEGRATIONS',
  'GENERIC',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Each category as the app's navigation names its section. */
export const NOTIFICATION_CATEGORY_LABELS: Readonly<Record<NotificationCategory, string>> = {
  DASHBOARD: 'Dashboard',
  CUSTOMERS: 'Customers',
  DEVICES: 'Devices',
  SCRIPTS: 'Scripts',
  MONITORING: 'Monitoring',
  SOFTWARE: 'Software',
  LOGS: 'Logs',
  TICKETS: 'Tickets',
  INSIGHTS: 'Insights',
  MINGO: 'Mingo',
  INTEGRATIONS: 'Integrations',
  GENERIC: 'General',
};

/** The category a notification has when it states none. */
export const DEFAULT_NOTIFICATION_CATEGORY: NotificationCategory = 'GENERIC';

export function isNotificationSeverity(value: unknown): value is NotificationSeverity {
  return typeof value === 'string' && (NOTIFICATION_SEVERITIES as readonly string[]).includes(value);
}

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === 'string' && (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}
