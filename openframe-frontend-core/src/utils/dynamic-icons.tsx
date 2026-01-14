/**
 * Dynamic Icon Registry - UNIFIED
 *
 * Single source of truth for all dynamic icon rendering.
 * Icons are looked up by EXACT name from database (icon_name column).
 *
 * Registry-based approach: All icons explicitly imported and registered.
 * NO runtime namespace tricks - real imported components.
 */

import React from 'react';

// UI Kit social platform icons
import {
  LinkedInIcon,
  FacebookIcon,
  InstagramIcon,
  YouTubeIcon,
  SlackIcon,
  XLogo,
} from '../components/icons';

// Lucide icons (commonly used for social platforms)
import {
  Globe,
  FileText,
  PenSquare,
  Github,
  MessageCircle,
  Send,
  Video,
  Twitter,
} from 'lucide-react';

// Type for icon size presets
export type DynamicIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

// Size class mapping (Tailwind)
const SIZE_CLASSES: Record<DynamicIconSize, string> = {
  xs: 'w-3 h-3',    // 12px
  sm: 'w-4 h-4',    // 16px
  md: 'w-6 h-6',    // 24px
  lg: 'w-8 h-8',    // 32px
  xl: 'w-12 h-12',  // 48px
};

/**
 * Icon color configuration (optional overrides)
 */
const ICON_COLORS: Record<string, { color?: string; fill?: string }> = {
  LinkedInIcon: { color: '#0A66C2' },
  FacebookIcon: { color: '#1877F2' },
  YouTubeIcon: { color: '#FF0000' },
  OpenFrameLogo: { /* Uses component defaults */ },
};

/**
 * Icon Component Registry
 * Maps exact icon_name (from database) to imported React components
 */
const ICON_REGISTRY: Record<string, React.ComponentType<{ className?: string; color?: string }>> = {
  // UI Kit social platform icons (from @flamingo/ui-kit/components/icons)
  LinkedInIcon,
  FacebookIcon,
  InstagramIcon,
  YouTubeIcon,
  SlackIcon,
  XLogo,

  // Lucide icons (from lucide-react)
  Globe,
  FileText,    // Blog Posts icon (internal-blogging)
  PenSquare,   // Alternative blog icon
  Github,      // GitHub platform
  MessageCircle, // Discord platform
  Send,        // Telegram platform
  Video,       // TikTok platform
  Twitter,     // Twitter/X platform
};

/**
 * Get icon component dynamically by name
 *
 * @param iconName - Exact component name from database (e.g., 'LinkedInIcon', 'FileText')
 * @param size - Size preset (xs, sm, md, lg, xl)
 * @param className - Optional additional Tailwind classes
 * @returns React icon component or Globe fallback
 */
export function getDynamicIcon(
  iconName: string | undefined | null,
  size: DynamicIconSize = 'md',
  className?: string
): React.ReactNode {

  if (!iconName) {
    console.warn('[getDynamicIcon] No iconName provided, using Globe fallback');
    return <Globe className={SIZE_CLASSES[size]} />;
  }

  const sizeClass = SIZE_CLASSES[size];
  const finalClassName = className ? `${sizeClass} ${className}` : sizeClass;

  // Lookup icon from registry
  const IconComponent = ICON_REGISTRY[iconName];

  if (IconComponent) {
    const colorConfig = ICON_COLORS[iconName] || {};
    return <IconComponent className={finalClassName} {...colorConfig} />;
  }

  // Fallback
  console.error(`[getDynamicIcon] Icon NOT found in registry: "${iconName}". Available icons:`, Object.keys(ICON_REGISTRY));
  return <Globe className={finalClassName} />;
}

/**
 * Get platform brand logo - delegates to existing ui-kit function
 * Re-exported here for unified icon API
 */
export { getPlatformIconComponent as getPlatformLogo } from './platform-config';
