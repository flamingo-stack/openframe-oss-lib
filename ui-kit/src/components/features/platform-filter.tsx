"use client";

import React from 'react';
import { Button } from '../ui/button';
import { getSmallPlatformIcon } from '../../utils/platform-config';
import type { PlatformConfig } from '../../types/platform';

// Platform icons are now unified in platform-config utils

export interface PlatformFilterComponentProps {
  selectedPlatform: string;
  onPlatformChange: (platform: string) => void;
  platforms: PlatformConfig[];
  className?: string;
  showIcons?: boolean;
  size?: 'sm' | 'default' | 'lg';
}

export function PlatformFilterComponent({
  selectedPlatform,
  onPlatformChange,
  platforms = [],
  className = '',
  showIcons = true,
  size = 'sm'
}: PlatformFilterComponentProps) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Button
        type="button"
        variant={selectedPlatform === 'all' ? "primary" : "outline"}
        size={size}
        onClick={() => onPlatformChange('all')}
        className="font-['DM_Sans'] text-[16px] md:text-[18px] font-bold"
      >
        All Platforms
      </Button>
      {platforms.map((platform) => (
        <Button
          key={platform.value}
          type="button"
          variant={selectedPlatform === platform.value ? "primary" : "outline"}
          size={size}
          onClick={() => onPlatformChange(platform.value)}
          leftIcon={showIcons ? getSmallPlatformIcon(platform.value) : undefined}
          className="font-['DM_Sans'] text-[16px] md:text-[18px] font-bold"
        >
          {platform.label}
        </Button>
      ))}
    </div>
  );
}