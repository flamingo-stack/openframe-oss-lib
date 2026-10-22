'use client';

import { cn } from '../../utils/cn';
import { OpenframeLogoIcon } from '../icons-v2-generated/logos/openframe-logo-icon';
import { LIVE_PULSE_CLASS } from './skeleton-surface';

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

/** The pulsing mark both loaders show. */
function LoaderMark() {
  return (
    <div className="relative h-6 w-6">
      <OpenframeLogoIcon
        secondaryColor="var(--color-text-tertiary)"
        className={cn('h-6 w-6 text-ods-accent', LIVE_PULSE_CLASS)}
        color="currentColor"
      />
    </div>
  );
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
        {showIcon && <LoaderMark />}
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
        {showIcon && <LoaderMark />}
        <div className="flex flex-col items-center text-center">
          <p className="text-ods-text-tertiary text-h6">{title}</p>
          {description && <p className="mt-1 text-ods-text-tertiary opacity-70 text-h6">{description}</p>}
        </div>
      </div>
    </div>
  );
}
