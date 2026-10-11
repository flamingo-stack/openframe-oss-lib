import { createElement } from 'react';
import type React from 'react';
import { PlatformMark } from '../components/chat/utils/icon-loading';
import type { SelectableOption } from '../components/features';
import type { PlatformConfig, PlatformName } from '../types/platform';
import { cn } from './cn';
import { getPlatformBrandClasses } from './platform-identity';

/**
 * Per-platform ICON rendering. Which mark a platform has is a convention, stated
 * once beside the icon loader (`PlatformMark`); this module only picks a size and
 * adds the platform's accent class, which a single-colour mark is painted with.
 */
function renderPlatformIcon(platformName: string, className: string): React.ReactNode {
  return createElement(PlatformMark, {
    platform: platformName,
    className: cn(className, getPlatformBrandClasses(platformName).accentText),
  });
}

/** Platform icons mapping (5x5), tinted by each platform's accent class. */
export const platformIcons: Record<PlatformName, React.ReactNode> = {
  openframe: renderPlatformIcon('openframe', 'h-5 w-5'),
  openmsp: renderPlatformIcon('openmsp', 'h-5 w-5'),
  flamingo: renderPlatformIcon('flamingo', 'h-5 w-5'),
  'marketing-hub': renderPlatformIcon('marketing-hub', 'h-5 w-5'),
  'product-hub': renderPlatformIcon('product-hub', 'h-5 w-5'),
  'revenue-hub': renderPlatformIcon('revenue-hub', 'h-5 w-5'),
  'people-hub': renderPlatformIcon('people-hub', 'h-5 w-5'),
  'company-hub': renderPlatformIcon('company-hub', 'h-5 w-5'),
  tmcg: renderPlatformIcon('tmcg', 'h-5 w-5'),
  mlg: renderPlatformIcon('mlg', 'h-5 w-5'),
  universal: renderPlatformIcon('universal', 'h-5 w-5'),
};

// Identity + brand strings/colours live in ONE place; re-exported here so every
// existing importer of `platform-config` keeps working unchanged.
export {
  platformDisplayNames,
  platformShortNames,
  platformDescriptions,
  platformSlogans,
  platformHexColors,
  platformColors,
  getPlatformDisplayName,
  getPlatformShortName,
  getPlatformDescription,
  getPlatformSlogan,
  getPlatformColor,
  getDefaultColorForPlatform,
} from './platform-identity';

export function transformPlatformConfigsToOptions(platformConfigs: PlatformConfig[]): SelectableOption[] {
  return platformConfigs.map((platform: PlatformConfig) => ({
    id: platform.id, // Database UUID for matching
    name: platform.name, // Platform name enum
    displayName: platform.display_name, // Human-readable name
    description: platform.description,
    icon: getPlatformIcon(platform.name),
    color: getPlatformColorClass(platform.name),
  }));
}

/** Get platform icon by name (5x5). */
export function getPlatformIcon(platformName: string): React.ReactNode {
  return platformIcons[platformName as PlatformName] ?? platformIcons.universal;
}

/** Get small platform icon for filter buttons (4x4). */
export function getSmallPlatformIcon(platformName: string): React.ReactNode {
  return renderPlatformIcon(platformName, 'h-4 w-4 flex-shrink-0');
}

/** Get platform icon for admin/selector components (standard 6x6 size). */
export function getPlatformIconComponent(platformName: string, className: string = 'h-6 w-6'): React.ReactNode {
  return renderPlatformIcon(platformName, className);
}

// `getPlatformColor` is re-exported from the identity leaf above; this local alias
// keeps `transformPlatformConfigsToOptions` readable without shadowing that export.
function getPlatformColorClass(platformName: string): string {
  return getPlatformBrandClasses(platformName).accentBg;
}
