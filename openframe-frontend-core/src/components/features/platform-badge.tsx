'use client';

import { cn } from '../../utils/cn';
import { getPlatformBrandClasses } from '../../utils/platform-identity';
import { PlatformMark } from '../chat/utils/icon-loading';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from '../ui/loading-scope';

interface PlatformBadgeProps {
  platform?: {
    id: string;
    name: string;
    display_name: string;
  } | null;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  xs: {
    container: 'gap-1 px-1.5 py-0.5',
    icon: 'h-3 w-3',
    text: 'text-h6',
  },
  sm: {
    container: 'gap-1.5 px-2 py-1',
    icon: 'h-4 w-4',
    text: 'text-h6',
  },
  md: {
    container: 'gap-2 px-2.5 py-1.5',
    icon: 'h-5 w-5',
    text: 'text-h6',
  },
};

/** The chip's frame, read by the badge and by its skeleton, so the skeleton is the badge's size. */
const PLATFORM_BADGE_FRAME_CLASS = 'inline-flex items-center rounded-full border';

export function PlatformBadge({ platform, size = 'sm', showLabel = true, className }: PlatformBadgeProps) {
  // ONE switch: while the record is read its platform is not known and the badge is its skeleton; a platform it is
  // given in a loading scope is the page's own and is drawn as it is.
  if (useLoadingScope() && !platform) {
    return <PlatformBadgeSkeleton size={size} showLabel={showLabel} className={className} />;
  }
  if (!platform) {
    return null;
  }

  const sizes = sizeClasses[size];
  // Soft-tinted chip: background + border at 10%/30% of the platform's accent,
  // text at full strength. Derived from the brand record (was a hex map).
  const colors = getPlatformBrandClasses(platform.name);

  return (
    <div
      className={cn(
        PLATFORM_BADGE_FRAME_CLASS,
        sizes.container,
        colors.accentBgSoft,
        colors.accentBorderSoft,
        colors.accentText,
        'font-body font-medium',
        className,
      )}
    >
      <PlatformMark platform={platform.name} className={sizes.icon} />
      {showLabel && <span className={sizes.text}>{platform.display_name || platform.name}</span>}
    </div>
  );
}

/**
 * The badge's box per size, for its skeleton: border + vertical padding + the taller of the mark and the label's
 * line (the label is `text-h6`, so `lh` is its line height at every width).
 */
const PLATFORM_BADGE_SKELETON_SIZE = {
  xs: { height: 'h-[calc(max(1lh,0.75rem)+0.25rem+2px)]', width: 'w-20', iconOnly: 'w-[calc(0.75rem+0.75rem+2px)]' },
  sm: { height: 'h-[calc(max(1lh,1rem)+0.5rem+2px)]', width: 'w-24', iconOnly: 'w-[calc(1rem+1rem+2px)]' },
  md: { height: 'h-[calc(max(1lh,1.25rem)+0.75rem+2px)]', width: 'w-28', iconOnly: 'w-[calc(1.25rem+1.25rem+2px)]' },
} as const;

/** A platform badge while its record is read: one shape of the badge's height at its size. */
export function PlatformBadgeSkeleton({
  size = 'sm',
  showLabel = true,
  className,
}: Pick<PlatformBadgeProps, 'size' | 'showLabel' | 'className'>) {
  const box = PLATFORM_BADGE_SKELETON_SIZE[size];
  return (
    <UnifiedSkeleton
      as="span"
      className={cn(
        'inline-block rounded-full align-middle text-h6',
        box.height,
        showLabel ? box.width : box.iconOnly,
        className,
      )}
    />
  );
}
