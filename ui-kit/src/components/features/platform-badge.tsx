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
    text: 'text-[10px]'
  },
  sm: {
    container: 'gap-1.5 px-2 py-1',
    icon: 'h-4 w-4',
    text: 'text-[11px]'
  },
  md: {
    container: 'gap-2 px-2.5 py-1.5',
    icon: 'h-5 w-5',
    text: 'text-[12px]'
  }
};

const platformColors = {
  'openmsp': {
    bg: 'bg-[#FFC008]/10',
    border: 'border-[#FFC008]/30',
    text: 'text-[#FFC008]'
  },
  'flamingo': {
    bg: 'bg-[#FF006E]/10',
    border: 'border-[#FF006E]/30',
    text: 'text-[#FF006E]'
  },
  'flamingo-teaser': {
    bg: 'bg-[#FF006E]/10',
    border: 'border-[#FF006E]/30',
    text: 'text-[#FF006E]'
  },
  'openframe': {
    bg: 'bg-[#00D9D9]/10',
    border: 'border-[#00D9D9]/30',
    text: 'text-[#00D9D9]'
  },
  'admin-hub': {
    bg: 'bg-[#8B5CF6]/10',
    border: 'border-[#8B5CF6]/30',
    text: 'text-[#8B5CF6]'
  },
  'tmcg': {
    bg: 'bg-[#F357BB]/10',
    border: 'border-[#F357BB]/30',
    text: 'text-[#F357BB]'
  },
  'universal': {
    bg: 'bg-[#6B7280]/10',
    border: 'border-[#6B7280]/30',
    text: 'text-[#6B7280]'
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
        'font-["DM_Sans"] font-medium',
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