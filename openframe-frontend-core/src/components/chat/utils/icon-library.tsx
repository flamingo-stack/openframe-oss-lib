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

import { Megaphone, Bell, Info, Star, Package as PackageGlyph } from 'lucide-react';
import { createElement, lazy, useEffect, useRef, useSyncExternalStore, type ComponentType, type SVGProps } from 'react';
import { platformAccentVarName } from '../../../utils/platform-identity';
import { ICON_LOADERS, type LoadedIconProps } from '../../icons-v2-generated/icon-loaders';
import { ICON_REGISTRY, getIconComponent, normalizeIconKey } from './icon-registry';

/** Every icon registered here is a component of the generated set's own props (`icons-v2-generated`). */
export type IconComponent = ComponentType<LoadedIconProps>;

/** The size a generated icon draws at when it is given none; its loading box matches it. */
const SET_ICON_DEFAULT_SIZE = 24;

/** The set's icons already asked for, by export name: one component each, so a name always draws the same one. */
const setIcons = new Map<string, IconComponent>();

/** What a generated icon takes: the icon props plus whatever its `<svg>` accepts. */
type SetIconProps = LoadedIconProps &
  Omit<SVGProps<SVGSVGElement>, 'ref' | 'width' | 'height' | 'color' | 'children' | 'dangerouslySetInnerHTML'>;

/** The set's icon modules that have arrived, by export name. */
const loadedSetIcons = new Map<string, ComponentType<SetIconProps>>();
/** The loads on their way, so a name is asked for once. */
const setIconLoads = new Map<string, Promise<void>>();
/** Who redraws when a name's module arrives. */
const setIconListeners = new Map<string, Set<() => void>>();

function loadSetIcon(exportName: string): void {
  if (loadedSetIcons.has(exportName) || setIconLoads.has(exportName)) return;
  setIconLoads.set(
    exportName,
    ICON_LOADERS[exportName]()
      .then(module => {
        loadedSetIcons.set(exportName, module.default as ComponentType<SetIconProps>);
        for (const listener of setIconListeners.get(exportName) ?? []) listener();
      })
      // A failed load is forgotten, so the next icon by that name asks again.
      .catch(() => undefined)
      .finally(() => {
        setIconLoads.delete(exportName);
      }),
  );
}

function subscribeToSetIcon(exportName: string) {
  return (listener: () => void) => {
    const listeners = setIconListeners.get(exportName) ?? new Set();
    listeners.add(listener);
    setIconListeners.set(exportName, listeners);
    return () => {
      listeners.delete(listener);
    };
  };
}

/** Leaves an `<svg>`'s markup as it is: what the server drew stays drawn. */
const KEEP_MARKUP = { __html: '' };

function sameProps(a: SetIconProps, b: SetIconProps): boolean {
  const keys = Object.keys(a) as (keyof SetIconProps)[];
  return keys.length === Object.keys(b).length && keys.every(key => Object.is(a[key], b[key]));
}

/**
 * An icon of the generated set by its EXPORT name (`ChartPieIcon`), or
 * `undefined` when the set has none by that name.
 *
 * The icon's module is loaded on demand, never with the page: the set is
 * ~1,700 icons and a page draws a few dozen (`ICON_LOADERS`, one loader each).
 *
 * It NEVER suspends in the browser. An icon inside a `<Suspense>` whose module
 * is on its way holds back the hydration of everything around it, and React
 * then throws the server's markup away and draws the page again (measured: the
 * home page's heading was drawn a second time seconds after it was first
 * shown). So:
 *   - on the server the icon is drawn in full: a streaming render waits for its
 *     module (no boundary of its own, so the markup is the icon alone and the
 *     browser adopts it as it is). A host that renders with the synchronous
 *     `renderToString` must have drawn the icon once before, or wrap it in its
 *     own `<Suspense>`;
 *   - in the browser, an icon the server drew keeps that `<svg>` as it is and
 *     loads nothing, until its props change;
 *   - an icon first drawn in the browser is an empty `<svg>` of its own size
 *     until its module arrives, so nothing around it moves.
 */
