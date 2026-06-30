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

import type { ComponentType, CSSProperties } from 'react'

import * as IconsV2 from '../../icons-v2-generated'
import { ClickupLogoGreyIcon } from '../../icons-v2-generated/brand-logos/clickup-logo-grey-icon'
import { GithubIcon } from '../../icons-v2-generated/brand-logos/github-icon'
import { HubspotLogoGreyIcon } from '../../icons-v2-generated/brand-logos/hubspot-logo-grey-icon'
import { SlackLogoGreyIcon } from '../../icons-v2-generated/brand-logos/slack-logo-grey-icon'
import { ChatsIcon } from '../../icons-v2-generated/communication/chats-icon'
import { BookIcon } from '../../icons-v2-generated/school/book-icon'
import { GraduationCapIcon } from '../../icons-v2-generated/school/graduation-cap-icon'
import { BracketCurlyIcon } from '../../icons-v2-generated/coding/bracket-curly-icon'
import { BugIcon } from '../../icons-v2-generated/coding/bug-icon'
import { CalendarIcon } from '../../icons-v2-generated/date-and-time/calendar-icon'
import { BriefcaseIcon } from '../../icons-v2-generated/map-and-travel/briefcase-icon'
import { CompassIcon } from '../../icons-v2-generated/map-and-travel/compass-icon'
import { FileIcon } from '../../icons-v2-generated/documents/file-icon'
import { LayersIcon } from '../../icons-v2-generated/design/layers-icon'
import { NewspaperIcon } from '../../icons-v2-generated/documents/newspaper-icon'
import { Rocket02Icon } from '../../icons-v2-generated/vehicles-and-delivery/rocket-02-icon'
import { HeadphoneIcon } from '../../icons-v2-generated/audio-and-visual/headphone-icon'
import { VideoRecorderIcon } from '../../icons-v2-generated/audio-and-visual/video-recorder-icon'
import { SearchIcon } from '../../icons-v2-generated/interface/search-icon'
import { TicketIcon } from '../../icons-v2-generated/shopping/ticket-icon'
import { OpenFrameLogo } from '../../icons/openframe-logo'
import { OpenmspLogo } from '../../icons/openmsp-logo'
import { FlamingoLogo } from '../../icons/flamingo-logo'
import { Megaphone, Bell, Info, Star, Package as PackageGlyph } from 'lucide-react'

/** Shape used by every icon registered here (matches `icons-v2-generated`). */
export type IconComponent = ComponentType<{
  size?: number
  className?: string
  color?: string
}>

/** Wrap a brand logo (className/SVG-sized) so it satisfies the `size`-prop
 *  `IconComponent` contract — drives size via `style` (CSS wins over
 *  the logo's hardcoded width/height), keeping the logo's own brand fill. */
function sizedLogo(
  Logo: ComponentType<{ className?: string; style?: CSSProperties }>,
): IconComponent {
  return function SizedLogo({ size = 16, className }) {
    return <Logo className={className} style={{ width: size, height: size }} />
  }
}
const OpenmspLogoIcon = sizedLogo(OpenmspLogo)
const FlamingoLogoIcon = sizedLogo(FlamingoLogo)

/**
 * `OpenFrameLogo` from `components/icons/` predates the v2 set and:
 *   1. hardcodes `width="32" height="32"` AFTER spreading `{...props}`,
 *      so we can't override via the `width` / `height` props — we drive
 *      size through `style` instead (CSS attribute wins over the HTML
 *      `width` / `height` attributes).
 *   2. defaults `lowerPathColor` to white and `upperPathColor` to
 *      `#1A1A1A` — the dark frame disappears on the chat's `ods-bg`
 *      surface. We pin both paths to `currentColor` so the glyph tints
 *      to whatever the card icon slot is (`ods-text-secondary` ≈ #888).
 */
function LogoOpenframeIcon({
  size = 16,
  className,
}: {
  size?: number
  className?: string
  color?: string
}) {
  return (
    <OpenFrameLogo
      className={className}
      lowerPathColor="currentColor"
      upperPathColor="currentColor"
      style={{ width: size, height: size }}
    />
  )
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
  newspaper: NewspaperIcon,
  rocket: Rocket02Icon,
  briefcase: BriefcaseIcon,
  'graduation-cap': GraduationCapIcon,
  video: VideoRecorderIcon,
  headphones: HeadphoneIcon,
  calendar: CalendarIcon,
  compass: CompassIcon,

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
  flamingo: FlamingoLogoIcon,
  'flamingo-logo': FlamingoLogoIcon,
  megaphone: Megaphone,
  bell: Bell,
  info: Info,
  star: Star,
  package: PackageGlyph,

  // Generic v2-native keys — useful fall-throughs for slash commands that
  // don't have a brand-specific glyph in the design.
  search: SearchIcon,
  ticket: TicketIcon,
  book: BookIcon,
  'book-open': BookIcon,
  bug: BugIcon,
  layers: LayersIcon,
  file: FileIcon,
  'file-text': FileIcon,
  chats: ChatsIcon,
  'message-square': ChatsIcon,
  'message-circle': ChatsIcon,
  'bracket-curly': BracketCurlyIcon,
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
 * actually exists in the namespace (the namespace is the source of
 * truth, so we never guess wrong).
 */
function resolveFromLibrary(
  iconName: string,
): IconComponent | undefined {
  const tokens = iconName.trim().toLowerCase().replace(/_/g, '-').split('-')
  if (tokens.some((t) => t.length === 0)) return undefined
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
  const candidates = [
    `${tokens.map(cap).join('')}Icon`,
    `${tokens.map((t) => (t === 'ai' ? 'AI' : cap(t))).join('')}Icon`,
  ]
  const registry = IconsV2 as unknown as Record<string, IconComponent | undefined>
  for (const name of candidates) {
    const Icon = registry[name]
    if (Icon) return Icon
  }
  return undefined
}

/**
 * Look up the icon component for a backend `iconName`. Resolution order:
 *   1. Curated `ICON_ALIASES` alias — wins so brand-grey logos, the
 *      tinted OpenFrame logo, and plural/semantic aliases keep their
 *      intended glyph instead of the literal-name match.
 *   2. Generic `icons-v2-generated` lookup by naming convention — covers
 *      every other icon in the library.
 *   3. `FileIcon` for unknown / missing keys so the card always renders.
 */
export function resolveIcon(
  iconName: string | null | undefined,
): IconComponent {
  if (!iconName) return FileIcon
  return ICON_ALIASES[iconName] ?? resolveFromLibrary(iconName) ?? FileIcon
}

/** One selectable icon in the admin slash-command picker. */
export interface IconOption {
  /** Stored `icon_name` value — a kebab-case `icons-v2-generated` key (or a
   *  curated alias) that `resolveIcon` displays in the chat. */
  key: string
  /** Human-friendly label shown in the picker dropdown. */
  label: string
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
]
