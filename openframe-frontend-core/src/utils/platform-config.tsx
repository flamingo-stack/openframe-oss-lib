import { Globe } from 'lucide-react';
import type React from 'react';
import type { SelectableOption } from '../components/features';
import { OpenmspLogo, FlamingoLogo, OpenFrameLogo, MiamiCyberGangLogoFaceOnly, MlgLogo } from '../components/icons';
import type { PlatformConfig, PlatformName } from '../types/platform';
import { cn } from './cn';
import { getPlatformBrandClasses } from './platform-identity';

/**
 * Per-platform ICON rendering. The colour decision lives in `platform-identity`
 * (`PLATFORM_BRAND` → `ODS_STEM_CLASSES`), never here: each mark is tinted by the
 * platform's accent CLASS and paints itself with `currentColor`. There is ONE
 * lookup, parameterized by `className`; the three former hand-written switches
 * (`getPlatformIcon`, `getSmallPlatformIcon`, `getPlatformIconComponent`) are
 * thin wrappers that only pick a size.
 *
 * Two marks cannot take an accent fill and are named exceptions:
 *   - `universal` is a lucide `Globe`; lucide spreads `...rest` AFTER `fill: 'none'`,
 *     so a `fill` prop would paint a solid disc. It takes the class only.
 *   - `tmcg` is a two-colour mark (`MiamiCyberGangLogoFaceOnly`) with no fill prop.
 */
function renderPlatformIcon(platformName: string, className: string): React.ReactNode {
  const tinted = cn(className, getPlatformBrandClasses(platformName).accentText);
  switch (platformName) {
    case 'openframe':
      // `lowerPathColor` is the accent; the upper path is the neutral greys white.
      return (
        <OpenFrameLogo
          className={tinted}
          lowerPathColor="currentColor"
          upperPathColor="var(--ods-system-greys-white)"
        />
      );
    case 'openmsp':
      // `OpenmspLogo`'s paths set their own fills, so a root `fill` is a no-op:
      // the accent is the BACK bubble. The other two are the neutral greys.
      return (
        <OpenmspLogo
          className={tinted}
          backBubbleColor="currentColor"
          frontBubbleColor="var(--ods-system-greys-white)"
          innerFrontBubbleColor="var(--ods-system-greys-black)"
        />
      );
    case 'tmcg':
      return <MiamiCyberGangLogoFaceOnly className={className} />;
    case 'mlg':
      return <MlgLogo className={tinted} size={20} />;
    case 'universal':
      return <Globe className={tinted} />;
    default:
      return <FlamingoLogo className={tinted} fill="currentColor" />;
  }
}

/** Platform icons mapping (5x5), tinted by each platform's accent class. */
export const platformIcons: Record<PlatformName, React.ReactNode> = {
  openframe: renderPlatformIcon('openframe', 'h-5 w-5'),
  openmsp: renderPlatformIcon('openmsp', 'h-5 w-5'),
  flamingo: renderPlatformIcon('flamingo', 'h-5 w-5'),
  'flamingo-teaser': renderPlatformIcon('flamingo-teaser', 'h-5 w-5'),
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
  platformIconNames,
  platformHexColors,
  platformColors,
  getPlatformDisplayName,
  getPlatformShortName,
  getPlatformDescription,
  getPlatformSlogan,
  getPlatformColor,
  getDefaultColorForPlatform,
  getDefaultIconForPlatform,
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
