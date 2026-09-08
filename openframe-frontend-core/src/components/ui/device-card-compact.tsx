import type React from 'react';
import { cn } from '../../utils/cn';

export interface DeviceCardCompactProps extends React.HTMLAttributes<HTMLDivElement> {
  deviceName?: string | null;
  organization?: string | null;
}

/**
 * Compact device card variant for table cells
 * Shows only device name and organization in a stacked layout
 * Returns empty fragment if both values are missing
 */
export function DeviceCardCompact({ deviceName, organization, className, ...props }: DeviceCardCompactProps) {
  // Check for valid values (not null, undefined, '-', or string 'null')
  const hasName = deviceName && deviceName !== '-' && deviceName !== 'null';
  const hasOrg = organization && organization !== '-' && organization !== 'null';

  // If both are missing, return empty fragment
  if (!hasName && !hasOrg) {
    return <></>;
  }

  return (
    <div className={cn('flex min-h-[60px] flex-col justify-center gap-1 py-2', className)} {...props}>
      {hasName && (
        <span className="truncate text-ods-text-primary text-h6" title={deviceName}>
          {deviceName}
        </span>
      )}
      {hasOrg && (
        <span className="truncate text-ods-text-secondary text-h6" title={organization}>
          {organization}
        </span>
      )}
    </div>
  );
}
