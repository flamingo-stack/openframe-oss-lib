'use client';

import { cn } from '../../utils';
import { OpenframeLogoIcon } from '../icons-v2-generated/logos/openframe-logo-icon';
import { OpenframeTextIcon } from '../icons-v2-generated/logos/openframe-text-icon';

export interface NavigationSidebarHeaderProps {
  minimized: boolean;
}

export function NavigationSidebarHeader({ minimized }: NavigationSidebarHeaderProps) {
  return (
    <div className="flex h-14 items-center justify-start border-b border-ods-border p-[var(--spacing-system-m)]">
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
