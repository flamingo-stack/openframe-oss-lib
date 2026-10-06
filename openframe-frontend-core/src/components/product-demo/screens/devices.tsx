'use client';

import { useMemo } from 'react';
import { DevicesPanelView, IDLE_DEVICES_TOOLBAR } from '../../features/devices';
import { useProductDemoCast } from '../cast';
import { buildWindowsDevicesFixture, DEVICES_SEARCH_QUERY } from '../fixtures/devices';
import type { ProductScreenViewProps } from '../types';

/** The toolbar with the search the rows answer: chrome that shows state. */
const TOOLBAR = { ...IDLE_DEVICES_TOOLBAR, searchValue: DEVICES_SEARCH_QUERY };

/** Stands in for the page header (title, view switch, buttons): the job is named above the picture. */
const NO_HEADER = <></>;

const HIDDEN_WHEN_COMPACT = ['organization'];

/**
 * The product's Devices page in its table view, answering a search: the query
 * in the toolbar, the rows that match. No title row (the job is named above the
 * picture) and no row menu (a closed menu carries nothing and the customer
 * needs the room). The narrow rendering drops the customer column and keeps
 * device, status and OS.
 */
export default function DevicesScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildWindowsDevicesFixture(cast), [cast]);
  return (
    <div className="h-full bg-ods-bg">
      <DevicesPanelView
        className="p-[var(--spacing-system-l)]"
        headerSlot={NO_HEADER}
        toolbar={TOOLBAR}
        viewMode="table"
        devices={fixture.devices}
        deviceFilters={fixture.deviceFilters}
        totalCount={fixture.totalCount}
        hideColumns={compact ? HIDDEN_WHEN_COMPACT : undefined}
      />
    </div>
  );
}
