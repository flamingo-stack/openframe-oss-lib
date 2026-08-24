"use client"

import React from 'react';
import { cn } from '../../utils/cn';
import { FlamingoLogo } from '../flamingo-logo';
import { OpenmspLogo } from '../openmsp-logo';
import { OpenFrameLogo } from '../icons/openframe-logo';
import { MiamiCyberGangLogoFaceOnly } from '../icons/miami-cyber-gang-logo-face-only';
import { Globe } from 'lucide-react';

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
    text: 'text-h6'
  },
  sm: {
    container: 'gap-1.5 px-2 py-1',
    icon: 'h-4 w-4',
    text: 'text-h6'
  },
  md: {
    container: 'gap-2 px-2.5 py-1.5',
    icon: 'h-5 w-5',
    text: 'text-h6'
  }
};

const platformColors = {
  'openmsp': {
    bg: 'bg-ods-warning/10',
    border: 'border-ods-warning/30',
    text: 'text-ods-warning'
  },
  'flamingo': {
    bg: 'bg-ods-accent/10',
    border: 'border-ods-accent/30',
    text: 'text-ods-accent'
  },
  'flamingo-teaser': {
    bg: 'bg-ods-accent/10',
    border: 'border-ods-accent/30',
    text: 'text-ods-accent'
  },
  'openframe': {
    bg: 'bg-ods-info/10',
    border: 'border-ods-info/30',
    text: 'text-ods-info'
  },
  'tmcg': {
    bg: 'bg-ods-secondary/10',
    border: 'border-ods-secondary/30',
    text: 'text-ods-secondary'
  },
  'company-hub': {
    bg: 'bg-ods-danger/10',
    border: 'border-ods-danger/30',
    text: 'text-ods-danger'
  },
  'marketing-hub': {
    bg: 'bg-ods-secondary/10',
    border: 'border-ods-secondary/30',
    text: 'text-ods-secondary'
  },
  'product-hub': {
    bg: 'bg-ods-success/10',
    border: 'border-ods-success/30',
    text: 'text-ods-success'
  },
  'revenue-hub': {
    bg: 'bg-ods-warning/10',
    border: 'border-ods-warning/30',
    text: 'text-ods-warning'
  },
  'people-hub': {
    bg: 'bg-ods-info/10',
    border: 'border-ods-info/30',
    text: 'text-ods-info'
  },
  'universal': {
    bg: 'bg-ods-muted/10',
    border: 'border-ods-muted/30',
    text: 'text-ods-muted'
  }
};

const PlatformIcon = ({ platform, className }: { platform: string; className: string }) => {
  // Extract size from className (h-4 w-4 -> 16, h-5 w-5 -> 20, etc.)
  const sizeMatch = className.match(/h-(\d+)/);
  const size = sizeMatch ? parseInt(sizeMatch[1]) * 4 : 16; // Convert Tailwind size to pixels

  switch (platform) {
    case 'openmsp':
      return <OpenmspLogo className={className} frontBubbleColor="currentColor" innerFrontBubbleColor="#000000" backBubbleColor="currentColor" />;
    case 'flamingo':
    case 'flamingo-teaser':
      return <FlamingoLogo className={className} />;
    case 'openframe':
      return <OpenFrameLogo className={className} />;
    case 'tmcg':
      return <MiamiCyberGangLogoFaceOnly size={size} className={className} />;
    case 'company-hub':
    case 'marketing-hub':
    case 'product-hub':
    case 'revenue-hub':
    case 'people-hub':
      return <FlamingoLogo className={className} fill="currentColor" />;
    default:
      return <Globe className={className} />;
  }
};

export function PlatformBadge({ 
  platform, 
  size = 'sm',
  showLabel = true,
  className 
}: PlatformBadgeProps) {
  if (!platform) {
    return null;
  }

  const sizes = sizeClasses[size];
  const colors = platformColors[platform.name as keyof typeof platformColors] || platformColors.universal;

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border',
        sizes.container,
        colors.bg,
        colors.border,
        colors.text,
        'font-body font-medium',
        className
      )}
    >
      <PlatformIcon platform={platform.name} className={sizes.icon} />
      {showLabel && (
        <span className={sizes.text}>
          {platform.display_name || platform.name}
        </span>
      )}
    </div>
  );
}
