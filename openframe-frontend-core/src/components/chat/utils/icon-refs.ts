/**
 * WHAT AN ICON NAME DRAWS: the ONE place that decides it, for every surface (chat chips, slash commands, admin rows,
 * social links, source rows, MCP icon images). Plain data and pure functions, no React: a server reads the same rules
 * the browser draws by.
 *
 *   `iconRefFor(name, { variant })` is the only answer:
 *     - `design` (default; chips, rows, pickers, images): an alias (`ICON_ALIASES`), else the generated set by its
 *       naming convention (`chart-pie` → `ChartPieIcon`), else lucide's icon by that name (`git-pull-request`).
 *     - `brand` (social links, channel platforms, source rows): the brand table (`ICON_REGISTRY`, PascalCase column
 *       values through `normalizeIconKey`), else the design set.
 *   `brandLogoRefForName(company)`: a company's logo by the set's `<Brand>LogoIcon` convention.
 *
 * Everything that DRAWS an icon only draws what these answer: `EntityIcon` / `resolveIcon` / `findIcon` /
 * `brandLogoForName` (icon-library), `getIconComponent` / `getDynamicIcon` (icon-registry) and, on a server,
 * `loadNamedIcon` (utils/named-icon). To change what a name draws, change it here.
 */

import { platformAccentVarName } from '../../../utils/platform-identity';
import { ICON_SET_NAMES, LUCIDE_ICON_NAMES } from '../../icons-v2-generated/icon-names';
import type { IconRef } from './icon-loading';

// A sister platform's mark is drawn in THAT platform's brand colour (the
// platform brand registry), never in the accent of the page showing it: on
// flamingo.run the OpenMSP mark stays OpenMSP yellow, not flamingo pink.
const brandColor = (platform: string) => `var(${platformAccentVarName(platform)})`;

/** The size a mark draws at when it is given none (a chip, a command row). */
const MARK_SIZE = 16;

// The marks several names share. Each is DATA: the icon's name in the set and,
// for a mark with colours of its own, those colours. Nothing is loaded until a
// name is drawn.
const OPENMSP_MARK: IconRef = {
  set: 'OpenmspLogoIcon',
  size: MARK_SIZE,
  // On the dark surfaces every glyph sits on, the bubbles take the theme's text
  // and background tokens and the back bubble OpenMSP's brand colour.
  color: 'var(--color-text-primary)',
  secondaryColor: 'var(--color-bg)',
  tertiaryColor: brandColor('openmsp'),
  ownColor: true,
};
const FLAMINGO_MARK: IconRef = {
  set: 'FlamingoMarkIcon',
  size: MARK_SIZE,
  color: brandColor('flamingo'),
  ownColor: true,
};
// The OpenFrame logo as a GLYPH: both of its parts in one colour, the slot's
// own unless the caller names one, so it tints like every icon beside it.
const OPENFRAME_GLYPH: IconRef = { set: 'OpenframeLogoIcon', size: MARK_SIZE, oneColor: true };
const CLICKUP_GREY: IconRef = { set: 'ClickupLogoGreyIcon' };
const SLACK_GREY: IconRef = { set: 'SlackLogoGreyIcon' };
const HUBSPOT_GREY: IconRef = { set: 'HubspotLogoGreyIcon' };
const GITHUB: IconRef = { set: 'GithubIcon' };
const ROCKET: IconRef = { set: 'Rocket02Icon' };
const BOOK: IconRef = { set: 'BookIcon' };
const CHATS: IconRef = { set: 'ChatsIcon' };
const FILE: IconRef = { set: 'FileIcon' };

/**
 * The names that do NOT follow the set's naming convention — backend `iconName` → the icon it draws, as data. Brand-grey
 * logos live in `icons-v2-generated/brand-logos/`; the rest are
 * monochrome v2 glyphs that inherit `currentColor` from the card slot
 * (`text-ods-text-secondary`).
 */
