import type { ReactNode } from 'react';
import type { ColumnFiltersState } from '../../../ui';
import type { DeviceFilters, DeviceRow } from '../types';

export type SubTab = 'available' | 'selected';

/** The two ways a consumer can target devices, the picker's top-level radio. */
export type DeviceSelectionMode = 'specific' | 'criteria';

/** The narrowing the picker is showing, in the component's own vocabulary. */
export interface DeviceSelectorNarrowing {
  /** Column funnels (status / customer / os), TanStack-shaped. */
  columnFilters: ColumnFiltersState;
  /** Tag chips in the search bar, `key:value`. */
  tags: string[];
}

/**
 * Hands the picker's state to a parent that answers it from the server.
 *
 * Present ⇒ the component stops deriving anything from the `devices` array:
 * `devices` IS the current tab's page, the Available/Selected split is two
 * server queries rather than one list partitioned by `selectedIds`, and search,
 * filters and the bulk actions are questions for the backend. Absent ⇒ every
 * bit of that stays client-side exactly as before, which is what the other
 * consumers (Run/Test Script, monitoring) rely on.
 *
 * The row action is add-or-remove by tab, not a toggle: with only a page of the
 * assignment in hand, "is this one selected?" is not a question the client can
 * answer. Selected always offers remove; on Available the row flips off
 * `selectedIds`, which the parent fills from the connection's own per-row
 * "already assigned" flag rather than from the page it holds.
 */
export interface DeviceSelectorServer<T extends DeviceRow = DeviceRow> {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  /** Search box value. The parent debounces it into its query. */
  search: string;
  onSearchChange: (value: string) => void;
  narrowing: DeviceSelectorNarrowing;
  onNarrowingChange: (next: DeviceSelectorNarrowing) => void;
  /**
   * Options for the column funnels. Rows are paged, so options derived from
   * them would only ever offer what page one happens to contain.
   */
  filterOptions?: DeviceFilters | null;
  /** Size of the whole assignment, the "Selected Devices (N)" label. */
  selectedCount: number;
  /** Server-side count for the list on screen, for the header's row count. */
  totalCount?: number;
  /** Row actions. Committed immediately; there is no Save to batch them into. */
  onAdd: (device: T) => void;
  onRemove: (device: T) => void;
  /** Header bulk actions, resolved server-side over the current narrowing. */
  onAddAll: () => void;
  onRemoveAll: () => void;
}

export interface DeviceSelectorInfiniteScroll {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  skeletonRows: number;
}

export interface DeviceSelectorProps<T extends DeviceRow = DeviceRow> {
  /** Devices to display. Consumer controls fetching and pre-filtering. */
  devices: T[];
  /** Whether the device list is loading. */
  loading: boolean;
  /**
   * Currently selected device keys. Optional so a skeleton can render the real
   * picker with nothing selected, the component falls back to an empty set and
   * a no-op change handler. Every consumer a user can act on passes both.
   *
   * In `server` mode this is not the picker's own state, the parent fills it
   * with the rows the backend reports as already assigned, so the Available tab
   * pre-checks them instead of offering to add what is already in.
   */
  selectedIds?: Set<string>;
  /** Called when selection changes. Optional for the same reason as `selectedIds`. */
  onSelectionChange?: (ids: Set<string>) => void;
  /** Extract the unique string key for selection from a device. Defaults to `d.machineId ?? d.id`. */
  getDeviceKey?: (device: T) => string | undefined;
  /** Infinite scroll config for the available tab. */
  infiniteScroll?: DeviceSelectorInfiniteScroll;
  /** Disable all interactions (e.g. during save). */
  disabled?: boolean;
  /** Show selection mode radio group. Default: true. */
  showSelectionModeRadio?: boolean;
  /**
   * Controls the selection-mode radio. Passing it is what ENABLES the "by
   * criteria" option, a consumer that leaves it out gets the uncontrolled
   * radio with criteria disabled and tagged "Coming Soon", which is what the
   * monitoring and run-script pages still want.
   */
  selectionMode?: DeviceSelectionMode;
  onSelectionModeChange?: (mode: DeviceSelectionMode) => void;
  /**
   * The rule editor, rendered in place of the whole picker card while
   * `selectionMode` is `'criteria'` (design 460:85294 drops the card frame
   * there, fields and table sit straight on the page).
   *
   * The table below it then shows what the rule currently resolves to: no row
   * actions, no search box, no column funnels, the rule IS the narrowing, and a
   * second one layered on top would make the row count answer a different
   * question than the one the user is editing.
   */
  criteriaContent?: ReactNode;
  /** Extra content rendered above the selection radio / tabs (e.g. ScheduleInfoBar). */
  headerContent?: ReactNode;
  /** Table rowKey. Default: "id". */
  rowKey?: string;
  /** "replace" replaces entire selection on Add All; "merge" adds to existing. Default: "merge". */
  addAllBehavior?: 'replace' | 'merge';
  /** Allow only one device to be selected at a time. Default: false. */
  singleSelect?: boolean;
  /** Return a tooltip string if the device should be disabled, or undefined if enabled. */
  isDeviceDisabled?: (device: T) => string | undefined;
  /** Column ids to drop from the table (e.g. `['organization', 'status']` to leave only device + os). */
  hideColumns?: string[];
  /**
   * Server-side size of the list on screen, for the header's row count. Only
   * needed when the rows are paged but `server` is not in play (the criteria
   * preview); `server.totalCount` covers the server-driven picker.
   */
  totalCount?: number;
  /**
   * Switches the picker to server-driven mode, see {@link DeviceSelectorServer}.
   * Omit for the client-side behaviour every other consumer uses.
   */
  server?: DeviceSelectorServer<T>;
}
