'use client';

import { cn } from '../../../utils/cn';
import { useLoadingScope } from '../../ui/loading-scope';
import { TruncateText } from '../../ui/truncate-text';
import { licenseSummaryLines } from './tenant-presentation';
import type { TenantLicenseSummary } from './tenant-row';

export interface TenantLicensesCellProps {
  licenses?: TenantLicenseSummary | null;
}

/** LICENCES column: assigned of purchased over what is unused (Figma 3025-3536). */
export function TenantLicensesCell({ licenses }: TenantLicensesCellProps) {
  // While the tenant is read (a loading scope) both lines are bars.
  const loading = useLoadingScope();
  const { value, detail, warning } = licenseSummaryLines(licenses);
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <TruncateText loading={loading}>{value}</TruncateText>
      {(loading || detail) && (
        <TruncateText variant="h6" tone="secondary" loading={loading} className={cn(warning && 'text-ods-warning')}>
          {detail ?? ''}
        </TruncateText>
      )}
    </div>
  );
}