function iconFromSet(exportName: string): IconComponent | undefined {
  const known = setIcons.get(exportName);
  if (known) return known;
  if (!Object.prototype.hasOwnProperty.call(ICON_LOADERS, exportName)) return undefined;
  const ServerDrawn = lazy(ICON_LOADERS[exportName]) as ComponentType<SetIconProps>;
  const subscribe = subscribeToSetIcon(exportName);
  const loaded = () => loadedSetIcons.get(exportName);

  const SetIcon = (props: SetIconProps) => {
    // The module's component when it has arrived (drawn through `createElement`: it is a loaded module, not a component made here).
    const arrived = useSyncExternalStore(subscribe, loaded, loaded);
    const svg = useRef<SVGSVGElement>(null);
    const drawnWith = useRef<SetIconProps | null>(null);
    useEffect(() => {
      if (arrived) return;
      const first = drawnWith.current === null;
      if (first) drawnWith.current = props;
      // The server's `<svg>` has its paths; one made here is empty and needs its module.
      const drawn = svg.current?.hasChildNodes() ?? false;
      if (!drawn || (!first && drawnWith.current !== null && !sameProps(drawnWith.current, props)))
        loadSetIcon(exportName);
    });
    if (typeof window === 'undefined') return <ServerDrawn {...props} />;
    if (arrived) return createElement(arrived, props);
    const { size, color: _color, ...rest } = props;
    return (
      <svg
        {...rest}
        ref={svg}
        width={size ?? SET_ICON_DEFAULT_SIZE}
        height={size ?? SET_ICON_DEFAULT_SIZE}
        suppressHydrationWarning
        dangerouslySetInnerHTML={KEEP_MARKUP}
      />
    );
  };
  SetIcon.displayName = exportName;
  setIcons.set(exportName, SetIcon as IconComponent);
  return SetIcon as IconComponent;
}

/** An icon the generated set is known to hold, by its export name. A name the set lost fails here, when the library loads. */
function setIcon(exportName: string): IconComponent {
  const icon = iconFromSet(exportName);
  if (!icon) throw new Error(`icon-library: the generated icon set has no "${exportName}"`);
  return icon;
}

// The glyphs the aliases below name. Like every icon of the set they are loaded when drawn, never with the page.
const FileIcon = setIcon('FileIcon');
const ClickupLogoGreyIcon = setIcon('ClickupLogoGreyIcon');
const SlackLogoGreyIcon = setIcon('SlackLogoGreyIcon');
const HubspotLogoGreyIcon = setIcon('HubspotLogoGreyIcon');
const GithubIcon = setIcon('GithubIcon');
const Rocket02Icon = setIcon('Rocket02Icon');
const BookIcon = setIcon('BookIcon');
const ChatsIcon = setIcon('ChatsIcon');

// A sister platform's mark is drawn in THAT platform's brand colour (the
// platform brand registry), never in the accent of the page showing it: on
// flamingo.run the OpenMSP mark stays OpenMSP yellow, not flamingo pink.
const brandColor = (platform: string) => `var(${platformAccentVarName(platform)})`;

/** The size a mark registered here draws at when it is given none (a chip, a command row). */
const MARK_DEFAULT_SIZE = 16;

/** The colours a mark of the set is registered with: its `color`, and the other parts of a multi-colour mark. */
interface MarkColors {
  color?: string;
  secondaryColor?: string;
  tertiaryColor?: string;
}

/**
 * A mark of the set registered with colours of its own: the `color` it takes
 * when the caller gives none, and its other parts. `brand` keeps those colours
 * whatever the caller passes: a platform's mark is never tinted by the slot it
 * sits in.
 */
function markWith(exportName: string, colors: MarkColors, options: { brand?: boolean } = {}): IconComponent {
  const mark = setIcon(exportName) as ComponentType<SetIconProps & MarkColors>;
  return function Mark({ size = MARK_DEFAULT_SIZE, className, color }) {
    return createElement(mark, {
      ...colors,
      size,
      className,
      color: (options.brand ? undefined : color) ?? colors.color,
    });
  };
}

// On the dark surfaces every glyph sits on, the OpenMSP bubbles take the theme's
// text and background tokens and the back bubble OpenMSP's brand colour.
const OpenmspLogoIcon = markWith(
  'OpenmspLogoIcon',
  { color: 'var(--color-text-primary)', secondaryColor: 'var(--color-bg)', tertiaryColor: brandColor('openmsp') },
  { brand: true },
);
const FlamingoLogoIcon = markWith('FlamingoMarkIcon', { color: brandColor('flamingo') }, { brand: true });
// The same mark as a GLYPH: it takes the colour of the slot it sits in, like every icon beside it (a source
// chip, a command row, a card), where the brand pink would be the one coloured icon in the list.
const FlamingoLogoGreyIcon = markWith('FlamingoMarkIcon', { color: 'currentColor' });
// Major League GitHub draws its mark in the theme's text colour on its own site
// (its header, hero and footer), never in an accent: so does every glyph of it.
const MlgLogoIcon = markWith('MlgLogoIcon', { color: 'var(--color-text-primary)' });
const TmcgLogoIcon = markWith(
  'MiamiCyberGangLogoFaceOnlyIcon',
  { secondaryColor: brandColor('tmcg'), tertiaryColor: 'var(--color-text-primary)' },
  { brand: true },
);

/**
 * The OpenFrame logo as a GLYPH: both of its parts in one colour, the slot's
 * own unless the icon's props name one, so it tints like every icon beside it.
 */
const OpenframeLogoMark = setIcon('OpenframeLogoIcon') as ComponentType<SetIconProps & MarkColors>;
function LogoOpenframeIcon({ size = MARK_DEFAULT_SIZE, className, color }: LoadedIconProps) {
  const tint = color ?? 'currentColor';
  return createElement(OpenframeLogoMark, { size, className, color: tint, secondaryColor: tint });
}

