'use client';

/**
 * OSTypeBadgeGroup Component
 *
 * Displays multiple OS type badges in a horizontal group.
 * Used for showing supported platforms in scripts and other multi-OS contexts.
 */

import { cn } from '../../utils/cn';
import { MediaSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';
import { OSTypeBadge } from './os-type-badge';

export interface OSTypeBadgeGroupProps {
  /** Array of OS type strings (case-insensitive, handles aliases) */
  osTypes: string[];
  /** Additional CSS classes */
  className?: string;
  /** Icon size class (default: w-4 h-4) */
  iconSize?: string;
  /** Maximum number of badges to display before showing "+N more" */
  maxDisplay?: number;
  /** Draws its loading state (also inside a `LoadingScope`): one icon's box at `iconSize`. */
  loading?: boolean;
}

/**
 * OSTypeBadgeGroup - Displays multiple OS type icons in a group (icons only, no labels)
 *
 * @example
 * ```tsx
 * <OSTypeBadgeGroup osTypes={['windows', 'darwin', 'linux']} />
 * <OSTypeBadgeGroup osTypes={['macos', 'linux']} maxDisplay={2} />
 * ```
 */
export function OSTypeBadgeGroup({
  osTypes,
  className = '',
  iconSize = 'w-5 h-5',
  maxDisplay,
  loading,
}: OSTypeBadgeGroupProps) {
  if (useLoadingScope() || loading) {
    // The platforms are read data: one icon's box stands for them (most scripts name one platform).
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <MediaSkeleton.Icon className={iconSize} />
      </div>
    );
  }
  if (!osTypes || osTypes.length === 0) {
    return null;
  }

  const displayOsTypes = maxDisplay && osTypes.length > maxDisplay ? osTypes.slice(0, maxDisplay) : osTypes;

  const remainingCount = maxDisplay && osTypes.length > maxDisplay ? osTypes.length - maxDisplay : 0;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {displayOsTypes.map((osType, index) => (
        <OSTypeBadge key={`${osType}-${index}`} osType={osType} iconOnly iconSize={iconSize} />
      ))}
      {remainingCount > 0 && <span className="text-ods-text-secondary text-h6">+{remainingCount} more</span>}
    </div>
  );
}
