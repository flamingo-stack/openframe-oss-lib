/**
 * Icon registry — string `icon_name` → React component.
 *
 * SINGLE SOURCE OF TRUTH (no, really this time) for every icon-name →
 * React-component lookup across the lib + the hub. Two DB columns feed
 * in with DIFFERENT conventions:
 *
 *   - `chat_admin_slash_commands.icon_name` — kebab-case (`'rocket'`,
 *     `'hubspot'`, `'github'`, `'dollar-sign'`).
 *   - `social_platforms.icon_name` — PascalCase component names
 *     (`'LinkedInIcon'`, `'XLogo'`, `'YouTubeIcon'`, `'Github'`).
 *
 * The registry stores entries under kebab-case keys (URL/DB-friendly,
 * shell-safe, matches `lucide-react`'s own file-naming convention).
 * The PascalCase variants come in via `normalizeIconKey()`, which maps
 * known PascalCase aliases → kebab-case before the lookup runs.
 *
 * Adding a new icon: add a `'name': { set | lucide }` entry in `ICON_REGISTRY`
 * (data: the icon is loaded when it is drawn), and (if the same icon also flows in from a DB
 * column that uses PascalCase) add a `PascalName → 'name'` row to
 * `PASCAL_TO_KEBAB_ALIASES`.
 *
 * Fallback: an unknown / null icon_name resolves to `FileText` so a chip
 * never renders without an icon.
 */

