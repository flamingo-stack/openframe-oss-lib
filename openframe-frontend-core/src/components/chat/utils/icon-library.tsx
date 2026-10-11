/**
 * Resolve the empty-state onboarding-card icon from a backend
 * `SlashCommandSummary.iconName`.
 *
 * Primary keys match the production `/api/docs/commands` contract
 * (multi-platform-hub) — short, source-system-style identifiers:
 *
 *   - `clickup` → ClickUp brand glyph (mono grey)
 *   - `slack`   → Slack brand glyph (mono grey)
 *   - `hubspot` → HubSpot brand glyph (mono grey)
 *   - `github`  → GitHub brand glyph
 *   - `openframe` → OpenFrame logo
 *   - `newspaper` / `rocket` / `briefcase` / `graduation-cap`
 *     / `video` / `calendar` / `headphones` → v2 generic glyphs
 *     mapped to the closest available icon in `icons-v2-generated`
 *
 * Figma-canonical keys (`clickup-logo-grey`, `logo-openframe`,
 * `rocket-02`, …) and a handful of generic v2 fall-throughs
 * (`search`, `ticket`, `bug`, …) are kept as aliases so the
 * Storybook fixtures and any older feed entries still resolve.
 *
 * Any `iconName` NOT in the curated map below is resolved generically
 * against the entire `icons-v2-generated` set by naming convention
 * (`chart-pie` → `ChartPieIcon`, `bank` → `BankIcon`, …) — see
 * `resolveFromLibrary`. So the full icon library is supported, and the
 * curated map only exists for aliases that don't map 1:1. Keys that
 * name no real icon (and `null`) fall back to `FileIcon` so a
 * misconfigured row still renders.
 */

import { platformAccentVarName } from '../../../utils/platform-identity';
import { iconFromSet, iconOf, setIcon, type IconComponent, type IconRef } from './icon-loading';
import { getIconComponent, normalizeIconKey, registryIcon } from './icon-registry';

export type { IconComponent } from './icon-loading';

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
    set: 'MiamiCyberGangLogoFaceOnlyIcon',
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

/** The icon an alias names, or `undefined` for a name that is not an alias. */
function aliasIcon(iconName: string): IconComponent | undefined {
  if (!Object.prototype.hasOwnProperty.call(ICON_ALIASES, iconName)) return undefined;
  return iconOf(ICON_ALIASES[iconName]) ?? undefined;
}

/**
 * Generic resolution against the FULL `icons-v2-generated` set.
 *
 * Every generated icon follows one naming convention: a file named
 * `<kebab>-icon.tsx` exports a component `<PascalCase>Icon` with the
 * `{ size, className, color }` signature `IconComponent`
 * expects. So any backend `iconName` that names a real icon (e.g.
 * `chart-pie`, `bank`, `money-bill-dollar`, `piggy-bank`) resolves
 * here without a hand-maintained entry — the whole library is
 * supported, not just the curated aliases above.
 *
 * Two candidate PascalCase spellings are tried because the generator
 * is inconsistent about the `ai` token: the standalone AI glyphs
 * export `…AIIcon` (`BrainAIIcon`, `CodeAIIcon`), while the Adobe
 * Illustrator brand glyph keeps `AdobeAiIcon`. We try the literal
 * capitalization first, then the `ai → AI` variant, and take whichever
 * actually exists in the set (its loader table is the source of truth, so
 * we never guess wrong).
 */
function resolveFromLibrary(iconName: string): IconComponent | undefined {
  const tokens = iconName.trim().toLowerCase().replace(/_/g, '-').split('-');
  if (tokens.some(t => t.length === 0)) return undefined;
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const candidates = [
    `${tokens.map(cap).join('')}Icon`,
    `${tokens.map(t => (t === 'ai' ? 'AI' : cap(t))).join('')}Icon`,
  ];
  for (const name of candidates) {
    // An icon found by its name takes the text colour of wherever it sits, like
    // its row-mates: a few icons of the set carry a default colour of their own
    // (the one their artwork was drawn in), which is right where a component
    // places the icon and wrong in a row of named glyphs. A caller's `color` wins.
    if (iconFromSet(name)) return iconOf({ set: name, color: 'currentColor' }) ?? undefined;
  }
  return undefined;
}

