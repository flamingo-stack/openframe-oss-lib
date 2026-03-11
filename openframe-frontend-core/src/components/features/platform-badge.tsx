'use client';

import { Globe } from 'lucide-react';
import React from 'react';
import { cn } from '../../utils/cn';
import { FlamingoLogo } from '../flamingo-logo';
import { MiamiCyberGangLogoFaceOnly } from '../icons/miami-cyber-gang-logo-face-only';
import { OpenFrameLogo } from '../icons/openframe-logo';
import { OpenmspLogo } from '../openmsp-logo';

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
    text: 'text-[10px]',
  },
  sm: {
    container: 'gap-1.5 px-2 py-1',
    icon: 'h-4 w-4',
    text: 'text-[11px]',
  },
  md: {
    container: 'gap-2 px-2.5 py-1.5',
    icon: 'h-5 w-5',
    text: 'text-[12px]',
  },
};

const platformColors = {
  openmsp: {
    bg: 'bg-[var(--ods-open-yellow-base)]/10',
    border: 'border-[var(--ods-open-yellow-base)]/30',
    text: 'text-[var(--ods-open-yellow-base)]',
  },
  flamingo: {
    bg: 'bg-[var(--ods-flamingo-pink-base)]/10',
    border: 'border-[var(--ods-flamingo-pink-base)]/30',
    text: 'text-[var(--ods-flamingo-pink-base)]',
  },
  'flamingo-teaser': {
    bg: 'bg-[var(--ods-flamingo-pink-base)]/10',
    border: 'border-[var(--ods-flamingo-pink-base)]/30',
    text: 'text-[var(--ods-flamingo-pink-base)]',
  },
  openframe: {
    bg: 'bg-[var(--ods-flamingo-cyan-base)]/10',
    border: 'border-[var(--ods-flamingo-cyan-base)]/30',
    text: 'text-[var(--ods-flamingo-cyan-base)]',
  },
  'admin-hub': {
    bg: 'bg-[var(--color-link-visited)]/10',
    border: 'border-[var(--color-link-visited)]/30',
    text: 'text-[var(--color-link-visited)]',
  },
  tmcg: {
    bg: 'bg-[var(--ods-flamingo-pink-base)]/10',
    border: 'border-[var(--ods-flamingo-pink-base)]/30',
    text: 'text-[var(--ods-flamingo-pink-base)]',
  },
  universal: {
    bg: 'bg-[var(--ods-system-greys-grey)]/10',
    border: 'border-[var(--ods-system-greys-grey)]/30',
    text: 'text-[var(--ods-system-greys-grey)]',
  },
};

const PlatformIcon = ({ platform, className }: { platform: string; className: string }) => {
  // Extract size from className (h-4 w-4 -> 16, h-5 w-5 -> 20, etc.)
  const sizeMatch = className.match(/h-(\d+)/);
  const size = sizeMatch ? parseInt(sizeMatch[1]) * 4 : 16; // Convert Tailwind size to pixels

  switch (platform) {
    case 'openmsp':
      return (
        <OpenmspLogo
          className={className}
          frontBubbleColor="currentColor"
          innerFrontBubbleColor="#000000"
          backBubbleColor="currentColor"
        />
      );
    case 'flamingo':
    case 'flamingo-teaser':
      return <FlamingoLogo className={className} />;
    case 'admin-hub':
      return <FlamingoLogo className={className} />;
    case 'openframe':
      return <OpenFrameLogo className={className} />;
    case 'tmcg':
      return <MiamiCyberGangLogoFaceOnly size={size} className={className} />;
    default:
      return <Globe className={className} />;
  }
};

export function PlatformBadge({ platform, size = 'sm', showLabel = true, className }: PlatformBadgeProps) {
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
        'font-["DM_Sans"] font-medium',
        className,
      )}
    >
      <PlatformIcon platform={platform.name} className={sizes.icon} />
      {showLabel && <span className={sizes.text}>{platform.display_name || platform.name}</span>}
    </div>
  );
}
