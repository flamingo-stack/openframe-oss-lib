import React from 'react';
import { OpenmspLogo, FlamingoLogo, OpenFrameLogo, MiamiCyberGangLogoFaceOnly } from '../components/icons';
import { Globe } from 'lucide-react';
import type { SelectableOption } from '../components/features';
import type { PlatformConfig } from '../types/platform';

// Platform icons mapping with consistent colors matching app theme
export const platformIcons = {
  openframe: <OpenFrameLogo className="h-5 w-5" />,
  openmsp: <OpenmspLogo className="h-5 w-5" />,
  flamingo: <FlamingoLogo className="h-5 w-5" fill="#EC4899" />,
  'flamingo-teaser': <FlamingoLogo className="h-5 w-5" fill="#EC4899" />,
  'admin-hub': <FlamingoLogo className="h-5 w-5" fill="#FFC008" />,
  tmcg: <MiamiCyberGangLogoFaceOnly  className="h-5 w-5" />,
  universal: <Globe className="h-5 w-5 text-[#10B981]" />
};

// Platform colors mapping
export const platformColors = {
  openmsp: 'bg-[#3B82F6]',
  openframe: 'bg-[#8B5CF6]',
  flamingo: 'bg-[#EC4899]',
  'flamingo-teaser': 'bg-[#F59E0B]',
  'admin-hub': 'bg-[#FF6B9D]',
  tmcg: 'bg-[#FF6B6B]',
  universal: 'bg-[#10B981]'
};

// Platform display names for consistent naming across the app
export const platformDisplayNames = {
  openmsp: 'OpenMSP',
  openframe: 'OpenFrame',
  flamingo: 'Flamingo',
  'flamingo-teaser': 'Flamingo Teaser',
  'admin-hub': 'Admin Hub',
  tmcg: 'TMCG',
  universal: 'Universal'
};

// Platform descriptions for consistent messaging across the app
export const platformDescriptions = {
  openmsp: 'Comprehensive directory and comparison platform for managed service providers (MSPs) and technology vendors. Reduce vendor costs and discover open-source alternatives.',
  openframe: 'AI-driven open-source security operations center (SOC) and endpoint detection platform for MSPs.',
  flamingo: 'AI-driven open-source OS for MSPs. Swap bloated vendor tools for open ones. Automate the boring crap. Take your margin back.',
  'flamingo-teaser': 'Preview of Flamingo - the AI-driven open-source OS for MSPs.',
  'admin-hub': 'Administrative interface for managing Flamingo platform services and configurations.',
  tmcg: 'The Miami Cyber Gang - A cybersecurity community focused on education and collaboration.',
  universal: 'Cross-platform universal content.'
};

// Platform slogans for branding consistency
export const platformSlogans = {
  openmsp: 'Find Your Perfect MSP Partner',
  openframe: 'Open-Source Security Operations',
  flamingo: 'Open-Source OS for MSPs',
  'flamingo-teaser': 'Coming Soon: Open-Source OS for MSPs',
  'admin-hub': 'Manage Your Platform',
  tmcg: 'Miami Cyber Community',
  universal: 'Universal Platform'
};

// Platform hex colors for default configuration
export const platformHexColors = {
  openmsp: '#FFC008',
  openframe: '#FFC008',
  flamingo: '#FF6B9D',
  universal: '#FFC008',
  'admin-hub': '#FFC008',
  'flamingo-teaser': '#F59E0B',
  tmcg: '#FF6B6B'
};

// Platform icon names for default configuration
export const platformIconNames = {
  openmsp: 'openmsp-logo',
  openframe: 'openframe-logo',
  flamingo: 'flamingo-logo',
  universal: 'globe',
  'admin-hub': 'flamingo-logo',
  'flamingo-teaser': 'flamingo-logo',
  tmcg: 'tmcg-logo'
};

/**
 * Get default color for platform
 */
export function getDefaultColorForPlatform(platformName: string): string {
  return platformHexColors[platformName as keyof typeof platformHexColors] || platformHexColors.universal;
}

/**
 * Get default icon name for platform
 */
export function getDefaultIconForPlatform(platformName: string): string {
  return platformIconNames[platformName as keyof typeof platformIconNames] || platformIconNames.universal;
}

/**
 * Convert platform configurations to selectable options for UI components
 */
export function transformPlatformConfigsToOptions(platformConfigs: PlatformConfig[]): SelectableOption[] {
  return platformConfigs.map((platform: PlatformConfig) => ({
    id: platform.name,
    name: platform.display_name,
    description: platform.description,
    icon: platformIcons[platform.name as keyof typeof platformIcons] || platformIcons.universal,
    color: platformColors[platform.name as keyof typeof platformColors] || platformColors.universal
  }));
}

/**
 * Get platform icon by name
 */
export function getPlatformIcon(platformName: string) {
  return platformIcons[platformName as keyof typeof platformIcons] || platformIcons.universal;
}

/**
 * Get platform color by name
 */
export function getPlatformColor(platformName: string) {
  return platformColors[platformName as keyof typeof platformColors] || platformColors.universal;
}

/**
 * Get platform display name by name
 */
export function getPlatformDisplayName(platformName: string): string {
  return platformDisplayNames[platformName as keyof typeof platformDisplayNames] || platformName;
}

/**
 * Get platform description by name
 */
export function getPlatformDescription(platformName: string): string {
  return platformDescriptions[platformName as keyof typeof platformDescriptions] || platformName;
}

/**
 * Get platform slogan by name
 */
export function getPlatformSlogan(platformName: string): string {
  return platformSlogans[platformName as keyof typeof platformSlogans] || platformName;
}

/**
 * Get small platform icon for filter buttons with white colors (4x4 size)
 */
export function getSmallPlatformIcon(platformName: string): React.ReactNode {
  const className = "h-4 w-4 flex-shrink-0";

  switch (platformName) {
    case 'openframe':
      return <OpenFrameLogo className={className} lowerPathColor="#FFC008" upperPathColor="#ffffff" />;
    case 'openmsp':
      return <OpenmspLogo className={className} frontBubbleColor="#f1f1f1" innerFrontBubbleColor="#000000" backBubbleColor="#FFC008" />;
    case 'flamingo':
    case 'flamingo-teaser':
    case 'admin-hub':
      return <FlamingoLogo className={`${className} text-white`} />;
    case 'tmcg':
      return <MiamiCyberGangLogoFaceOnly className={className} />;
    case 'universal':
    default:
      return <Globe className={className} />;
  }
}

/**
 * Get platform icon for admin/selector components (standard 6x6 size)
 */
export function getPlatformIconComponent(platformName: string, className: string = "h-6 w-6"): React.ReactNode {
  switch (platformName) {
    case 'openframe':
      return <OpenFrameLogo className={className} />;
    case 'openmsp':
      return <OpenmspLogo className={className} color="#f1f1f1" />;
    case 'flamingo':
    case 'flamingo-teaser':
    case 'admin-hub':
      return <FlamingoLogo className={`${className} text-white`} />;
    case 'tmcg':
      return <MiamiCyberGangLogoFaceOnly size={24} className={className} />;
    case 'universal':
    default:
      return <Globe className={className} />;
  }
}