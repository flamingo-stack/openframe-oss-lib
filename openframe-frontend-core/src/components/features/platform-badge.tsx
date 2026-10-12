'use client';

import { cn } from '../../utils/cn';
import { getPlatformBrandClasses } from '../../utils/platform-identity';
import { PlatformMark } from '../chat/utils/icon-loading';

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

export function PlatformBadge({ platform, size = 'sm', showLabel = true, className }: PlatformBadgeProps) {
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
        'inline-flex items-center rounded-full border',
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
