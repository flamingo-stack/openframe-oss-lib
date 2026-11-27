/**
 * Column layout of the Scripts tables (the library, the schedules and the
 * Execution History of a script or a schedule) and the two tabs over them. Data only, with no imports, so a
 * live table, its loading skeleton and a picture of the page read the same
 * widths without loading each other.
 */
export interface ScriptsTableColumnLayout {
  id: string;
  header?: string;
  /** The column's `meta.width` class: its width in the card rows. */
  width: string;
  /** The column's width in the grid layout, in px (the column's `size`). */
  size: number;
  /**
   * The narrowest the column resizes to in the grid, in px, where its cell holds more than text: an icon and text
   * (148, the table's `GRID_MIN_WIDTH.icon`) or an avatar and text (160, `GRID_MIN_WIDTH.media`).
   */
  minSize?: number;
  /** The column's name in the grid's settings menu, in sentence case. */
  label?: string;
  /** A row-action column in the grid: 56px, pinned right, never hidden. */
  gridKind?: 'action';
  hideAt?: 'md' | 'lg' | 'xl' | '2xl';
  align?: 'right';
  /** The header carries a sort icon. */
  sortable?: boolean;
  /** The header carries a filter dropdown, so it stays below `lg`. */
  filterable?: boolean;
  /** The header carries a calendar, so it stays below `lg`. */
  dateFilterable?: boolean;
}

/** An icon and text (the table's `GRID_MIN_WIDTH.icon`). */
const ICON_MIN_SIZE = 148;
/** An avatar and text (the table's `GRID_MIN_WIDTH.media`). */
const MEDIA_MIN_SIZE = 160;
/** One row action (the table's `GRID_ACTION_COLUMN_SIZE`). */
const ACTION_SIZE = 56;

/** The row menu's column: the same in the three tables. */
const ACTIONS_COLUMN = {
  id: 'actions',
  width: 'w-12 shrink-0 flex-none',
  align: 'right',
  size: ACTION_SIZE,
  gridKind: 'action',
} satisfies ScriptsTableColumnLayout;
/** The open-in-a-new-tab column. The card rows hide it below `md`; the grid draws it at every width. */
const OPEN_COLUMN = {
  id: 'open',
  width: 'w-12 shrink-0 flex-none',
  hideAt: 'md',
  align: 'right',
  size: ACTION_SIZE,
  gridKind: 'action',
} satisfies ScriptsTableColumnLayout;

export const SCRIPT_COLUMNS = {
  name: { id: 'name', header: 'Name', width: 'flex-1 min-w-0', size: 360, label: 'Name' },
  shellType: {
    id: 'shellType',
    header: 'Shell Type',
    width: 'w-[100px] content-md:w-[160px]',
    filterable: true,
    size: 180,
    minSize: ICON_MIN_SIZE,
    label: 'Shell type',
  },
  supportedPlatforms: {
    id: 'supportedPlatforms',
    header: 'OS',
    width: 'w-[80px]',
    hideAt: 'lg',
    filterable: true,
    size: 140,
    label: 'OS',
  },
  authorId: {
    id: 'authorId',
    header: 'Added by',
    width: 'w-[250px]',
    hideAt: 'lg',
    filterable: true,
    size: 240,
    minSize: MEDIA_MIN_SIZE,
    label: 'Added by',
  },
  actions: ACTIONS_COLUMN,
  open: OPEN_COLUMN,
} satisfies Record<string, ScriptsTableColumnLayout>;

export const SCHEDULE_COLUMNS = {
  name: { id: 'name', header: 'Script', width: 'flex-1 min-w-0', size: 360, label: 'Script' },
  supportedPlatforms: {
    id: 'supportedPlatforms',
    header: 'OS',
    width: 'w-[90px]',
    hideAt: 'lg',
    filterable: true,
    size: 140,
    label: 'OS',
  },
  dateTime: {
    id: 'dateTime',
    header: 'Date & Time',
    width: 'w-[100px] content-md:w-[160px]',
    hideAt: 'md',
    dateFilterable: true,
    size: 240,
    label: 'Date and time',
  },
  repeat: {
    id: 'repeat',
    header: 'Repeat',
    width: 'w-[120px]',
    hideAt: 'md',
    sortable: true,
    size: 180,
    label: 'Repeat',
  },
  deviceCount: {
    id: 'deviceCount',
    header: 'Devices',
    width: 'w-[100px] content-md:w-[140px]',
    hideAt: 'lg',
    size: 140,
    label: 'Devices',
  },
  actions: ACTIONS_COLUMN,
  open: OPEN_COLUMN,
} satisfies Record<string, ScriptsTableColumnLayout>;

export const EXECUTION_COLUMNS = {
  executionId: {
    id: 'executionId',
    header: 'Execution',
    width: 'w-[160px]',
    dateFilterable: true,
    size: 320,
    label: 'Execution',
  },
  status: { id: 'status', header: 'Status', width: 'w-[120px]', filterable: true, size: 160, label: 'Status' },
  machineId: {
    id: 'machineId',
    header: 'Device',
    width: 'w-[200px]',
    hideAt: 'lg',
    filterable: true,
    size: 280,
    minSize: ICON_MIN_SIZE,
    label: 'Device',
  },
  initiatorId: {
    id: 'initiatorId',
    header: 'Executed by',
    width: 'flex-1 min-w-0',
    hideAt: 'md',
    filterable: true,
    size: 320,
    minSize: MEDIA_MIN_SIZE,
    label: 'Executed by',
  },
  result: { id: 'result', header: 'Result', width: 'flex-1 min-w-0', hideAt: 'xl', size: 320, label: 'Result' },
  actions: ACTIONS_COLUMN,
  open: OPEN_COLUMN,
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

/**
 * The Execution History's columns, in render order. The table ends in two
 * 48px action columns with no header text: they carry width, so a skeleton
 * that left them out laid the `flex-1` columns ~128px wider than the loaded
 * table, and every label jumped left when the rows arrived.
 */
export const EXECUTIONS_TABLE_COLUMNS: readonly ScriptsTableColumnLayout[] = [
  EXECUTION_COLUMNS.executionId,
  EXECUTION_COLUMNS.status,
  EXECUTION_COLUMNS.machineId,
  EXECUTION_COLUMNS.initiatorId,
  EXECUTION_COLUMNS.result,
  EXECUTION_COLUMNS.actions,
  EXECUTION_COLUMNS.open,
];
