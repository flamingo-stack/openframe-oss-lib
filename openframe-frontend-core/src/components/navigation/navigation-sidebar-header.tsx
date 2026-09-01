'use client';

import { cn } from '../../utils';
import { OpenFrameLogo, OpenFrameText } from '../icons';

export interface NavigationSidebarHeaderProps {
  minimized: boolean;
}

export function NavigationSidebarHeader({ minimized }: NavigationSidebarHeaderProps) {
  return (
    <div className="flex h-14 items-center justify-start border-b border-ods-border p-[var(--spacing-system-m)]">
      <div className="flex-shrink-0">
        <OpenFrameLogo
          className="h-6 w-6"
          upperPathColor="var(--color-text-primary)"
          lowerPathColor="var(--color-accent-primary)"
        />
      </div>

      <div
        className={cn(
          'min-w-0 flex-1 overflow-hidden transition-[opacity,margin-left] duration-300',
          minimized ? 'ml-0 opacity-0' : 'ml-[var(--spacing-system-xs)] opacity-100',
        )}
        aria-hidden={minimized}
      >
        <OpenFrameText textColor="var(--color-text-primary)" />
      </div>
    </div>
  );
}
