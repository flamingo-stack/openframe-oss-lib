'use client';

import { cn } from '../../utils';
import { OpenframeLogoIcon } from '../icons-v2-generated/logos/openframe-logo-icon';
import { OpenframeTextIcon } from '../icons-v2-generated/logos/openframe-text-icon';

export interface NavigationSidebarHeaderProps {
  minimized: boolean;
  /** The border under the row. Default `border-ods-border`. */
  borderClassName?: string;
}

export function NavigationSidebarHeader({
  minimized,
  borderClassName = 'border-ods-border',
}: NavigationSidebarHeaderProps) {
  return (
    <div className={cn('flex h-14 items-center justify-start border-b p-[var(--spacing-system-m)]', borderClassName)}>
      <div className="flex-shrink-0">
        <OpenframeLogoIcon
          secondaryColor="var(--color-accent-primary)"
          className="h-6 w-6"
          color="var(--color-text-primary)"
        />
      </div>

      <div
        className={cn(
          'min-w-0 flex-1 overflow-hidden transition-[opacity,margin-left] duration-300',
          minimized ? 'ml-0 opacity-0' : 'ml-[var(--spacing-system-xs)] opacity-100',
        )}
        aria-hidden={minimized}
      >
        <OpenframeTextIcon color="var(--color-text-primary)" className="h-[15px] w-[87px]" />
      </div>
    </div>
  );
}