/**
 * Static registry — backend `iconName` → React component. Brand-grey
 * logos live in `icons-v2-generated/brand-logos/`; the rest are
 * monochrome v2 glyphs that inherit `currentColor` from the card slot
 * (`text-ods-text-secondary`).
 */
export const ICON_ALIASES: Record<string, IconComponent> = {
  // Production `/api/docs/commands` keys (multi-platform-hub contract)
  clickup: ClickupLogoGreyIcon,
  slack: SlackLogoGreyIcon,
  hubspot: HubspotLogoGreyIcon,
  github: GithubIcon,
  openframe: LogoOpenframeIcon,
  newspaper: setIcon('NewspaperIcon'),
  rocket: Rocket02Icon,
  briefcase: setIcon('BriefcaseIcon'),
  'graduation-cap': setIcon('GraduationCapIcon'),
  video: setIcon('VideoRecorderIcon'),
  headphones: setIcon('HeadphoneIcon'),
  calendar: setIcon('CalendarIcon'),
  compass: setIcon('CompassIcon'),

  // Figma-canonical aliases (node 7363:205938) — kept for Storybook
  // fixtures and any older feed entries still using the long names.
  'clickup-logo': ClickupLogoGreyIcon,
  'clickup-logo-grey': ClickupLogoGreyIcon,
  'slack-logo': SlackLogoGreyIcon,
  'slack-logo-grey': SlackLogoGreyIcon,
  'hubspot-logo': HubspotLogoGreyIcon,
  'hubspot-logo-grey': HubspotLogoGreyIcon,
  'github-logo': GithubIcon,
  'logo-openframe': LogoOpenframeIcon,
  'rocket-01': Rocket02Icon,
  'rocket-02': Rocket02Icon,

  // Announcement-bar legacy names — folded in so resolveIcon covers them too
  // (was the separate `renderSvgIcon` map; now ONE resolver everywhere).
  'openframe-logo': LogoOpenframeIcon,
  'openmsp-logo': OpenmspLogoIcon,
  'mlg-logo': MlgLogoIcon,
  'tmcg-logo': TmcgLogoIcon,
  flamingo: FlamingoLogoIcon,
  'flamingo-logo': FlamingoLogoIcon,
  'flamingo-logo-grey': FlamingoLogoGreyIcon,
  // Microsoft 365 is drawn with the Office 365 mark, which the set names by the product's older name.
  'microsoft-365-logo-grey': setIcon('Office365LogoGreyIcon'),
  megaphone: Megaphone,
  bell: Bell,
  info: Info,
  star: Star,
  package: PackageGlyph,

  // Generic v2-native keys — useful fall-throughs for slash commands that
  // don't have a brand-specific glyph in the design.
  search: setIcon('SearchIcon'),
  ticket: setIcon('TicketIcon'),
  book: BookIcon,
  'book-open': BookIcon,
  bug: setIcon('BugIcon'),
  layers: setIcon('LayersIcon'),
  file: FileIcon,
  'file-text': FileIcon,
  chats: ChatsIcon,
  'message-square': ChatsIcon,
  'message-circle': ChatsIcon,
  'bracket-curly': setIcon('BracketCurlyIcon'),
};

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
    if (iconFromSet(name)) return inTextColour(name);
  }
  return undefined;
}

/** The set's icons as a NAME draws them, one component per icon. */
const namedIcons = new Map<string, IconComponent>();

/**
 * An icon found by its name takes the text colour of wherever it sits, like its
 * row-mates: a few icons of the set carry a default colour of their own (the
 * one their artwork was drawn in), which is right where a component places the
 * icon and wrong in a row of named glyphs. A caller's own `color` still wins.
 */
function inTextColour(exportName: string): IconComponent {
  const known = namedIcons.get(exportName);
  if (known) return known;
  const icon = setIcon(exportName);
  const Named: IconComponent = props => createElement(icon, { ...props, color: props.color ?? 'currentColor' });
  namedIcons.set(exportName, Named);
  return Named;
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
    const brand = iconName ? ICON_REGISTRY[normalizeIconKey(iconName)] : undefined;
    if (brand) return brand as IconComponent;
    const design = iconName ? (ICON_ALIASES[iconName] ?? resolveFromLibrary(iconName)) : undefined;
    return design ?? (getIconComponent(iconName) as IconComponent);
  }
  if (!iconName) return FileIcon;
  return ICON_ALIASES[iconName] ?? resolveFromLibrary(iconName) ?? FileIcon;
}

/** The icon a name resolves to, or `null` when the set holds none: for a caller that draws nothing in that case (`resolveIcon` draws a fallback glyph). */
export function findIcon(iconName: string | null | undefined): IconComponent | null {
  if (!iconName) return null;
  return ICON_ALIASES[iconName] ?? resolveFromLibrary(iconName) ?? null;
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
