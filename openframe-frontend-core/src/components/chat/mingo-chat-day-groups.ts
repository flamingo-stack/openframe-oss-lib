import { formatDateWithTimezone, VIEWER_TIMEZONE } from '../../utils/format';
import type { DialogItem } from './types/component.types';

/** A dialog's time in ms, or null when it has none (or an unparseable one). */
export function dialogTimestamp(dialog: Pick<DialogItem, 'timestamp'>): number | null {
  if (!dialog.timestamp) return null;
  const t = typeof dialog.timestamp === 'string' ? Date.parse(dialog.timestamp) : dialog.timestamp.getTime();
  return Number.isNaN(t) ? null : t;
}

export interface DialogDayGroup {
  /** Stable per day: `today`, `yesterday`, `day-<local midnight ms>`, `undated`. */
  key: string;
  /** "Today", "Yesterday", then the day ("9 Oct" / "Oct 9" by the viewer's locale; the year when it is not this one). */
  label: string;
  items: DialogItem[];
}

/** Local midnight of the day `days` away from `date`'s (calendar arithmetic, so DST days are not 24 h). */
function localMidnight(date: Date, days = 0): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days).getTime();
}

/** The day's caption: client-only UI in the viewer's own zone and locale. */
function dayLabel(time: number, now: Date): string {
  const date = new Date(time);
  return formatDateWithTimezone(
    date,
    VIEWER_TIMEZONE,
    { day: 'numeric', month: 'short', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' },
    { viewerLocale: true },
  );
}

/**
 * Dialogs grouped by the viewer's local day: "Today", "Yesterday", then one
 * group per earlier day. Groups keep the order in which the host's list first
 * reaches them (newest first), rows keep theirs; dialogs without a time close
 * the list under "Older". A time in the future counts as today.
 */
export function groupDialogsByDay(dialogs: ReadonlyArray<DialogItem>, now: Date = new Date()): DialogDayGroup[] {
  const startOfToday = localMidnight(now);
  const startOfYesterday = localMidnight(now, -1);
  const groups = new Map<string, DialogDayGroup>();
  const undated: DialogItem[] = [];

  for (const dialog of dialogs) {
    const time = dialogTimestamp(dialog);
    if (time === null) {
      undated.push(dialog);
      continue;
    }
    let key: string;
    let label: string;
    if (time >= startOfToday) {
      key = 'today';
      label = 'Today';
    } else if (time >= startOfYesterday) {
      key = 'yesterday';
      label = 'Yesterday';
    } else {
      key = `day-${localMidnight(new Date(time))}`;
      label = dayLabel(time, now);
    }
    const group = groups.get(key);
    if (group) group.items.push(dialog);
    else groups.set(key, { key, label, items: [dialog] });
  }

  const result = [...groups.values()];
  if (undated.length > 0) result.push({ key: 'undated', label: 'Older', items: undated });
  return result;
}
