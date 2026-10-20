'use client';

import { DevicesPanelView, type DeviceFilters, type DeviceRow, IDLE_DEVICES_TOOLBAR } from '../../features/devices';

/** What the Devices page shows for a search: the query in the field and the rows that answer it. */
export const DEVICES_SEARCH_QUERY = 'Windows';

/** The toolbar with the search the rows answer: chrome that shows state. */
const TOOLBAR = { ...IDLE_DEVICES_TOOLBAR, searchValue: DEVICES_SEARCH_QUERY };

/** Stands in for the page header (title, view switch, buttons): the job is named above the picture. */
const NO_HEADER = <></>;

const HIDDEN_WHEN_COMPACT = ['organization'];
const NO_DEVICES: DeviceRow[] = [];

export interface DevicesScreenViewProps {
  compact?: boolean;
  /** The rows, from the screen's fixture. */
  devices?: DeviceRow[];
  deviceFilters?: DeviceFilters | null;
  totalCount?: number;
  /** The screen's code is still being fetched: the same panel in its own loading state. */
  loading?: boolean;
}

/**
 * The product's Devices page in its table view, answering a search: the query in the toolbar, the rows that
 * match. No title row (the job is named above the picture) and no row menu (a closed menu carries nothing and
 * the customer needs the room). The narrow rendering drops the customer column and keeps device, status and OS.
 *
 * Read by the screen (with its fixture) and by its skeleton (`loading`: the panel's own loading state, the real
 * toolbar locked and the rows skeletons), so the two are one layout.
 */
export function DevicesScreenView({
  compact = false,
  devices = NO_DEVICES,
  deviceFilters,
  totalCount,
  loading = false,
}: DevicesScreenViewProps) {
  return (
    <div className="h-full bg-ods-bg">
      <DevicesPanelView
        className="p-[var(--spacing-system-l)]"
        headerSlot={NO_HEADER}
        toolbar={TOOLBAR}
        viewMode="table"
        devices={devices}
        deviceFilters={deviceFilters}
        totalCount={totalCount}
        hideColumns={compact ? HIDDEN_WHEN_COMPACT : undefined}
        loading={loading}
        loadingRegion={false}
      />
    </div>
  );
}
