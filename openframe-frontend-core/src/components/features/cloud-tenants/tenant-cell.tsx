'use client';

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
  return (
    <div className="flex min-w-0 flex-col justify-center">
      <div className="flex min-w-0 items-center gap-[var(--spacing-system-xxs)]">
        <Logo size={24} role="img" aria-label={label} className="shrink-0" />
        <TruncateText>{name}</TruncateText>
      </div>
      <TruncateText variant="h6" tone="secondary">
        {domain ?? TENANT_EMPTY_VALUE}
      </TruncateText>
    </div>
  );
}
