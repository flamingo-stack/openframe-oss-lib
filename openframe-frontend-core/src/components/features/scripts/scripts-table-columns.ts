/**
 * Column layout of the two Scripts list tables (the library and the
 * schedules) and the two tabs over them. Data only, with no imports, so a
 * live table, its loading skeleton and a picture of the page read the same
 * widths without loading each other.
 */
export interface ScriptsTableColumnLayout {
  id: string;
  header?: string;
  /** The column's `meta.width` class. */
  width: string;
  hideAt?: 'md' | 'lg' | 'xl' | '2xl';
  align?: 'right';
  /** The header carries a sort icon. */
  sortable?: boolean;
  /** The header carries a filter dropdown, so it stays below `lg`. */
  filterable?: boolean;
  /** The header carries a calendar, so it stays below `lg`. */
  dateFilterable?: boolean;
}

export const SCRIPT_COLUMNS = {
  name: { id: 'name', header: 'Name', width: 'flex-1 min-w-0' },
  shellType: { id: 'shellType', header: 'Shell Type', width: 'w-[100px] content-md:w-[160px]', filterable: true },
  supportedPlatforms: { id: 'supportedPlatforms', header: 'OS', width: 'w-[80px]', hideAt: 'lg', filterable: true },
  authorId: { id: 'authorId', header: 'Added by', width: 'w-[250px]', hideAt: 'lg', filterable: true },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, ScriptsTableColumnLayout>;

export const SCHEDULE_COLUMNS = {
  name: { id: 'name', header: 'Script', width: 'flex-1 min-w-0' },
  supportedPlatforms: { id: 'supportedPlatforms', header: 'OS', width: 'w-[90px]', hideAt: 'lg', filterable: true },
  dateTime: {
    id: 'dateTime',
    header: 'Date & Time',
    width: 'w-[100px] content-md:w-[160px]',
    hideAt: 'md',
    dateFilterable: true,
  },
  repeat: { id: 'repeat', header: 'Repeat', width: 'w-[120px]', hideAt: 'md', sortable: true },
  deviceCount: { id: 'deviceCount', header: 'Devices', width: 'w-[100px] content-md:w-[140px]', hideAt: 'lg' },
  actions: { id: 'actions', width: 'w-12 shrink-0 flex-none', align: 'right' },
  open: { id: 'open', width: 'w-12 shrink-0 flex-none', hideAt: 'md', align: 'right' },
} satisfies Record<string, ScriptsTableColumnLayout>;

/** Cell widths of the Scripts / Schedules switcher, for its loading state. */
export const SCRIPTS_TAB_WIDTHS: readonly string[] = ['w-[160px]', 'w-[200px]'];

/** The library's columns, in render order. */
export const SCRIPTS_TABLE_COLUMNS: readonly ScriptsTableColumnLayout[] = [
  SCRIPT_COLUMNS.name,
  SCRIPT_COLUMNS.shellType,
  SCRIPT_COLUMNS.supportedPlatforms,
  SCRIPT_COLUMNS.authorId,
  SCRIPT_COLUMNS.actions,
  SCRIPT_COLUMNS.open,
];

/** The schedules' columns, in render order. */
export const SCHEDULES_TABLE_COLUMNS: readonly ScriptsTableColumnLayout[] = [
  SCHEDULE_COLUMNS.name,
  SCHEDULE_COLUMNS.supportedPlatforms,
  SCHEDULE_COLUMNS.dateTime,
  SCHEDULE_COLUMNS.repeat,
  SCHEDULE_COLUMNS.deviceCount,
  SCHEDULE_COLUMNS.actions,
  SCHEDULE_COLUMNS.open,
];
