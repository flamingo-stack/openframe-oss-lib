'use client';

import type { Column } from '@tanstack/react-table';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import { createLocalStorageAdapter, type LocalStorageAdapter } from '../../../utils/local-storage-adapter';
import { buildGridLayout, type GridLayout } from './data-table-grid';

/**
 * What the viewer changed about a grid table's columns: which are hidden, their order, their widths. Columns are named
 * by id; an id the table no longer has is ignored, and a column the list does not name keeps its designed place.
 */
export interface GridColumnPrefs {
  /** Data column ids, in the viewer's order. */
  order: string[];
  /** Data column ids the viewer hid. */
  hidden: string[];
  /** Widths the viewer set by resizing, in px, by column id. */
  sizing: Record<string, number>;
}

export const EMPTY_GRID_PREFS: GridColumnPrefs = Object.freeze({
  order: Object.freeze([]) as unknown as string[],
  hidden: Object.freeze([]) as unknown as string[],
  sizing: Object.freeze({}) as Record<string, number>,
});

/** The settings of a grid table (`<DataTable layout="grid" settings={...}>`): they put the gear in its header. */
export interface DataTableSettings {
  /**
   * Names the table in the browser's storage: its column layout (hidden columns, order, widths) is kept under it and
   * read back on the next visit. Two tables with one key share a layout. Without it the layout lasts until reload.
   */
  storageKey?: string;
  /**
   * The menu's "Enable auto-refresh" switch. The page owns what refreshing means and whether it is on; without this
   * the menu has no such item.
   */
  autoRefresh?: { enabled: boolean; onChange: (enabled: boolean) => void };
}

export interface GridPrefsStore {
  subscribe: (listener: () => void) => () => void;
  get: () => GridColumnPrefs;
  /** What a server render and the hydration pass read: the designed layout. */
  getServer: () => GridColumnPrefs;
  /**
   * Change the layout. `persist: false` keeps the change out of storage (a drag's every step); `persist()` writes
   * the current layout once it has settled.
   */
  update: (change: (prefs: GridColumnPrefs) => GridColumnPrefs, options?: { persist?: boolean }) => void;
  persist: () => void;
}

interface StoredPrefs extends GridColumnPrefs {
  version: 1;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

function isStoredPrefs(parsed: unknown): parsed is StoredPrefs {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const { version, order, hidden, sizing } = parsed as Record<string, unknown>;
  return (
    version === 1 &&
    isStringArray(order) &&
    isStringArray(hidden) &&
    typeof sizing === 'object' &&
    sizing !== null &&
    Object.values(sizing).every(size => typeof size === 'number' && Number.isFinite(size) && size > 0)
  );
}

/** The storage key of a table's layout. */
export const gridPrefsStorageKey = (storageKey: string) => `ods-data-table:${storageKey}`;

/**
 * One table's column layout: held in memory, and in the browser's storage when the table is named. The stored layout
 * is read on the first client read, never on the server.
 */
export function createGridPrefsStore(storageKey?: string): GridPrefsStore {
  const listeners = new Set<() => void>();
  const storage: LocalStorageAdapter<StoredPrefs> | null = storageKey
    ? createLocalStorageAdapter<StoredPrefs>({
        key: gridPrefsStorageKey(storageKey),
        validate: isStoredPrefs,
        logTag: '[data-table]',
      })
    : null;
  let value: GridColumnPrefs | null = null;

  const get = () => {
    if (value === null) {
      const stored = storage?.load();
      value = stored ? { order: stored.order, hidden: stored.hidden, sizing: stored.sizing } : EMPTY_GRID_PREFS;
    }
    return value;
  };
  const persist = () => storage?.save({ version: 1, ...get() });

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    get,
    getServer: () => EMPTY_GRID_PREFS,
    update(change, options) {
      const current = get();
      const next = change(current);
      if (next === current) return;
      value = next;
      if (options?.persist !== false) persist();
      for (const listener of listeners) listener();
    },
    persist,
  };
}

/** A table's layout store and whether it draws the settings gear. Stable for the table's life. */
export interface GridPrefsContextValue {
  store: GridPrefsStore;
  /** The table has settings: its last header cell is the gear (`table/utility-cell`, type settings). */
  settingsEnabled: boolean;
}

/** Outside a grid root (a header or body mounted on its own): the designed layout, and nothing to change. */
const NO_PREFS: GridPrefsContextValue = { store: createGridPrefsStore(), settingsEnabled: false };

export const GridPrefsContext = createContext<GridPrefsContextValue>(NO_PREFS);
/** The table's `settings`, for the menu. Its own context: a page passes it inline, and only the gear reads it. */
export const GridSettingsContext = createContext<DataTableSettings | null>(null);

/** The table's column layout, live. */
export function useGridPrefs(): GridColumnPrefs {
  const { store } = useContext(GridPrefsContext);
  return useSyncExternalStore(store.subscribe, store.get, store.getServer);
}

/**
 * The grid's columns as the header and the rows draw them: the table's visible columns with the viewer's order and
 * hidden columns applied. Widths are not part of it (every cell reads its width from the root's CSS variables), so a
 * resize builds no new structure and renders no row.
 */
export function useGridStructure<T>(visibleColumns: Column<T, unknown>[]): GridLayout {
  const { settingsEnabled } = useContext(GridPrefsContext);
  const { order, hidden } = useGridPrefs();
  return useMemo(
    () => buildGridLayout(visibleColumns, { order, hidden, settings: settingsEnabled }),
    [visibleColumns, order, hidden, settingsEnabled],
  );
}