import { createElement, type ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { iconOf, lucideIcon, NamedIcon, type IconComponent, type IconRef } from './icon-loading';

const lucide = (name: string): IconRef => ({ lucide: name });
const fromSet = (exportName: string): IconRef => ({ set: exportName });

/**
 * The kebab-case registry, as DATA: each name states where its icon lives
 * (lucide, or the generated set) and nothing is loaded until it is drawn. ALL
 * lookups go through here; PascalCase aliases route through
 * `normalizeIconKey()` first.
 */
export const ICON_REGISTRY: Readonly<Record<string, IconRef>> = {
  activity: lucide('activity'),
  banknote: lucide('banknote'),
  bell: lucide('bell'),
  'book-open': lucide('book-open'),
  box: lucide('box'),
  briefcase: lucide('briefcase'),
  calendar: lucide('calendar'),
  'check-square': lucide('square-check-big'),
  'dollar-sign': lucide('dollar-sign'),
  // For brand-vs-lucide variants the kebab key is the BRAND (most-common
  // social-platform intent); `'<name>-lucide'` carries the lucide outline.
  facebook: fromSet('FacebookClassicIcon'),
  'facebook-lucide': lucide('facebook'),
  'file-text': lucide('file-text'),
  // `'github-lucide'` is the lucide outline glyph (used by
  // `social_platforms.icon_name='Github'`); `'github'` is the brand icon
  // (used by `chat_admin_slash_commands.icon_name='github'`).
  github: fromSet('GithubClassicIcon'),
  'github-lucide': lucide('github'),
  globe: lucide('globe'),
  'graduation-cap': lucide('graduation-cap'),
  headphones: lucide('headphones'),
  info: lucide('info'),
  instagram: fromSet('InstagramClassicIcon'),
  'instagram-lucide': lucide('instagram'),
  mail: lucide('mail'),
  megaphone: lucide('megaphone'),
  'message-circle': lucide('message-circle'),
  'message-square': lucide('message-square'),
  newspaper: lucide('newspaper'),
  package: lucide('package'),
  'pen-square': lucide('square-pen'),
  phone: lucide('phone'),
  rocket: lucide('rocket'),
  search: lucide('search'),
  send: lucide('send'),
  shield: lucide('shield'),
  star: lucide('star'),
  table: lucide('table-properties'),
  'trending-up': lucide('trending-up'),
  twitter: lucide('twitter'),
  users: lucide('users'),
  video: lucide('video'),
  whatsapp: fromSet('WhatsappIcon'),
  youtube: fromSet('YoutubeClassicIcon'),
  'youtube-lucide': lucide('youtube'),
  // brand-only icons (no lucide variant in current use)
  slack: fromSet('SlackIcon'),
  clickup: fromSet('ClickupIcon'),
  hubspot: fromSet('HubspotIcon'),
  linkedin: fromSet('LinkedinClassicIcon'),
  x: fromSet('XLogoIcon'),
  // The OpenFrame logo's frame takes the text colour of where it sits (its own
  // default is invisible on dark chat surfaces); the squares stay white.
  openframe: {
    set: 'OpenframeLogoIcon',
    color: 'currentColor',
    secondaryColor: 'var(--ods-system-greys-white)',
    ownColor: true,
  },
};

/** The icon a registry key names, or `undefined` for a key the registry does not hold. */
export function registryIcon(key: string): IconComponent | undefined {
  if (!Object.prototype.hasOwnProperty.call(ICON_REGISTRY, key)) return undefined;
  return iconOf(ICON_REGISTRY[key]) ?? undefined;
}

const GLOBE: IconRef = lucide('globe');

/** The glyph a name with no icon draws. */
const fallbackIcon = (name: string): IconComponent => lucideIcon(name) as IconComponent;

/**
 * PascalCase → kebab-case alias table for DB columns that store icon
 * names as component identifiers (currently `social_platforms.icon_name`).
 * Keep these in sync with the actual rows in those tables.
 */
const PASCAL_TO_KEBAB_ALIASES: Record<string, string> = {
  // Lucide PascalCase names → kebab equivalents
  Activity: 'activity',
  Banknote: 'banknote',
  Bell: 'bell',
  BookOpen: 'book-open',
  Box: 'box',
  Briefcase: 'briefcase',
  Calendar: 'calendar',
  CheckSquare: 'check-square',
  DollarSign: 'dollar-sign',
  // Lucide PascalCase → the `-lucide` kebab variant (kebab default is the
  // brand icon for the social-platform names below).
  Facebook: 'facebook-lucide',
  FileText: 'file-text',
  Github: 'github-lucide',
  Globe: 'globe',
  GraduationCap: 'graduation-cap',
  Headphones: 'headphones',
  Info: 'info',
  Instagram: 'instagram-lucide',
  Mail: 'mail',
  Megaphone: 'megaphone',
  MessageCircle: 'message-circle',
  MessageSquare: 'message-square',
  Newspaper: 'newspaper',
  Package: 'package',
  PenSquare: 'pen-square',
  Phone: 'phone',
  Rocket: 'rocket',
  Search: 'search',
  Send: 'send',
  Shield: 'shield',
  Star: 'star',
  TableProperties: 'table',
  TrendingUp: 'trending-up',
  Twitter: 'twitter',
  Users: 'users',
  Video: 'video',
  Youtube: 'youtube-lucide',
  // Brand-icon PascalCase exports → kebab (kebab default is the brand)
  SlackIcon: 'slack',
  GitHubIcon: 'github',
  ClickUpIcon: 'clickup',
  HubspotIcon: 'hubspot',
  LinkedInIcon: 'linkedin',
  FacebookClassicIcon: 'facebook',
  InstagramClassicIcon: 'instagram',
  YouTubeIcon: 'youtube',
  WhatsAppIcon: 'whatsapp',
  XLogo: 'x',
  OpenFrameLogo: 'openframe',
};

/**
 * Normalize an icon key to the registry's canonical kebab-case form.
 * Accepts PascalCase variants (from `social_platforms.icon_name`-style
 * columns) and passes kebab-case keys through unchanged.
 */
export function normalizeIconKey(key: string): string {
  return PASCAL_TO_KEBAB_ALIASES[key] ?? key;
}

/**
 * Resolve an `icon_name` to its React component. Accepts both PascalCase
 * and kebab-case keys (normalizes PascalCase first). Unknown / null /
 * undefined names fall back to `FileText` — chips always render with
 * SOMETHING rather than a missing glyph. The fallback is intentional:
 * a typo in a new admin-authored row shouldn't crash render.
 */
export function getIconComponent(iconName: string | null | undefined): IconComponent {
  if (!iconName) return fallbackIcon('file-text');
  return registryIcon(normalizeIconKey(iconName)) ?? fallbackIcon('file-text');
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

  const canonicalKey = normalizeIconKey(iconName);
  if (Object.prototype.hasOwnProperty.call(ICON_REGISTRY, canonicalKey)) {
    const colorConfig = ICON_COLORS[canonicalKey] || {};
    return createElement(NamedIcon, { icon: ICON_REGISTRY[canonicalKey], className: finalClassName, ...colorConfig });
  }

  console.error(
    `[getDynamicIcon] Icon NOT found in registry: "${iconName}" (normalized to "${canonicalKey}"). Available icons:`,
    Object.keys(ICON_REGISTRY),
  );
  return createElement(NamedIcon, { icon: GLOBE, className: finalClassName });
}
