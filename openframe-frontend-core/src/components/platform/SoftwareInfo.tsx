/**
 * SoftwareInfo Component
 *
 * Displays software name with optional vendor information below it.
 * Part of the ODS (OpenFrame Design System) platform components.
 *
 * @example
 * ```tsx
 * <SoftwareInfo name="Visual Studio Code" vendor="Microsoft" />
 * <SoftwareInfo name="Chrome" /> // Without vendor
 * ```
 */

import type React from 'react';
import { cn } from '../../utils/cn';

export interface SoftwareInfoProps {
  /** Software name (required) */
  name: string;
  /** Software vendor (optional) */
  vendor?: string;
  /** Software version (optional) */
  version?: string;
  /** Additional CSS classes */
  className?: string;
}

export const SoftwareInfo: React.FC<SoftwareInfoProps> = ({ name, vendor, version, className }) => {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2">
        <div className="text-ods-text-primary text-h4">{name}</div>
        {version && (
          <div className="rounded bg-ods-bg-surface px-2 py-1 text-ods-text-secondary text-h6">{version}</div>
        )}
      </div>
      {vendor && <div className="text-ods-text-secondary text-h6">{vendor}</div>}
    </div>
  );
};

SoftwareInfo.displayName = 'SoftwareInfo';
