'use client';

import type { ReactNode } from 'react';
import { TrashIcon } from '../../icons-v2-generated';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TruncateText } from '../../ui';
import {
  PACKAGE_MANAGER_ICON,
  PACKAGE_MANAGER_LABEL,
  PACKAGE_MANAGERS,
  type SupportedPackageManager,
} from './package-managers';
import type { SelectedPackage, SoftwareRow } from './software-row';

/** What the "Software Name" slot is handed: one catalog, the picked package and its writer. */
export interface PackageSearchSlotProps {
  packageManager: SupportedPackageManager;
  value: SelectedPackage | null;
  onChange: (pkg: SelectedPackage | null) => void;
}

export interface SoftwareRowFieldsProps {
  row: SoftwareRow;
  removable: boolean;
  onChange: (row: SoftwareRow) => void;
  onRemove: () => void;
  /**
   * The "Software Name" field. A slot, because searching a catalog is the
   * host's query: the product passes its data-bound picker, a fixture a static one.
   */
  renderPackageSearch: (field: PackageSearchSlotProps) => ReactNode;
}

/** A value over its label; a missing value draws the muted empty mark. */
function InfoCell({ value, label }: { value: string | null | undefined; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {value ? (
          <div className="min-w-0 flex-1">
            <TruncateText>{value}</TruncateText>
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-h4">
            <span className="text-ods-text-secondary">—</span>
          </div>
        )}
      </div>
      <p className="truncate text-ods-text-secondary text-h6">{label}</p>
    </div>
  );
}

/** One package to install or update: its manager, the package, and what the catalog says about it. */
export function SoftwareRowFields({ row, removable, onChange, onRemove, renderPackageSearch }: SoftwareRowFieldsProps) {
  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-l)] content-lg:flex-row content-lg:items-end">
      <div className="min-w-0 flex-1">
        <Select
          value={row.packageManager}
          onValueChange={value => onChange({ ...row, packageManager: value as SupportedPackageManager, pkg: null })}
        >
          <SelectTrigger label="Package Manager" labelVariant="large">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PACKAGE_MANAGERS.map(manager => {
              const Icon = PACKAGE_MANAGER_ICON[manager];
              return (
                <SelectItem key={manager} value={manager}>
                  <span className="flex items-center gap-[var(--spacing-system-xsf)]">
                    <Icon size={20} className="shrink-0 text-ods-text-secondary" />
                    {PACKAGE_MANAGER_LABEL[manager]}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 flex-1">
        {renderPackageSearch({
          packageManager: row.packageManager,
          value: row.pkg,
          onChange: pkg => onChange({ ...row, pkg }),
        })}
      </div>

      <InfoCell value={row.pkg?.description} label="Description" />

      <div className="flex min-w-0 flex-1 items-end gap-[var(--spacing-system-lf)]">
        <InfoCell value={row.pkg?.version} label="Current Version" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Remove software"
          onClick={onRemove}
          disabled={!removable}
          leftIcon={<TrashIcon size={24} className="text-ods-error" />}
        />
      </div>
    </div>
  );
}
