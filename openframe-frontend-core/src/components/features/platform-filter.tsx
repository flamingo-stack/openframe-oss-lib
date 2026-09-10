'use client';

import type { PlatformConfig } from '../../types/platform';
import { getSmallPlatformIcon } from '../../utils/platform-config';
import { Button } from '../ui/button';

// Platform icons are now unified in platform-config utils

export interface PlatformFilterComponentProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  platforms: PlatformConfig[];
  className?: string;
  showIcons?: boolean;
  size?: 'small-legacy' | 'default';
}

export function PlatformFilterComponent({
  selectedPlatform,
  onPlatformChange,
  platforms = [],
  className = '',
  showIcons = true,
  size = 'small-legacy',
}: PlatformFilterComponentProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <Button
        type="button"
        variant={selectedPlatform === 'all' ? 'accent' : 'outline'}
        size={size}
        onClick={() => onPlatformChange('all')}
        className="text-h3"
      >
        All Platforms
      </Button>
      {platforms.map(platform => (
        <Button
          key={platform.value}
          type="button"
          variant={selectedPlatform === platform.value ? 'accent' : 'outline'}
          size={size}
          onClick={() => onPlatformChange(platform.value)}
          leftIcon={showIcons ? getSmallPlatformIcon(platform.value) : undefined}
          className="text-h3"
        >
          {platform.label}
        </Button>
      ))}
    </div>
  );
}
