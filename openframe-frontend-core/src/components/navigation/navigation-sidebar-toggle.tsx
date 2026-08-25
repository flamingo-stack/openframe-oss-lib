'use client';

import { cn } from '../../utils';
import { Chevrons03LeftIcon } from '../icons-v2-generated';

export interface NavigationSidebarToggleProps {
  minimized: boolean;
  showLabel: boolean;
  onToggle: () => void;
}

export function NavigationSidebarToggle({ minimized, showLabel, onToggle }: NavigationSidebarToggleProps) {
  return (
    <div className="border-t border-ods-border">
      <button
        onClick={onToggle}
        className={cn(
          'relative flex w-full items-center justify-start',
          'h-14 p-[var(--spacing-system-m)]',
          'transition-colors duration-300',
          '[&_svg]:transition-colors [&_svg]:duration-300',
          'text-ods-text-primary hover:bg-ods-bg-hover',
        )}
        title={minimized ? 'Hide Menu' : undefined}
        aria-label={'Hide Menu'}
      >
        <div className="flex flex-shrink-0 items-center justify-center">
          {/* Direction follows the rail's measured width (the `of-nav-sidebar`
              container declared in `navigation-sidebar.tsx`), not `minimized`:
              before hydration that prop can only carry the server's answer, and
              a chevron pointing the wrong way in a 56px rail is the one piece of
              sidebar state a user actually notices arriving late.

              Collapsed is the default because container queries are min-width —
              the rail is narrower than every threshold, so it needs no query of
              its own. */}
          <Chevrons03LeftIcon className="h-6 w-6 rotate-180 text-ods-text-secondary transition-transform duration-300 @[140px]/of-nav-sidebar:rotate-0" />
        </div>

        <span
          className={cn(
            'flex-1 truncate text-left transition-[opacity,margin-left] duration-300 text-h4',
            showLabel ? 'ml-[var(--spacing-system-xs)] opacity-100' : 'ml-0 opacity-0',
          )}
          aria-hidden={!showLabel}
        >
          Hide Menu
        </span>
      </button>
    </div>
  );
}