export const ICON_ALIASES: Readonly<Record<string, IconRef>> = {
  // Production `/api/docs/commands` keys (multi-platform-hub contract)
  clickup: CLICKUP_GREY,
  slack: SLACK_GREY,
  hubspot: HUBSPOT_GREY,
  github: GITHUB,
  openframe: OPENFRAME_GLYPH,
  rocket: ROCKET,
  video: { set: 'VideoRecorderIcon' },
  headphones: { set: 'HeadphoneIcon' },

  // The two LLM brands offered by `ICON_OPTIONS`. Their brand-colored glyphs
  // are the only picker entries that hardcode a fill (#000 / #D97757), so they
  // ignored the chip accent and sat black and orange in a cyan grid; the grey
  // variants fill with `currentColor` like every other brand logo here.
  'openai-logo': { set: 'OpenaiLogoGreyIcon' },
  'anthropic-logo': { set: 'AnthropicLogoGreyIcon' },

  // Figma-canonical aliases (node 7363:205938) — kept for Storybook
  // fixtures and any older feed entries still using the long names.
  'clickup-logo': CLICKUP_GREY,
  'clickup-logo-grey': CLICKUP_GREY,
  'slack-logo': SLACK_GREY,
  'slack-logo-grey': SLACK_GREY,
  'hubspot-logo': HUBSPOT_GREY,
  'hubspot-logo-grey': HUBSPOT_GREY,
  'github-logo': GITHUB,
  'logo-openframe': OPENFRAME_GLYPH,
  'rocket-01': ROCKET,
  'rocket-02': ROCKET,

  // The platforms' marks, by the names the announcement bar and the navigation store.
  'openframe-logo': OPENFRAME_GLYPH,
  'openmsp-logo': OPENMSP_MARK,
  // Major League GitHub draws its mark in the theme's text colour on its own site, never in an accent.
  'mlg-logo': { set: 'MlgLogoIcon', size: MARK_SIZE, color: 'var(--color-text-primary)' },
  'tmcg-logo': {
    set: 'TmcgMarkIcon',
    size: MARK_SIZE,
    secondaryColor: brandColor('tmcg'),
    tertiaryColor: 'var(--color-text-primary)',
    ownColor: true,
  },
  flamingo: FLAMINGO_MARK,
  'flamingo-logo': FLAMINGO_MARK,
  // The same mark as a GLYPH: it takes the colour of the slot it sits in, like every icon beside it.
  'flamingo-logo-grey': { set: 'FlamingoMarkIcon', size: MARK_SIZE, color: 'currentColor' },
  // Microsoft 365 is drawn with the Office 365 mark, which the set names by the product's older name.
  'microsoft-365-logo-grey': { set: 'Office365LogoGreyIcon' },
  megaphone: { lucide: 'megaphone' },
  bell: { lucide: 'bell' },
  info: { lucide: 'info' },
  star: { lucide: 'star' },
  package: { lucide: 'package' },

  // Names whose glyph is another icon of the set.
  book: BOOK,
  'book-open': BOOK,
  file: FILE,
  'file-text': FILE,
  chats: CHATS,
  'message-square': CHATS,
  'message-circle': CHATS,
};

/** The design set's icon for a name: its alias, else the generated set by the naming convention, else `null`. */
function iconRefOfName(iconName: string | null | undefined): IconRef | null {
  if (!iconName) return null;
  if (Object.prototype.hasOwnProperty.call(ICON_ALIASES, iconName)) return ICON_ALIASES[iconName] ?? null;
  return conventionIconRef(iconName);
}

/**
 * Generic resolution against the FULL `icons-v2-generated` set.
 *
 * Every generated icon follows one naming convention: a file named `<kebab>-icon.tsx` exports a component
 * `<PascalCase>Icon`. So any `iconName` that names a real icon (`chart-pie`, `bank`, `piggy-bank`) resolves here
 * without a hand-maintained entry. Two PascalCase spellings are tried because the generator is inconsistent about
 * the `ai` token (`BrainAIIcon` beside `AdobeAiIcon`); the set's names decide which exists.
 *
 * An icon found by its name takes the text colour of wherever it sits, like its row-mates: a few icons of the set carry
 * a default colour of their own, which is right where a component places the icon and wrong in a row of named glyphs.
 */
