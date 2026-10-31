import type { ReactNode } from 'react';
import { AgentMark } from '../../agent-mark';
import { NamedIcon, type IconRef } from '../../chat/utils/icon-loading';

/**
 * Backend `NotificationCategory` → icon, the icon of the dashboard section the
 * notification belongs to (the app navigation's own). A table of icon NAMES: an
 * icon is loaded when a notification of its category is drawn. GENERIC,
 * INTEGRATIONS and unknown categories have none (the tile draws its severity
 * dot). Every icon takes the host's text colour, so a row of them is one colour.
 */
const ICON_BY_CATEGORY: Readonly<Record<string, IconRef>> = {
  DASHBOARD: { set: 'ChartDonutIcon' },
  CUSTOMERS: { set: 'IdCardIcon' },
  DEVICES: { set: 'MonitorIcon' },
  SCRIPTS: { set: 'BracketCurlyIcon' },
  MONITORING: { set: 'RadarIcon' },
  SOFTWARE: { set: 'PackageIcon' },
  LOGS: { set: 'ClipboardListIcon' },
  TICKETS: { set: 'TagIcon' },
  INSIGHTS: { set: 'AlertTriangleIcon' },
};

/** The category whose notifications carry the assistant's own mark, drawn from its identity. */
const ASSISTANT_CATEGORY = 'MINGO';

/**
 * The icon a notification of this category shows in its tile's header, or
 * `undefined` when the category has none. Pass it as `Notification.icon`.
 */
export function notificationCategoryIcon(category: string | null | undefined): ReactNode | undefined {
  const key = category?.toUpperCase();
  if (!key) return undefined;
  if (key === ASSISTANT_CATEGORY) return <AgentMark agent="mingo" className="size-4" color="currentColor" />;
  // A table's own entry only: a backend string never resolves to `Object.prototype` (`constructor`, `toString`).
  const icon = Object.prototype.hasOwnProperty.call(ICON_BY_CATEGORY, key) ? ICON_BY_CATEGORY[key] : undefined;
  return icon ? <NamedIcon icon={icon} size={16} /> : undefined;
}
