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
 * Adding a new icon: import the component below, add a `'name': Component`
 * entry in `ICON_REGISTRY`, and (if the same icon also flows in from a DB
 * column that uses PascalCase) add a `PascalName → 'name'` row to
 * `PASCAL_TO_KEBAB_ALIASES`.
 *
 * Fallback: an unknown / null icon_name resolves to `FileText` so a chip
 * never renders without an icon.
 */

import { createElement, type ComponentType, type ReactNode } from 'react'
import {
  Activity,
  Banknote,
  Bell,
  BookOpen,
  Box,
  Briefcase,
  Calendar,
  CheckSquare,
  DollarSign,
  Facebook,
  FileText,
  Github,
  Globe,
  GraduationCap,
  Headphones,
  Info,
  Instagram,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Package,
  PenSquare,
  Rocket,
  Search,
  Send,
  Shield,
  Star,
  TableProperties,
  TrendingUp,
  Twitter,
  Users,
  Video,
  Youtube,
} from 'lucide-react'
// Brand icons — lib-local exports.
import {
  SlackIcon,
  GitHubIcon,
  ClickUpIcon,
  HubspotIcon,
  LinkedInIcon,
  FacebookIcon,
  InstagramIcon,
  YouTubeIcon,
  WhatsAppIcon,
  XLogo,
  OpenFrameLogo as RawOpenFrameLogo,
} from '../../icons'

// Wrapper so the OpenFrame logo's outer frame inherits the parent's text
// color instead of its hardcoded default — that default is invisible on
// dark chat surfaces. The white squares stay white (visible on dark).
// With this, the parent's `text-ods-text-primary` propagates via
// `currentColor` and the frame renders in the same primary text color
// as the lucide icons next to it. Uses `createElement` (not JSX) so this
// stays a `.ts` file. Accepts `color` for shape-compat with the registry's
// IconComponent type, but ignores it — the logo's outer frame is wired
// to `currentColor` via the upperPathColor pass-through.
const OpenFrameLogoIcon: ComponentType<{ className?: string; color?: string }> = ({ className }) =>
  createElement(RawOpenFrameLogo, { className, upperPathColor: 'currentColor' })

/**
 * Loose icon-component shape: every entry accepts `className`; `color` is
 * optional (lucide + most brand icons accept it; OpenFrameLogo doesn't,
 * but `color` is optional so passing `undefined` is a no-op). Loose enough
 * to accept both lucide's `LucideIcon` and our brand SVG components.
 */
type IconComponent = ComponentType<{ className?: string; color?: string }>

/**
 * The kebab-case registry. ALL lookups go through here; PascalCase
 * aliases route through `normalizeIconKey()` first.
 */
export const ICON_REGISTRY: Record<string, IconComponent> = {
  // lucide-react (kebab-case)
  activity:          Activity,
  banknote:          Banknote,
  bell:              Bell,
  'book-open':       BookOpen,
  box:               Box,
  briefcase:         Briefcase,
  calendar:          Calendar,
  'check-square':    CheckSquare,
  'dollar-sign':     DollarSign,
  // For brand-vs-lucide variants the kebab key is the BRAND (most-common
  // social-platform intent); `'<name>-lucide'` carries the lucide outline.
  facebook:          FacebookIcon,
  'facebook-lucide': Facebook,
  'file-text':       FileText,
  // `'github-lucide'` is the lucide outline glyph (used by
  // `social_platforms.icon_name='Github'`); `'github'` is the brand icon
  // (used by `chat_admin_slash_commands.icon_name='github'`). The PascalCase
  // alias `'Github' → 'github-lucide'` routes the lucide glyph for
  // social-platform DB rows; `'GitHubIcon' → 'github'` keeps brand routing
  // consistent for callers that store the PascalCase component name.
  github:            GitHubIcon,
  'github-lucide':   Github,
  globe:             Globe,
  'graduation-cap':  GraduationCap,
  headphones:        Headphones,
  info:              Info,
  instagram:         InstagramIcon,
  'instagram-lucide': Instagram,
  mail:              Mail,
  megaphone:         Megaphone,
  'message-circle':  MessageCircle,
  'message-square':  MessageSquare,
  newspaper:         Newspaper,
  package:           Package,
  'pen-square':      PenSquare,
  rocket:            Rocket,
  search:            Search,
  send:              Send,
  shield:            Shield,
  star:              Star,
  table:             TableProperties,
  'trending-up':     TrendingUp,
  twitter:           Twitter,
  users:             Users,
  video:             Video,
  whatsapp:          WhatsAppIcon,
  youtube:           YouTubeIcon,
  'youtube-lucide':  Youtube,
  // brand-only icons (no lucide variant in current use)
  slack:             SlackIcon,
  clickup:           ClickUpIcon,
  hubspot:           HubspotIcon,
  linkedin:          LinkedInIcon,
  x:                 XLogo,
  openframe:         OpenFrameLogoIcon,
}

