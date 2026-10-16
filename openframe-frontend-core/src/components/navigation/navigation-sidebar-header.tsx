'use client';

import type { NavigationSidebarSlot } from '../../types/navigation';
import { cn } from '../../utils';
import { OpenframeLogoIcon } from '../icons-v2-generated/logos/openframe-logo-icon';
import { OpenframeTextIcon } from '../icons-v2-generated/logos/openframe-text-icon';
import { hasNavigationSidebarSlot, renderNavigationSidebarSlot } from './navigation-sidebar-slot';

export interface NavigationSidebarHeaderProps {
  minimized: boolean;
  /** `NavigationSidebarConfig.headerSlot`. */
  slot?: NavigationSidebarSlot;
}

function LogoMark() {
  return (
    <div className="flex-shrink-0">
      <OpenframeLogoIcon
        secondaryColor="var(--color-accent-primary)"
        className="h-6 w-6"
        color="var(--color-text-primary)"
      />
    </div>
  );
}

/** Fades with `minimized`, as the rest of the sidebar's labels do. */
function wordmarkClasses(minimized: boolean) {
  return cn(
    'min-w-0 flex-1 overflow-hidden transition-[opacity,margin-left] duration-300',
    minimized ? 'ml-0 opacity-0' : 'ml-[var(--spacing-system-xs)] opacity-100',
  );
}

export function NavigationSidebarHeader({ minimized, slot }: NavigationSidebarHeaderProps) {
  if (!hasNavigationSidebarSlot(slot)) {
    return (
      <div className="flex h-14 items-center justify-start border-b border-ods-border p-[var(--spacing-system-m)]">
        <LogoMark />

        <div className={wordmarkClasses(minimized)} aria-hidden={minimized}>
          <OpenframeTextIcon color="var(--color-text-primary)" className="h-[15px] w-[87px]" />
        </div>
      </div>
    );
  }

  // With host controls. The layout reads the rail's width (the `of-nav-sidebar`
  // container `navigation-sidebar.tsx` declares), not `minimized`, which before
  // hydration can only carry the server's answer: collapsed is the default
  // (container queries are min-width) — the logo row, then the controls stacked
  // under it — and from 140px the two share the 56px row, controls at the end.
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col items-center border-b border-ods-border pb-[var(--spacing-system-xsf)]',
        '@[140px]/of-nav-sidebar:h-14 @[140px]/of-nav-sidebar:flex-row @[140px]/of-nav-sidebar:pb-0 @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xsf)]',
      )}
    >
      <div className="flex h-14 w-full min-w-0 items-center p-[var(--spacing-system-m)] @[140px]/of-nav-sidebar:w-auto @[140px]/of-nav-sidebar:flex-1 @[140px]/of-nav-sidebar:pr-[var(--spacing-system-xs)]">
        <LogoMark />

        <div className={wordmarkClasses(minimized)} aria-hidden={minimized}>
          {/* The wordmark gives way rather than being cut when the controls
              leave it less than its width: the zero-wide first item keeps it
              off the first line, so it wraps onto a second one that the fixed
              height clips whole. */}
          <div className="flex h-[15px] flex-wrap overflow-hidden">
            <span className="h-[15px] w-0" aria-hidden="true" />
            <OpenframeTextIcon color="var(--color-text-primary)" className="h-[15px] w-[87px] shrink-0" />
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-center gap-[var(--spacing-system-xxs)] @[140px]/of-nav-sidebar:flex-row @[140px]/of-nav-sidebar:gap-0">
        {renderNavigationSidebarSlot(slot, minimized)}
      </div>
    </div>
  );
}
