/**
 * The design variant DRAWN, as components: `resolveIcon` (every chip, row and picker, through `EntityIcon`),
 * `findIcon` and `brandLogoForName`, plus the admin picker's curated list (`ICON_OPTIONS`). What a name draws is
 * decided in `icon-refs` (`iconRefFor`); nothing here decides it.
 */

import { iconOf, lucideIcon, setIcon, type IconComponent } from './icon-loading';
import { brandLogoRefForName, iconRefFor } from './icon-refs';

/** A company's or product's logo by name as a component, or `null` (the rule: `brandLogoRefForName`). */
export function brandLogoForName(name: string | null | undefined): IconComponent | null {
  const ref = brandLogoRefForName(name);
  return ref ? iconOf(ref) : null;
}

/**
 * A name's icon as a component, of the design set (default) or the brand set: exactly what `iconRefFor` answers.
 * A name no set holds draws a fallback glyph (design: the file icon; brand: `file-text`), so a chip is never empty.
 */
export function resolveIcon(
  iconName: string | null | undefined,
  opts?: { variant?: 'design' | 'brand' },
): IconComponent {
  const variant = opts?.variant ?? 'design';
  const ref = iconRefFor(iconName, { variant });
  const icon = ref ? iconOf(ref) : null;
  if (icon) return icon;
  return variant === 'brand' ? (lucideIcon('file-text') as IconComponent) : setIcon('FileIcon');
}

/** A name's icon of the design set, or `null` when it has none: for a caller that draws nothing then. */
export function findIcon(iconName: string | null | undefined): IconComponent | null {
  const ref = iconRefFor(iconName, { lucide: false });
  return ref ? iconOf(ref) : null;
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
