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
 * Unknown / null keys fall back to `FileIcon` so a misconfigured
 * row still renders.
 */

import type { ComponentType } from 'react'

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

/** Shape used by every icon registered here (matches `icons-v2-generated`). */
export type OnboardingIconComponent = ComponentType<{
  size?: number
  className?: string
  color?: string
}>

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
export const ONBOARDING_ICONS: Record<string, OnboardingIconComponent> = {
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
 * Look up the icon component for a backend `iconName`. Returns
 * `FileIcon` for unknown / missing keys so the card always renders.
 */
export function resolveOnboardingIcon(
  iconName: string | null | undefined,
): OnboardingIconComponent {
  if (!iconName) return FileIcon
  return ONBOARDING_ICONS[iconName] ?? FileIcon
}
