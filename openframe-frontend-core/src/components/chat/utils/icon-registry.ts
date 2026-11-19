/**
 * The brand variant DRAWN: `getIconComponent` (a component) and `getDynamicIcon` (a sized element) for social links,
 * channel platforms and source rows. What a name draws is decided in `icon-refs` (`iconRefFor(name, { variant:
 * 'brand' })`, the brand table and its PascalCase aliases); nothing here decides it.
 */

import { createElement, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { iconOf, lucideIcon, NamedIcon, type IconComponent, type IconRef } from './icon-loading';
import { iconRefFor, normalizeIconKey } from './icon-refs';

const GLOBE: IconRef = { lucide: 'globe' };

/** The glyph a name with no icon draws. */
const fallbackIcon = (name: string): IconComponent => lucideIcon(name) as IconComponent;

/** The brand variant of a name as a component; a name no set holds draws `file-text`, so a chip always has a glyph. */
export function getIconComponent(iconName: string | null | undefined): IconComponent {
  const ref = iconRefFor(iconName, { variant: 'brand' });
  return (ref ? iconOf(ref) : null) ?? fallbackIcon('file-text');
}

// ---------------------------------------------------------------------------
// Sized-icon rendering helper (migrated from `src/utils/dynamic-icons.tsx`)
// ---------------------------------------------------------------------------

export type DynamicIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<DynamicIconSize, string> = {
  xs: 'w-3 h-3', // 12px
  sm: 'w-4 h-4', // 16px
  md: 'w-6 h-6', // 24px
  lg: 'w-8 h-8', // 32px
  xl: 'w-12 h-12', // 48px
};

/**
 * Optional per-icon color overrides. Keys are kebab-case (canonical
 * registry form) — pass any incoming key through `normalizeIconKey()`
 * before lookup.
 */
const ICON_COLORS: Record<string, { color?: string; fill?: string }> = {
  linkedin: { color: 'var(--social-linkedin)' },
  facebook: { color: 'var(--social-facebook)' },
  youtube: { color: 'var(--social-youtube)' },
  instagram: { color: 'var(--social-instagram-pink)' },
};

/**
 * Render an icon by name with a size preset + optional className.
 * Replaces the old `src/utils/dynamic-icons.tsx#getDynamicIcon`. Accepts
 * both PascalCase and kebab-case keys (via `normalizeIconKey()`).
 */
export function getDynamicIcon(
  iconName: string | undefined | null,
  size: DynamicIconSize = 'md',
  className?: string,
): ReactNode {
  if (!iconName) {
    console.warn('[getDynamicIcon] No iconName provided, using Globe fallback');
    return createElement(NamedIcon, { icon: GLOBE, className: SIZE_CLASSES[size] });
  }

  const sizeClass = SIZE_CLASSES[size];
  // The caller's class wins over the preset's, so a size the presets do not have is one class away.
  const finalClassName = cn(sizeClass, className);

  const ref = iconRefFor(iconName, { variant: 'brand' });
  if (ref) {
    const colorConfig = ICON_COLORS[normalizeIconKey(iconName)] || {};
    return createElement(NamedIcon, { icon: ref, className: finalClassName, ...colorConfig });
  }

  console.error(`[getDynamicIcon] No icon is named "${iconName}"`);
  return createElement(NamedIcon, { icon: GLOBE, className: finalClassName });
}