/**
 * PascalCase → kebab-case alias table for DB columns that store icon
 * names as component identifiers (currently `social_platforms.icon_name`).
 * Keep these in sync with the actual rows in those tables.
 */
const PASCAL_TO_KEBAB_ALIASES: Record<string, string> = {
  // Lucide PascalCase names → kebab equivalents
  Activity:        'activity',
  Banknote:        'banknote',
  Bell:            'bell',
  BookOpen:        'book-open',
  Box:             'box',
  Briefcase:       'briefcase',
  Calendar:        'calendar',
  CheckSquare:     'check-square',
  DollarSign:      'dollar-sign',
  // Lucide PascalCase → the `-lucide` kebab variant (kebab default is the
  // brand icon for the social-platform names below).
  Facebook:        'facebook-lucide',
  FileText:        'file-text',
  Github:          'github-lucide',
  Globe:           'globe',
  GraduationCap:   'graduation-cap',
  Headphones:      'headphones',
  Info:            'info',
  Instagram:       'instagram-lucide',
  Mail:            'mail',
  Megaphone:       'megaphone',
  MessageCircle:   'message-circle',
  MessageSquare:   'message-square',
  Newspaper:       'newspaper',
  Package:         'package',
  PenSquare:       'pen-square',
  Rocket:          'rocket',
  Search:          'search',
  Send:            'send',
  Shield:          'shield',
  Star:            'star',
  TableProperties: 'table',
  TrendingUp:      'trending-up',
  Twitter:         'twitter',
  Users:           'users',
  Video:           'video',
  Youtube:         'youtube-lucide',
  // Brand-icon PascalCase exports → kebab (kebab default is the brand)
  SlackIcon:        'slack',
  GitHubIcon:       'github',
  ClickUpIcon:      'clickup',
  HubspotIcon:      'hubspot',
  LinkedInIcon:     'linkedin',
  FacebookIcon:     'facebook',
  InstagramIcon:    'instagram',
  YouTubeIcon:      'youtube',
  WhatsAppIcon:     'whatsapp',
  XLogo:            'x',
  OpenFrameLogo:    'openframe',
}

/**
 * Normalize an icon key to the registry's canonical kebab-case form.
 * Accepts PascalCase variants (from `social_platforms.icon_name`-style
 * columns) and passes kebab-case keys through unchanged.
 */
export function normalizeIconKey(key: string): string {
  return PASCAL_TO_KEBAB_ALIASES[key] ?? key
}

/**
 * Resolve an `icon_name` to its React component. Accepts both PascalCase
 * and kebab-case keys (normalizes PascalCase first). Unknown / null /
 * undefined names fall back to `FileText` — chips always render with
 * SOMETHING rather than a missing glyph. The fallback is intentional:
 * a typo in a new admin-authored row shouldn't crash render.
 */
export function getIconComponent(
  iconName: string | null | undefined,
): ComponentType<{ className?: string; color?: string }> {
  if (!iconName) return FileText
  return ICON_REGISTRY[normalizeIconKey(iconName)] ?? FileText
}

// ---------------------------------------------------------------------------
// Sized-icon rendering helper (migrated from `src/utils/dynamic-icons.tsx`)
// ---------------------------------------------------------------------------

export type DynamicIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_CLASSES: Record<DynamicIconSize, string> = {
  xs: 'w-3 h-3',    // 12px
  sm: 'w-4 h-4',    // 16px
  md: 'w-6 h-6',    // 24px
  lg: 'w-8 h-8',    // 32px
  xl: 'w-12 h-12',  // 48px
}

/**
 * Optional per-icon color overrides. Keys are kebab-case (canonical
 * registry form) — pass any incoming key through `normalizeIconKey()`
 * before lookup.
 */
const ICON_COLORS: Record<string, { color?: string; fill?: string }> = {
  linkedin: { color: '#0A66C2' },
  facebook: { color: '#1877F2' },
  youtube: { color: '#FF0000' },
}

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
    console.warn('[getDynamicIcon] No iconName provided, using Globe fallback')
    return createElement(Globe, { className: SIZE_CLASSES[size] })
  }

  const sizeClass = SIZE_CLASSES[size]
  const finalClassName = className ? `${sizeClass} ${className}` : sizeClass

  const canonicalKey = normalizeIconKey(iconName)
  const IconComponent = ICON_REGISTRY[canonicalKey]

  if (IconComponent) {
    const colorConfig = ICON_COLORS[canonicalKey] || {}
    return createElement(IconComponent, { className: finalClassName, ...colorConfig })
  }

  console.error(
    `[getDynamicIcon] Icon NOT found in registry: "${iconName}" (normalized to "${canonicalKey}"). Available icons:`,
    Object.keys(ICON_REGISTRY),
  )
  return createElement(Globe, { className: finalClassName })
}