function conventionIconRef(iconName: string): IconRef | null {
  const tokens = iconName.trim().toLowerCase().replace(/_/g, '-').split('-');
  if (tokens.some(t => t.length === 0)) return null;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  for (const name of [
    `${tokens.map(cap).join('')}Icon`,
    `${tokens.map(t => (t === 'ai' ? 'AI' : cap(t))).join('')}Icon`,
  ]) {
    if (ICON_SET_NAMES.has(name)) return { set: name, color: 'currentColor' };
  }
  return null;
}

// ── The brand set ─────────────────────────────────────────────────────────────

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
  // `channel_platforms.icon_name='Github'`); `'github'` is the brand icon
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
  // Monochrome mark in the text colour: TikTok's brand black would vanish on dark surfaces.
  tiktok: fromSet('TiktokIcon'),
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

/**
 * PascalCase → kebab-case alias table for DB columns that store icon
 * names as component identifiers (currently `channel_platforms.icon_name`).
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
  // `channel_platforms.icon_name` stores the names these marks were first exported under.
  FacebookIcon: 'facebook',
  InstagramIcon: 'instagram',
  FacebookClassicIcon: 'facebook',
  InstagramClassicIcon: 'instagram',
  YouTubeIcon: 'youtube',
  WhatsAppIcon: 'whatsapp',
  XLogo: 'x',
  TiktokIcon: 'tiktok',
  TikTokIcon: 'tiktok',
  OpenFrameLogo: 'openframe',
};

/**
 * Normalize an icon key to the registry's canonical kebab-case form.
 * Accepts PascalCase variants (from `channel_platforms.icon_name`-style
 * columns) and passes kebab-case keys through unchanged.
 */
export function normalizeIconKey(key: string): string {
  return PASCAL_TO_KEBAB_ALIASES[key] ?? key;
}

// ── The one answer ────────────────────────────────────────────────────────────

/** Which of the two icon sets a surface draws from (see the header). */
export type IconVariant = 'design' | 'brand';

/**
 * THE icon a name draws, as data, or `null` when no set holds it (the drawer then shows its own fallback glyph).
 * `lucide: false` keeps to the design set (a caller that draws nothing for an unknown name, `findIcon`).
 */
export function iconRefFor(
  iconName: string | null | undefined,
  { variant = 'design', lucide: withLucide = true }: { variant?: IconVariant; lucide?: boolean } = {},
): IconRef | null {
  if (!iconName) return null;
  if (variant === 'brand') {
    const key = normalizeIconKey(iconName);
    if (Object.prototype.hasOwnProperty.call(ICON_REGISTRY, key)) return ICON_REGISTRY[key] ?? null;
    return iconRefOfName(iconName);
  }
  const design = iconRefOfName(iconName);
  if (design || !withLucide) return design;
  const name = iconName.trim().toLowerCase();
  return LUCIDE_ICON_NAMES.has(name) ? { lucide: name } : null;
}

/**
 * A company's or product's logo by NAME ("Google Cloud Platform", "Azure AD"), or `null`: the set's `<Brand>LogoIcon`
 * convention, never a list, so a logo added to `icons-v2-generated/brand-logos` is found with no code change. The
 * name's word runs are tried longest first ("Azure AD" → `AzureAdLogoIcon` before `AzureLogoIcon`); only `…LogoIcon`
 * names count, so "Cloud" never resolves to a generic cloud glyph.
 */
export function brandLogoRefForName(name: string | null | undefined): IconRef | null {
  const words = (name ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pascal = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  for (let length = Math.min(3, words.length); length >= 1; length -= 1) {
    for (let start = 0; start + length <= words.length; start += 1) {
      const exportName = `${words
        .slice(start, start + length)
        .map(pascal)
        .join('')}LogoIcon`;
      if (ICON_SET_NAMES.has(exportName)) return { set: exportName };
    }
  }
  return null;
}
