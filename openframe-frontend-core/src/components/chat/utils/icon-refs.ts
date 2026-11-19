/**
 * How an icon NAME (a database `icon_name`) becomes the icon it draws, as DATA: the names that do not follow the
 * generated set's naming convention (`ICON_ALIASES`), and the convention itself (`iconRefOfName`). Nothing here
 * imports React or an icon, so a server reads the same rules the chat draws by (`utils/named-icon` renders one as an
 * image; `resolveIcon` / `findIcon` draw one in the browser). Change a name's icon here, never in a copy.
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

/** The icon a name draws, as data: its alias, else the generated set's icon by the naming convention (`chart-pie` →
 *  `ChartPieIcon`), else `null`. The set's names are the source of truth, so a name is never guessed. */
export function iconRefOfName(iconName: string | null | undefined): IconRef | null {
  if (!iconName) return null;
  if (Object.prototype.hasOwnProperty.call(ICON_ALIASES, iconName)) return ICON_ALIASES[iconName] ?? null;
  return conventionIconRef(iconName);
}

/**
 * The icon a name DRAWS (the design variant every chip, row and image uses): `iconRefOfName`, else lucide's icon by
 * that name (`git-pull-request`), else `null` (the browser then draws the file glyph that says "no such icon"). ONE
 * chain: `resolveIcon` draws it in the browser and `loadNamedIcon` on a server, so an icon image is never missing for
 * a name the chat draws.
 */
export function drawnIconRefOfName(iconName: string | null | undefined): IconRef | null {
  const ref = iconRefOfName(iconName);
  if (ref || !iconName) return ref;
  const lucide = iconName.trim().toLowerCase();
  return LUCIDE_ICON_NAMES.has(lucide) ? { lucide } : null;
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
export function conventionIconRef(iconName: string): IconRef | null {
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
