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
  size?: 'small-legacy' | 'default';
}

export function PlatformFilterComponent({
  selectedPlatform,
  onPlatformChange,
  platforms = [],
  className = '',
  showIcons = true,
  size = 'small-legacy'
}: PlatformFilterComponentProps) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <Button
        type="button"
        variant={selectedPlatform === 'all' ? "accent" : "outline"}
        size={size}
        onClick={() => onPlatformChange('all')}
        className="text-h3"
      >
        All Platforms
      </Button>
      {platforms.map((platform) => (
        <Button
          key={platform.value}
          type="button"
          variant={selectedPlatform === platform.value ? "accent" : "outline"}
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