'use client';

import { Globe } from 'lucide-react';
import { cn } from '../../utils/cn';
import { getPlatformBrandClasses } from '../../utils/platform-identity';
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
          innerFrontBubbleColor="var(--ods-system-greys-black)"
          backBubbleColor="currentColor"
        />
      );
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
      <PlatformIcon platform={platform.name} className={sizes.icon} />
      {showLabel && <span className={sizes.text}>{platform.display_name || platform.name}</span>}
    </div>
  );
}