/**
 * THE brand logo for a company or product NAME ("Google Cloud Platform",
 * "Anthropic", "Azure AD"), or `null` when the icon set has no mark for it —
 * the caller keeps its own fallback (initials). Dynamic by the icon set's
 * naming convention, never a list: a brand's mark is `<Brand>LogoIcon`, so a
 * logo added to `icons-v2-generated/brand-logos` is found with no code change.
 * The name's word runs are tried longest first ("Azure AD" → `AzureAdLogoIcon`
 * before `AzureLogoIcon`; "Google Workspace" → `GoogleLogoIcon`). Only
 * `…LogoIcon` names count, so "Cloud" never resolves to a generic cloud glyph.
 */
export function brandLogoForName(name: string | null | undefined): IconComponent | null {
  const words = (name ?? '').split(/[^A-Za-z0-9]+/).filter(Boolean);
  const pascal = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  for (let length = Math.min(3, words.length); length >= 1; length -= 1) {
    for (let start = 0; start + length <= words.length; start += 1) {
      const Logo = iconFromSet(
        `${words
          .slice(start, start + length)
          .map(pascal)
          .join('')}LogoIcon`,
      );
      if (Logo) return Logo;
    }
  }
  return null;
}

/**
 * THE single icon-name → component resolver for the whole app. Two variants —
 * one entry point, no duplicated resolver machinery:
 *
 *   • `'design'` (DEFAULT): the icons-v2 design set — chat chips, slash
 *      autocomplete, announcement bar, AI-agent icons, the admin picker.
 *      Order: curated `ICON_ALIASES` (brand-grey logos, tinted OpenFrame,
 *      semantic aliases) → generic `icons-v2-generated` by naming convention →
 *      `FileIcon`.
 *   • `'brand'`: the brand/social set (lucide + brand-colored logos) via the
 *      registry resolver `getIconComponent` (PascalCase-normalised) — social
 *      links, source-row CTAs.
 *
 * The two glyph SETS differ on purpose (a grey design 'slack' vs a brand-color
 * social 'slack'); this resolver is the ONE place that owns both. `getIconComponent`
 * / `getDynamicIcon` remain as the brand-variant + sized-brand helpers.
 */
export function resolveIcon(
  iconName: string | null | undefined,
  opts?: { variant?: 'design' | 'brand' },
): IconComponent {
  if (opts?.variant === 'brand') {
    // The brand set first. A name it does not hold is drawn from the design
    // set, so a source whose icon lives only there is never shown as the file
    // glyph; a name neither holds keeps the registry's own fallback.
    const brand = iconName ? registryIcon(normalizeIconKey(iconName)) : undefined;
    if (brand) return brand;
    const design = iconName ? (aliasIcon(iconName) ?? resolveFromLibrary(iconName)) : undefined;
    return design ?? getIconComponent(iconName);
  }
  if (!iconName) return setIcon('FileIcon');
  return aliasIcon(iconName) ?? resolveFromLibrary(iconName) ?? setIcon('FileIcon');
}

/** The icon a name resolves to, or `null` when the set holds none: for a caller that draws nothing in that case (`resolveIcon` draws a fallback glyph). */
export function findIcon(iconName: string | null | undefined): IconComponent | null {
  if (!iconName) return null;
  return aliasIcon(iconName) ?? resolveFromLibrary(iconName) ?? null;
}

/** One selectable icon in the admin slash-command picker. */
export interface IconOption {
  /** Stored `icon_name` value — a kebab-case `icons-v2-generated` key (or a
   *  curated alias) that `resolveIcon` displays in the chat. */
  key: string;
  /** Human-friendly label shown in the picker dropdown. */
  label: string;
}

/**
 * Curated icon set offered by the admin slash-command icon picker
 * (`/admin/chat-config` → Edit slash command).
 *
 * THE PICKER AND THE CHAT SHARE ONE ICON SOURCE: every `key` here is an
 * `icons-v2-generated` name (or curated alias) that `resolveIcon`
 * renders — so whatever the admin selects always displays in the chip /
 * autocomplete, with no fallback-glyph drift. (The full library is far larger
 * and resolvable generically; this is the curated, slash-command-relevant
 * subset for a usable dropdown.) Keep keys kebab-case to match the DB
 * `chat_admin_slash_commands.icon_name` convention.
 */
