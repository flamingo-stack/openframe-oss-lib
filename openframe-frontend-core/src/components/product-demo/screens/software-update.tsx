'use client';

import { DeviceSelector } from '../../features/devices';
import {
  PACKAGE_SEARCH_LABEL,
  PACKAGE_SEARCH_PLACEHOLDER,
  type PackageSearchSlotProps,
  SoftwareActionForm,
} from '../../features/software';
import { Autocomplete } from '../../ui';
import { SOFTWARE_UPDATE_FIXTURE } from '../fixtures/software-update';
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

/**
 * The product's Update Software page: Chrome through WinGet, scheduled for
 * tonight, on two selected devices. The narrow rendering drops the picker's
 * customer column.
 */
export default function SoftwareUpdateScreen({ compact = false }: ProductScreenViewProps) {
  return (
    <div className="h-full bg-ods-bg">
      <SoftwareActionForm
        action={SOFTWARE_UPDATE_FIXTURE.action}
        onBack={noop}
        onSubmit={noop}
        timing={SOFTWARE_UPDATE_FIXTURE.timing}
        initialValues={SOFTWARE_UPDATE_FIXTURE.initialValues}
        renderPackageSearch={renderPackageSearch}
        renderDevicePicker={() => (
          <DeviceSelector
            devices={SOFTWARE_UPDATE_FIXTURE.devices}
            loading={false}
            selectedIds={SOFTWARE_UPDATE_FIXTURE.selectedIds}
            onSelectionChange={noop}
            showSelectionModeRadio={false}
            hideColumns={compact ? HIDDEN_WHEN_COMPACT : undefined}
          />
        )}
      />
    </div>
  );
}
