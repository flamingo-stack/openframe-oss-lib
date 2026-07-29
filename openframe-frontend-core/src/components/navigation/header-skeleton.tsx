import { HeaderConfig } from '../../types/navigation';
import { cn } from '../../utils';

export interface HeaderSkeletonProps {
  config?: HeaderConfig;
}

/**
 * Loading skeleton mirroring the unified ODS top-navigation geometry
 * (`TopNavigation`, Figma 2797-5978): 48px mobile / 56px md+, cell model.
 * Keep in sync with `header.tsx` — a diverging skeleton makes the
 * skeleton→live handoff jump.
 */
export function HeaderSkeleton({ config }: HeaderSkeletonProps) {
  const showNavigation = config?.navigation && config.navigation.items.length > 0;
  const showActions = config?.actions?.right && config.actions.right.length > 0;
  const showMobileMenu = config?.mobile?.enabled;
  const showLeftActions = !!config?.actions?.left;

  return (
    <div className="sticky top-0 z-[50] w-full">
      <header
        className={cn(
          'flex h-12 w-full items-center border-b border-t border-ods-border md:h-14 md:border-t-0',
          config?.backgroundColor || 'bg-ods-card',
          config?.className,
        )}
      >
        {/* Leading cells: admin toggle / burger */}
        {showLeftActions && (
          <div className="flex h-full w-12 items-center justify-center border-r border-ods-border md:w-14">
            <div className="h-6 w-6 animate-pulse rounded bg-ods-border" />
          </div>
        )}
        {showMobileMenu && (
          <div className="flex h-full w-12 items-center justify-center border-r border-ods-border md:w-14 lg:hidden">
            <div className="h-4 w-4 animate-pulse rounded bg-ods-border md:h-6 md:w-6" />
          </div>
        )}

        {/* Logo zone */}
        <div className="flex h-full flex-1 items-center gap-2 p-[var(--spacing-system-m)] md:pl-[var(--spacing-system-l)] lg:flex-none lg:pl-[var(--spacing-system-xxl)]">
          <div className="h-6 w-6 animate-pulse rounded bg-ods-border" />
          <div className="h-5 w-24 animate-pulse rounded bg-ods-border" />
        </div>

        {/* Center: navigation links (desktop only) */}
        <div className="hidden h-full min-w-0 flex-1 items-center justify-center gap-2 lg:flex">
          {showNavigation && (
            <>
              <div className="h-8 w-20 animate-pulse rounded bg-ods-border" />
              <div className="h-8 w-28 animate-pulse rounded bg-ods-border" />
              <div className="h-8 w-24 animate-pulse rounded bg-ods-border" />
            </>
          )}
        </div>

        {/* CTA zone */}
        {showActions && (
          <div className="hidden h-full items-center px-[var(--spacing-system-m)] lg:flex">
            <div className="h-8 w-24 animate-pulse rounded bg-ods-border" />
          </div>
        )}

        {/* Mingo cell */}
        {config?.mingo?.enabled && (
          <div className="flex h-full items-center border-l border-ods-border px-[var(--spacing-system-l)]">
            <div className="h-8 w-8 animate-pulse rounded bg-ods-border md:w-28" />
          </div>
        )}
      </header>
    </div>
  );
}
