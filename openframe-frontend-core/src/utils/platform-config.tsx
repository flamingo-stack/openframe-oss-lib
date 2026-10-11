import { createElement } from 'react';
import type React from 'react';
import { NamedIcon, type IconRef } from '../components/chat/utils/icon-loading';
import type { SelectableOption } from '../components/features';
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
 * Two marks take no accent colour prop and are named exceptions:
 *   - `universal` is lucide's globe, an outline: it takes the class only.
 *   - `tmcg` is a two-colour mark with colours of its own.
 */
const FLAMINGO_MARK: IconRef = { set: 'FlamingoMarkIcon', color: 'currentColor' };

/**
 * Each platform's mark, by the platform's name. Data: a mark is loaded when it
 * is drawn. `tinted` marks take the platform's accent class and paint their
 * accent part with `currentColor`.
 */
const PLATFORM_MARKS: Readonly<Record<string, { mark: IconRef; tinted: boolean }>> = {
  // The squares are the accent; the frame is the neutral greys white.
  openframe: {
    mark: { set: 'OpenframeLogoIcon', color: 'var(--ods-system-greys-white)', secondaryColor: 'currentColor' },
    tinted: true,
  },
  // The accent is the BACK bubble. The other two are the neutral greys.
  openmsp: {
    mark: {
      set: 'OpenmspLogoIcon',
      color: 'var(--ods-system-greys-white)',
      secondaryColor: 'var(--ods-system-greys-black)',
      tertiaryColor: 'currentColor',
    },
    tinted: true,
  },
  tmcg: { mark: { set: 'MiamiCyberGangLogoFaceOnlyIcon' }, tinted: false },
  mlg: { mark: { set: 'MlgLogoIcon', size: 20 }, tinted: true },
  universal: { mark: { lucide: 'globe' }, tinted: true },
};

/** Every other platform is drawn with the Flamingo mark in its own accent. */
const DEFAULT_MARK = { mark: FLAMINGO_MARK, tinted: true };

function renderPlatformIcon(platformName: string, className: string): React.ReactNode {
  const { mark, tinted } = Object.prototype.hasOwnProperty.call(PLATFORM_MARKS, platformName)
    ? PLATFORM_MARKS[platformName]
    : DEFAULT_MARK;
  return createElement(NamedIcon, {
    icon: mark,
    className: tinted ? cn(className, getPlatformBrandClasses(platformName).accentText) : className,
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
