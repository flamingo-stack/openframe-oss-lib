'use client';

import { MediaSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { TruncateText } from '../../ui/truncate-text';
import { providerMark, TENANT_EMPTY_VALUE } from './tenant-presentation';

export interface TenantCellProps {
  provider: string;
  name: string;
  domain?: string | null;
}

/** TENANT column: provider mark + name over the domain. */
export function TenantCell({ provider, name, domain }: TenantCellProps) {
  const { Logo, label } = providerMark(provider);
  // While the tenant is read (a loading scope) its provider's mark is a box and its name and domain are bars.
  const loading = useLoadingScope();
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        {loading ? (
          <MediaSkeleton.Icon size="md" className="shrink-0" />
        ) : (
          <Logo size={24} role="img" aria-label={label} className="shrink-0" />
        )}
        <TruncateText>{name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary" loading={loading}>
        {domain ?? TENANT_EMPTY_VALUE}
      </TruncateText>
    </div>
  );
}