export const ICON_OPTIONS: ReadonlyArray<IconOption> = [
  // Brands
  { key: 'openframe', label: 'OpenFrame' },
  { key: 'slack', label: 'Slack' },
  { key: 'hubspot', label: 'HubSpot' },
  { key: 'clickup', label: 'ClickUp' },
  { key: 'github', label: 'GitHub' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'twitter', label: 'Twitter (X)' },
  { key: 'twitter-x', label: 'X' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'discord', label: 'Discord' },
  { key: 'figma', label: 'Figma' },
  { key: 'google', label: 'Google' },
  { key: 'apple', label: 'Apple' },
  { key: 'windows', label: 'Windows' },
  { key: 'android', label: 'Android' },
  { key: 'openai-logo', label: 'OpenAI' },
  { key: 'anthropic-logo', label: 'Anthropic' },
  // Content & docs
  { key: 'newspaper', label: 'Newspaper' },
  { key: 'book', label: 'Book' },
  { key: 'file', label: 'File' },
  { key: 'file-text', label: 'Document' },
  { key: 'file-code', label: 'Code file' },
  { key: 'file-chart-bar', label: 'Report' },
  { key: 'file-dollar', label: 'Invoice file' },
  { key: 'folder', label: 'Folder' },
  { key: 'folder-open', label: 'Folder open' },
  { key: 'clipboard', label: 'Clipboard' },
  { key: 'clipboard-list', label: 'Checklist' },
  { key: 'clipboard-check', label: 'Clipboard check' },
  { key: 'memo', label: 'Memo' },
  { key: 'paperclip', label: 'Attachment' },
  { key: 'copy-01', label: 'Copy' },
  { key: 'files', label: 'Files' },
  { key: 'box-archive', label: 'Box' },
  { key: 'parcel-01', label: 'Parcel' },
  // Media
  { key: 'video', label: 'Video' },
  { key: 'headphones', label: 'Podcast / audio' },
  { key: 'podcast', label: 'Podcast' },
  { key: 'mic', label: 'Microphone' },
  { key: 'music-note-01', label: 'Music' },
  { key: 'camera', label: 'Camera' },
  { key: 'image', label: 'Image' },
  { key: 'film-hr', label: 'Film' },
  { key: 'play', label: 'Play' },
  // Date & time
  { key: 'calendar', label: 'Calendar' },
  { key: 'calendar-check', label: 'Calendar check' },
  { key: 'clock', label: 'Clock' },
  { key: 'alarm', label: 'Alarm' },
  { key: 'stopwatch', label: 'Stopwatch' },
  { key: 'timer', label: 'Timer' },
  { key: 'hourglass', label: 'Hourglass' },
  // Places & business
  { key: 'briefcase', label: 'Briefcase' },
  { key: 'graduation-cap', label: 'Education' },
  { key: 'building', label: 'Building' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'school', label: 'School' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'shop', label: 'Shop' },
  // Communication
  { key: 'search', label: 'Search' },
  { key: 'chats', label: 'Chat' },
  { key: 'message-text', label: 'Message' },
  { key: 'messages', label: 'Messages' },
  { key: 'email', label: 'Email' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'send-01', label: 'Send' },
  { key: 'at-sign', label: 'Mention' },
  { key: 'bell', label: 'Notifications' },
  { key: 'megaphone-01', label: 'Announcement' },
  // Charts & analytics
  { key: 'chart-pie', label: 'Pie chart' },
  { key: 'chart-donut', label: 'Donut chart' },
  { key: 'chart-bar-01-ver', label: 'Bar chart' },
  { key: 'chart-line-up', label: 'Line chart' },
  { key: 'trend-up', label: 'Trend up' },
  { key: 'trend-down', label: 'Trend down' },
  { key: 'presentation', label: 'Presentation' },
  { key: 'analysis', label: 'Analysis' },
  { key: 'activity', label: 'Activity' },
  { key: 'network', label: 'Network' },
  // Finance
  { key: 'bank', label: 'Bank' },
  { key: 'money-bill-dollar', label: 'Money' },
  { key: 'money-bill', label: 'Bill' },
  { key: 'coins', label: 'Coins' },
  { key: 'coin', label: 'Coin' },
  { key: 'coins-exchange-currency', label: 'Currency exchange' },
  { key: 'piggy-bank', label: 'Savings' },
  { key: 'wallet-01', label: 'Wallet' },
  { key: 'credit-card', label: 'Credit card' },
  { key: 'hand-coin', label: 'Hand coin' },
  { key: 'dollar', label: 'Dollar' },
  { key: 'dollar-circle', label: 'Dollar circle' },
  { key: 'euro', label: 'Euro' },
  { key: 'bitcoin', label: 'Bitcoin' },
  { key: 'percent', label: 'Percent' },
  { key: 'receipt-01', label: 'Receipt' },
  { key: 'badge-dollar', label: 'Price badge' },
  { key: 'sack', label: 'Money sack' },
  // Security
  { key: 'shield', label: 'Shield' },
  { key: 'shield-check', label: 'Shield check' },
  { key: 'lock', label: 'Lock' },
  { key: 'unlock', label: 'Unlock' },
  { key: 'key', label: 'Key' },
  { key: 'fingerprint', label: 'Fingerprint' },
  { key: 'scan', label: 'Scan' },
  // People
  { key: 'user', label: 'User' },
  { key: 'users', label: 'Users' },
  { key: 'users-group', label: 'User group' },
  { key: 'user-check', label: 'User check' },
  { key: 'id-card', label: 'ID card' },
  { key: 'avatar-circle', label: 'Avatar' },
  // Devices & infra
  { key: 'laptop', label: 'Laptop' },
  { key: 'monitor', label: 'Monitor' },
  { key: 'mobile-phone', label: 'Phone' },
  { key: 'hard-drive', label: 'Hard drive' },
  { key: 'hard-drives', label: 'Storage' },
  { key: 'cloud', label: 'Cloud' },
  { key: 'wifi', label: 'Wi-Fi' },
  { key: 'printer', label: 'Printer' },
  { key: 'keyboard', label: 'Keyboard' },
  { key: 'microchip', label: 'Chip' },
  { key: 'microchip-ai', label: 'AI chip' },
  { key: 'power', label: 'Power' },
  // Code & dev
  { key: 'bracket-curly', label: 'Code' },
  { key: 'terminal', label: 'Terminal' },
  { key: 'code', label: 'Code block' },
  { key: 'bug', label: 'Bug' },
  { key: 'package', label: 'Package' },
  { key: 'database', label: 'Database' },
  { key: 'browser', label: 'Browser' },
  { key: 'puzzle-01', label: 'Plugin' },
  { key: 'coding-branch', label: 'Branch' },
  { key: 'coding-commit', label: 'Commit' },
  { key: 'coding-pull-request', label: 'Pull request' },
  { key: 'robot', label: 'Bot' },
  { key: 'blockchain', label: 'Blockchain' },
  // General & status
  { key: 'layers', label: 'Layers' },
  { key: 'settings-01', label: 'Settings' },
  { key: 'home', label: 'Home' },
  { key: 'eye', label: 'View' },
  { key: 'link-01', label: 'Link' },
  { key: 'download-01', label: 'Download' },
  { key: 'upload-01', label: 'Upload' },
  { key: 'trash', label: 'Delete' },
  { key: 'share', label: 'Share' },
  { key: 'life-buoy', label: 'Support' },
  { key: 'rocket', label: 'Rocket' },
  { key: 'compass', label: 'Compass' },
  { key: 'star', label: 'Star' },
  { key: 'crown', label: 'Crown' },
  { key: 'gift', label: 'Gift' },
  { key: 'ticket', label: 'Ticket' },
  { key: 'tag', label: 'Tag' },
  { key: 'cart', label: 'Cart' },
  { key: 'thumbs-up', label: 'Thumbs up' },
  { key: 'flag-01', label: 'Flag' },
  { key: 'bookmark', label: 'Bookmark' },
  { key: 'pin', label: 'Pin' },
  { key: 'check-circle', label: 'Check' },
  { key: 'check-square', label: 'Checkbox' },
  { key: 'info-circle', label: 'Info' },
  { key: 'info', label: 'Info alt' },
  { key: 'question-circle', label: 'Help' },
  { key: 'alert-triangle', label: 'Warning' },
  { key: 'hash', label: 'Hashtag' },
  { key: 'pencil', label: 'Edit' },
  { key: 'lightning', label: 'Lightning' },
  { key: 'globe-01', label: 'Globe' },
  { key: 'scale-balanced', label: 'Balance' },
  { key: 'certified-01', label: 'Certified' },
];
