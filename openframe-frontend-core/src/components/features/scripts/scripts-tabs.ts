import { BracketCurlyIcon } from '../../icons-v2-generated/coding/bracket-curly-icon';
import { TimerIcon } from '../../icons-v2-generated/date-and-time/timer-icon';
import type { TabItem } from '../../ui/tab-navigation';

export type ScriptsTabId = 'list' | 'schedules';

/** The two Scripts pages, as the switcher over them names them. */
export const SCRIPTS_TABS: TabItem[] = [
  { id: 'list', label: 'Scripts List', icon: BracketCurlyIcon },
  { id: 'schedules', label: 'Scripts Schedules', icon: TimerIcon },
];
