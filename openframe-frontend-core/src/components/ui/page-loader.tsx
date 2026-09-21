'use client';

import { cn } from '../../utils/cn';
import { OpenFrameLogo } from '../icons/openframe-logo';

export interface PageLoaderProps {
  /**
   * Main loading text
   */
  title?: string;
  /**
   * Secondary description text
   */
  description?: string;
  /**
   * Additional CSS classes for the container
   */
  className?: string;
  /**
   * Show the loader icon
   */
  showIcon?: boolean;
}

/**
 * Full page loader component
 * Used for loading states that take up the full viewport
 */
export function PageLoader({
  title = 'Loading',
  description = 'Getting your data ready',
  className,
  showIcon = true,
}: PageLoaderProps) {
  return (
    <div className={cn('flex min-h-screen w-full flex-col items-center justify-center bg-ods-bg', className)}>
      <div className="flex flex-col items-center gap-6 p-6">
        {showIcon && (
          <div className="relative h-6 w-6">
            <OpenFrameLogo
              className="h-6 w-6 animate-pulse text-ods-accent"
              upperPathColor="currentColor"
              lowerPathColor="var(--color-text-tertiary)"
            />
          </div>
        )}
        <div className="flex flex-col items-center text-center">
          <p className="text-ods-text-tertiary text-h4">{title}</p>
          <p className="mt-1 text-ods-text-tertiary opacity-70 text-h6">{description}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version of the page loader for smaller containers
 */
export function CompactPageLoader({ title = 'Loading', description, className, showIcon = true }: PageLoaderProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center p-12', className)}>
      <div className="flex flex-col items-center gap-4">
        {showIcon && (
          <div className="relative h-6 w-6">
            <OpenFrameLogo
              className="h-6 w-6 animate-pulse text-ods-accent"
              upperPathColor="currentColor"
              lowerPathColor="var(--color-text-tertiary)"
            />
          </div>
        )}
        <div className="flex flex-col items-center text-center">
          <p className="text-ods-text-tertiary text-h6">{title}</p>
          {description && <p className="mt-1 text-ods-text-tertiary opacity-70 text-h6">{description}</p>}
        </div>
      </div>
    </div>
  );
}
