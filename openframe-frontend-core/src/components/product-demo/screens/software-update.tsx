'use client';

import { useMemo } from 'react';
import { DeviceSelector } from '../../features/devices';
import {
  PACKAGE_SEARCH_LABEL,
  PACKAGE_SEARCH_PLACEHOLDER,
  type PackageSearchSlotProps,
  SoftwareActionForm,
} from '../../features/software';
import { Autocomplete } from '../../ui';
import { useProductDemoCast } from '../cast';
import { buildSoftwareUpdateFixture } from '../fixtures/software-update';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};

const HIDDEN_WHEN_COMPACT = ['organization'];

/** "Software Name" with the fixture's package picked: the product's field, minus its catalog search. */
function StaticPackageField({ value }: PackageSearchSlotProps) {
  return (
    <Autocomplete
      label={PACKAGE_SEARCH_LABEL}
      labelVariant="large"
      options={value ? [{ value: value.id, label: value.name, description: value.description ?? undefined }] : []}
      value={value?.id ?? null}
      onChange={noop}
      placeholder={PACKAGE_SEARCH_PLACEHOLDER}
    />
  );
}

const renderPackageSearch = (field: PackageSearchSlotProps) => <StaticPackageField {...field} />;

const NO_NARROWING = { columnFilters: [], tags: [] };

/**
 * The product's Update Software page: Chrome through WinGet, scheduled for
 * tonight, with the devices picked for it on the "Selected Devices" tab. The
 * page's title row is left out (the job is named above the picture), so the
 * frame starts at the package. The narrow rendering drops the picker's
 * customer column.
 */
export default function SoftwareUpdateScreen({ compact = false }: ProductScreenViewProps) {
  const cast = useProductDemoCast();
  const fixture = useMemo(() => buildSoftwareUpdateFixture(cast), [cast]);
  const selected = useMemo(
    () => fixture.devices.filter(device => fixture.selectedIds.has(device.id)),
    [fixture.devices, fixture.selectedIds],
  );
  return (
    <div className="h-full bg-ods-bg pt-[var(--spacing-system-l)]">
      <div className="h-full">
        <SoftwareActionForm
          action={fixture.action}
          showHeader={false}
          onSubmit={noop}
          timing={fixture.timing}
          initialValues={fixture.initialValues}
          renderPackageSearch={renderPackageSearch}
          renderDevicePicker={() => (
            <DeviceSelector
              devices={selected}
              loading={false}
              selectedIds={fixture.selectedIds}
              showSelectionModeRadio={false}
              hideColumns={compact ? HIDDEN_WHEN_COMPACT : undefined}
              // The picker's server mode is how a host says which tab is open: the picture shows what was picked.
              server={{
                activeTab: 'selected',
                onTabChange: noop,
                search: '',
                onSearchChange: noop,
                narrowing: NO_NARROWING,
                onNarrowingChange: noop,
                selectedCount: selected.length,
                totalCount: selected.length,
                onAdd: noop,
                onRemove: noop,
                onAddAll: noop,
                onRemoveAll: noop,
              }}
            />
          )}
        />
      </div>
    </div>
  );
}
