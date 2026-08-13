'use client'

/**
 * Lib-side entity-card dispatch — single switch over canonical chat cards.
 *
 * Lib-portable refactor of the hub's `components/shared/entity-card-dispatch.tsx`.
 * Drops the hub-only imports:
 *   - `useNavLink`              → click routing flows through `<NavLinkAnchorViaRuntime>`
 *                                 (reads `useRequiredChatRuntime` internally) or
 *                                 the chat-runtime's `handleChatNavClick` helper.
 *   - `currentPlatform`         → runtime.source supplies the identifier.
 *   - `buildContentURL`         → URLs arrive pre-composed by the server's
 *                                 RAG mapper (`ref.url`); the card just renders.
 *   - `tableIdForDocumentType`  → only relevant for the hub-side ContentRef
 *                                 reverse-projection — not needed for chat
 *                                 inline cards.
 *   - hub `program-configs`     → host provides via `ChatCardRenderOptions.extras`.
 *   - `buildProductReleaseCardProps` → ditto, host provides via `extras`.
 *
 * Adding a new chat-inline card type:
 *   1. Implement the `size='sm'` branch + skeleton in `./<card>.tsx` (pure
 *      presentation, accepts `href` + `targetPlatform`).
 *   2. Add one entry to `CHAT_CARD_REGISTRY` below.
 *
 * Public entry points consumed by the chat shell:
 *   - `renderChatInlineEntityCard(ref, opts)` — top-level marker dispatch
 *     (block-card hoist for video refs, otherwise compact card).
 *   - `<ChatCardLoader />` — fetch + skeleton + render the compact card for
 *     fetch-mode entries.
 */

import React, { type ReactNode } from 'react'
import { useRequiredChatRuntime } from '../../../contexts/chat-runtime-context'
import { useRouter } from '../../../embed-shims/next-navigation'
import type { ChatRef } from '../chat-ref.types'
import { useChatCardItem } from '../hooks/use-chat-card-item'
import { handleChatNavClick } from '../utils/nav-click-handler'
import { resolveSourceRowCTA, resolveSourceIcon, sourceRowCtxFromRuntime } from '../utils/source-row-cta'
import { resolveFetchedCardHref, readFetchedCardTitle } from '../utils/resolve-fetched-card-href'
import { resolveHrefForRuntime } from '../utils/chat-nav-resolution'
import {
  computeIsNewTab,
  buildAnchorProps,
} from '../utils/nav-anchor-props'
import { safeHref } from '../utils/compact-card-classes'
import { faqItemAnchor } from '../../../utils/faq-anchor'
import { useChatPanel } from '../chat-panel-context'
import { getSourceLabel } from '../utils/source-icons'
import { SourceActionButton } from '../source-action-button'
import { NavLinkAnchorViaRuntime } from '../nav-link-anchor-via-runtime'
import { defaultBuildProductReleaseCardProps } from './product-release-card-defaults'
import { ChatVideoEntityCard } from './chat-video-entity-card'
import { DeletedDataCard } from './deleted-data-card'
import { BlockCard } from './block-card'
import { BlogCardSkeleton } from './blog-card'
import { CaseStudyCardSkeleton } from './case-study-card'
import { CustomerInterviewCardSkeleton } from './customer-interview-card'
import {
  ProductReleaseCardSkeleton,
  type ProductReleaseCardProps,
} from './product-release-card'
import { ProgramCardSkeleton } from './program-card'
import { InvestorUpdateCardSkeleton } from './investor-update-card'
import { OnboardingGuideCardSkeleton } from './onboarding-guide-card'
import { CampaignCardAdminSkeleton } from './campaign-card-admin'
import { RoadmapCardSkeleton } from './roadmap-card'
import { TaskTypeIcon } from './task-type-icon'
import {
  parseGithubTitle,
  formatActivityId,
  kindLabel as githubKindLabel,
  reviewStateLabel,
} from './github-activity-card'
import {
  MingoInfoCard,
  MingoInfoCardSkeleton,
  type MingoInfoCardStatus,
} from '../mingo-info-card'
import type { ActionsMenuGroup } from '../../ui/actions-menu'
import { MingoIcon } from '../../icons'
import { EyeIcon } from '../../icons-v2-generated/interface/eye-icon'
import { AlertTriangleIcon } from '../../icons-v2-generated/interface/alert-triangle-icon'
import { ArrowRightUpIcon } from '../../icons-v2-generated/arrows/arrow-right-up-icon'
import { TagIcon } from '../../icons-v2-generated/shopping/tag-icon'
import { QuestionCircleIcon } from '../../icons-v2-generated/signs-and-symbols/question-circle-icon'
import { SlackLogoGreyIcon } from '../../icons-v2-generated/brand-logos/slack-logo-grey-icon'
import { ClickupLogoIcon } from '../../icons-v2-generated/brand-logos/clickup-logo-icon'
import { clickupTaskUrl } from '../utils/external-app-urls'
import { FileContentIcon } from '../../icons-v2-generated/documents/file-content-icon'
import { ChartBar01VerIcon } from '../../icons-v2-generated/charts/chart-bar-01-ver-icon'
import { ChartPieIcon } from '../../icons-v2-generated/charts/chart-pie-icon'
import { MoneyBillDollarIcon } from '../../icons-v2-generated/finance/money-bill-dollar-icon'
import { BankIcon } from '../../icons-v2-generated/finance/bank-icon'
import { CoinsExchangeCurrencyIcon } from '../../icons-v2-generated/finance/coins-exchange-currency-icon'
import { NewspaperIcon } from '../../icons-v2-generated/documents/newspaper-icon'
import { TrophyIcon } from '../../icons-v2-generated/sport/trophy-icon'
import { MicrophoneIcon } from '../../icons-v2-generated/household/microphone-icon'
import { Rocket02Icon } from '../../icons-v2-generated/vehicles-and-delivery/rocket-02-icon'
import { TruckFastIcon } from '../../icons-v2-generated/vehicles-and-delivery/truck-fast-icon'
import { PresentationBarIcon } from '../../icons-v2-generated/charts/presentation-bar-icon'
import { PresentationLineIcon } from '../../icons-v2-generated/charts/presentation-line-icon'
import { CalendarIcon } from '../../icons-v2-generated/date-and-time/calendar-icon'
import { CompassIcon } from '../../icons-v2-generated/map-and-travel/compass-icon'
import { MapIcon } from '../../icons-v2-generated/map-and-travel/map-icon'
import { CheckSquareIcon } from '../../icons-v2-generated/signs-and-symbols/check-square-icon'
import { Megaphone01Icon } from '../../icons-v2-generated/shopping/megaphone-01-icon'
import { getStatusColorScheme } from '../utils/agent-status-message'
import { formatDateShort } from '../../../utils/date-formatters'
import { formatInvestorUpdatePeriod } from '../types/entities/investor-update'
import { CodingCommitIcon } from '../../icons-v2-generated/coding/coding-commit-icon'
import { CodingPullRequestIcon } from '../../icons-v2-generated/coding/coding-pull-request-icon'
import { CodeIcon } from '../../icons-v2-generated/coding/code-icon'
import {
  formatDateUTC as formatDate,
  formatDurationCompact,
  formatTimeWithTimezone,
  formatDurationFromRange,
} from '../../../utils/format'
import type { PrReviewState } from '../types/entities/github-activity'
import type { GitHubActivityKind } from '../types/entities/github-activity'
import type { ProgramConfig } from '../types/entities/program-types'

// =============================================================================
// Public option / extras shape
// =============================================================================

/** Optional host-side extras threaded through to render functions whose
 *  derived props can't be computed in lib alone (program configs and the
 *  product-release prop builder live in hub land). When omitted, the
 *  affected card types render `null` from the dispatch — the chat shell's
 *  fallback path takes over. */
export interface ChatCardDispatchExtras {
  /** Per-program-type config map. Keyed by chat documentType
   *  (`podcast` / `webinar` / `event`). Each entry is the canonical
   *  `<ProgramConfig>` the `<ProgramCard>` expects. */
  programConfigs?: {
    podcast?: ProgramConfig<any>
    webinar?: ProgramConfig<any>
    event?: ProgramConfig<any>
  }
  /** Derive the `<ProductReleaseCard>` prop bundle from a hydrated
   *  release row. Hub callers wire `buildProductReleaseCardProps` from
   *  `lib/utils/product-release-card-props.ts`. */
  buildProductReleaseCardProps?: (
    release: any,
  ) => Omit<ProductReleaseCardProps, 'size' | 'title' | 'summary' | 'version' | 'anchorProps'>
  /** Build a branded OG placeholder URL from an entity title. Compact chat-
   *  inline cards (`size='sm'` for blog/case-study/customer-interview/
   *  investor-update/onboarding-guide) pass the result as `placeholderUrl`
   *  so the card's image slot renders the OG fallback instead of an empty
   *  span when the entity has no `featured_image`. Hub callers wire
   *  `buildOgPlaceholderUrl` from `lib/utils/entity-image.ts`. Optional —
   *  when omitted, the compact cards keep the existing empty-slot
   *  behavior. */
  buildOgPlaceholderUrl?: (title: string) => string | null
}

/** Per-card render options threaded through from the chat shell. */
export interface ChatCardRenderOptions {
  baseRoute?: string
  chipBasePlatform?: string
  /** Host-supplied builders for cards whose derived props live in hub
   *  land (programs + product_release). When omitted, these card types
   *  render `null` and the shell falls back to title text. */
  extras?: ChatCardDispatchExtras
  /** Pre-computed new-tab decision for the inner anchor's `target`
   *  attribute. Required — always computed by `ChatCardLoader` via the
   *  same rule source chips use, so the rendered `<a target>` matches
   *  whatever `ChatCardNavWrap` + `handleChatNavClick` decide at click
   *  time. */
  isNewTab: boolean
  /** Host-provided "Ask Mingo"/"Display" affordance for this card, resolved
   *  once by `ChatCardLoader`. Each wrapper threads it into its "⋯" menu via
   *  `cardMenuGroups`. Undefined when the host supplied no `onDiscuss`/
   *  `onDisplay` (then the menu shows only "Open in new tab"). */
  discuss?: CardDiscussAction
}

// =============================================================================
// Per-type "no-fetch" wrapper components (ChatRef carries everything).
// Each wrapper receives `isNewTab` as a prop — `ChatCardLoader` computes
// it ONCE via `computeIsNewTab` against the resolved `chatRef.url` and
// threads it through `renderOpts`. Wrappers must NOT call
// `computeIsNewTab` themselves; the parent's decision is the single
// source of truth for the rendered `<a target>` AND `ChatCardNavWrap`'s
// close-on-nav gate.
// =============================================================================

/** Leading glyph per GitHub activity kind. */
function githubKindIcon(kind: GitHubActivityKind) {
  switch (kind) {
    case 'pull_request':
      return <CodingPullRequestIcon size={24} />
    case 'pr_review':
      return <CodeIcon size={24} />
    case 'commit':
    default:
      return <CodingCommitIcon size={24} />
  }
}

/** PR review state → status-pill colour. */
function reviewStateToVariant(state: PrReviewState): MingoInfoCardStatus['variant'] {
  switch (state) {
    case 'APPROVED':
      return 'success'
    case 'CHANGES_REQUESTED':
      return 'error'
    case 'PENDING':
      return 'warning'
    case 'COMMENTED':
    case 'DISMISSED':
    default:
      return 'grey'
  }
}

function GitHubChatCard({
  chatRef,
  kind,
  isNewTab,
  discuss,
}: {
  chatRef: ChatRef
  kind: GitHubActivityKind
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  // Reuse the card's own title parser so the display title + review state
  // read identically here and in the (legacy) GitHubActivityCard.
  const { display, reviewState } = parseGithubTitle(chatRef.title, kind)
  const title =
    kind === 'pr_review'
      ? display.replace(/^by\s+/i, '').trim() || 'Reviewer'
      : display

  // Review state pill for reviews; otherwise the neutral activity-type pill.
  const status: MingoInfoCardStatus =
    kind === 'pr_review' && reviewState
      ? { label: reviewStateLabel(reviewState), variant: reviewStateToVariant(reviewState) }
      : { label: githubKindLabel(kind), variant: 'grey' }

  // Description: "<id> · <date>" (short SHA / #num, then updated date).
  const idLabel = formatActivityId(chatRef.id, kind)
  const dateText = formatDate(chatRef.date ?? null, { fallback: '', timezone: 'local' })
  const description = [idLabel, dateText].filter(Boolean).join(' · ') || undefined

  return (
    <MingoInfoCard
      title={title}
      description={description}
      icon={githubKindIcon(kind)}
      status={status}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
      menuGroups={cardMenuGroups(chatRef.url, discuss)}
      menuAriaLabel="Activity actions"
    />
  )
}

/** The host-provided "Ask Mingo" / "Display" affordance, resolved once per
 *  card in `ChatCardLoader` and threaded through `renderOpts.discuss`. Mirrors
 *  the legacy `ChatCardWithDiscuss` source-row button, relocated into the "⋯"
 *  menu. */
export interface CardDiscussAction {
  label: string
  icon: React.ReactNode
  run: () => void
}

/** External-app deep-link row for a card's "⋯" menu (e.g. "Open in ClickUp").
 *  Always opens in a new tab — the destination is a third-party app, never a
 *  hub route. */
export interface CardExternalLink {
  label: string
  icon: React.ReactNode
  href: string
}

/** Overflow-menu groups for a card (Figma `7740:55075`): the optional "Ask
 *  Mingo"/"Display" item (when the host supplied a handler) followed by "Open
 *  Details" — whose main row navigates to the card (same tab) and whose trailing
 *  ↗ side-button opens it in a new tab — then the optional external-app
 *  deep-link row (new tab). Returns `undefined` when none applies so the "⋯"
 *  button is omitted entirely. The href is already absolute (ChatCardLoader
 *  pre-resolves it). */
function cardMenuGroups(
  href: string | null | undefined,
  discuss?: CardDiscussAction,
  /** Per-entity override for the "Open Details" row — e.g. HubSpot tickets use
   *  `{ label: 'Open Ticket Details', icon: <HubSpot logo> }` so the row reads
   *  in the entity's own terms and mirrors the card's leading icon. Defaults to
   *  a generic "Open Details" + eye glyph. */
  openDetails?: { label: string; icon: React.ReactNode },
  /** Optional trailing deep-link into the entity's own third-party app
   *  (ClickUp task, …). Rendered after "Open Details", always new-tab. */
  externalLink?: CardExternalLink,
) {
  const items: ActionsMenuGroup['items'] = []
  if (discuss) {
    items.push({
      id: 'discuss',
      label: discuss.label,
      icon: discuss.icon,
      onClick: discuss.run,
    })
  }
  if (href) {
    items.push({
      id: 'open-details',
      label: openDetails?.label ?? 'Open Details',
      icon: openDetails?.icon ?? <EyeIcon size={20} />,
      // Main row → open the entity (same tab, soft Link nav).
      href,
      // Trailing 40px ↗ side-button → open in a new tab.
      iconAction: {
        icon: <ArrowRightUpIcon size={20} />,
        'aria-label': 'Open in new tab',
        href,
        openInNewTab: true,
      },
    })
  }
  if (externalLink) {
    items.push({
      id: 'open-external',
      label: externalLink.label,
      icon: externalLink.icon,
      href: externalLink.href,
      openInNewTab: true,
    })
  }
  return items.length ? [{ items }] : undefined
}

/** Title-case a status/priority token ("WAITING_ON_US" → "Waiting on us"). */
function formatStatusToken(token: string | undefined): string | undefined {
  if (!token) return undefined
  const lower = token.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

/** HubSpot ticket status → `MingoInfoCard` status pill (Closed→green,
 *  Open→amber, anything else→neutral grey). */
function hubspotStatusToVariant(
  status: string | undefined,
): MingoInfoCardStatus['variant'] {
  const s = (status || '').toUpperCase()
  if (s === 'CLOSED') return 'success'
  if (s === 'OPEN') return 'warning'
  return 'grey'
}

/**
 * Decode a SELF-DESCRIBING `[card://video:<id>]` marker id into playable
 * video metadata — the paired decoder for the hub's
 * `DERIVE_HANDLES_BY_KIND` id minting (keep in lockstep). Embedded
 * videos have no backing table row, so the marker id IS the payload;
 * this is what makes video cards transport-independent (no fetch, no
 * server-shipped metadata).
 *   - bare 11-char id → YouTube (lite-youtube facade takes the bare id)
 *   - `mux-<playbackId>` → `https://stream.mux.com/<playbackId>.m3u8`
 *   - `mp4-<base64url(url)>` → decoded https URL
 * Legacy pre-2026-08 sha1-hash ids (`<kind>-<10 hex>`) and anything
 * undecodable return null — the caller falls through to the loader,
 * which renders the marker as plain text (same anti-hallucination
 * posture as every other card type).
 */
function decodeVideoMarkerId(id: string): { videoUrl?: string; youtubeUrl?: string } | null {
  // Prefix checks FIRST: an id like `mux-1234567` (11 chars) would also
  // satisfy the bare-YouTube-id pattern below.
  const mux = id.match(/^mux-([A-Za-z0-9_-]+)$/)
  if (mux) {
    // Legacy sha1 ids are exactly 10 lowercase hex — not playback ids.
    if (/^[0-9a-f]{10}$/.test(mux[1])) return null
    return { videoUrl: `https://stream.mux.com/${mux[1]}.m3u8` }
  }
  const mp4 = id.match(/^mp4-([A-Za-z0-9_-]+)$/)
  if (mp4) {
    if (/^[0-9a-f]{10}$/.test(mp4[1])) return null
    try {
      const b64 = mp4[1].replace(/-/g, '+').replace(/_/g, '/')
      const url = atob(b64)
      // https-only — the id is model-emitted text; never let a marker
      // smuggle a non-https src into a player.
      if (!/^https:\/\//.test(url)) return null
      return { videoUrl: url }
    } catch {
      return null
    }
  }
  if (/^[A-Za-z0-9_-]{11}$/.test(id)) return { youtubeUrl: id }
  return null
}

/** Read hero-video metadata off a FETCHED item — the API-driven
 *  replacement for the retired refs-frame `metadata.videoUrl` check. Two item
 *  shapes: ChatRef-shaped items (per-object hydration routes) carry the
 *  SSOT `metadata` keys directly; content rows (public list APIs) carry
 *  the canonical columns (`custom_video_url` for recordings,
 *  `main_video_url` elsewhere — see the hub configs' videoUrlColumns).
 *  Returns null when the item carries no video (compact card only). */
function itemVideoMetadata(item: any): Record<string, string> | null {
  const pick = (...vals: unknown[]): string | undefined => {
    for (const v of vals) if (typeof v === 'string' && v.length > 0) return v
    return undefined
  }
  const m = (item?.metadata ?? {}) as Record<string, unknown>
  const out: Record<string, string> = {}
  const videoUrl = pick(m.videoUrl, item?.custom_video_url, item?.main_video_url)
  // `testimonial_video_url` is the case-study mapper's youtube column.
  const youtubeUrl = pick(m.youtubeUrl, item?.youtube_url, item?.testimonial_video_url)
  const highlightVideoUrl = pick(m.highlightVideoUrl, item?.highlight_video_url)
  // `featured_image` is the customer-interview mapper's poster column.
  const videoPoster = pick(
    m.videoPoster,
    item?.main_video_thumbnail,
    item?.highlight_video_thumbnail,
    item?.featured_image,
  )
  if (videoUrl) out.videoUrl = videoUrl
  if (youtubeUrl) out.youtubeUrl = youtubeUrl
  if (highlightVideoUrl) out.highlightVideoUrl = highlightVideoUrl
  if (videoPoster) out.videoPoster = videoPoster
  return out.videoUrl || out.youtubeUrl || out.highlightVideoUrl ? out : null
}

/** LOUD hydration-failure card — a card that fails to load renders a
 *  VISIBLE error state instead of silently disappearing (explicit
 *  product decision 2026-08-13: broken must look broken, both for
 *  transient fetch failures and for ids the API doesn't recognize). */
function CardLoadFailure({
  label,
  id,
  detail,
}: {
  label: string
  id: string
  detail: string
}) {
  return (
    <MingoInfoCard
      title={label}
      description={`${detail} · id: ${id}`}
      icon={<AlertTriangleIcon size={24} />}
      status={{ label: 'FAILED', variant: 'error' }}
      menuAriaLabel="Card failed to load"
    />
  )
}

/** Build the display ref for a hydrated card PURELY from the fetched API
 *  item — the item IS a ChatRef (minted server-side by the per-object
 *  ref-building SSOTs), so the API is the single display-data
 *  layer. The marker's ref contributes ONLY the loader-resolved
 *  `url`/`targetPlatform` (embed-origin prefixing of the item's own url
 *  via `fallbackHref`) — never titles/previews/metadata. */
function fetchedItemDisplayRef(item: unknown, chatRef: ChatRef): ChatRef {
  const it = item as ChatRef
  return {
    ...it,
    url: chatRef.url ?? it.url ?? null,
    targetPlatform: chatRef.targetPlatform ?? it.targetPlatform ?? null,
  }
}

/** FAQ variant — `/api/faqs?ids=` returns faq-shaped rows
 *  (`question`/`answer`/`section`), not ChatRefs. Same single-layer rule:
 *  display data comes from the API row only. */
function fetchedFaqDisplayRef(item: unknown, chatRef: ChatRef): ChatRef {
  const it = item as { question?: unknown; answer?: unknown; section?: unknown }
  const answer =
    typeof it?.answer === 'string' && it.answer.trim().length > 0 ? it.answer.trim() : null
  return {
    type: 'faq',
    id: chatRef.id,
    sourceRepo: chatRef.sourceRepo,
    title: typeof it?.question === 'string' && it.question ? it.question : chatRef.id,
    url: chatRef.url ?? null,
    ...(answer
      ? { preview: answer.length > 400 ? `${answer.slice(0, 397)}…` : answer }
      : {}),
    metadata:
      typeof it?.section === 'string' && it.section ? { section: it.section } : {},
  }
}

function HubspotTicketChatCard({
  chatRef,
  isNewTab,
  discuss,
}: {
  chatRef: ChatRef
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  const status =
    typeof chatRef.metadata?.status === 'string' ? (chatRef.metadata.status as string) : undefined
  const statusLabel =
    typeof chatRef.metadata?.statusLabel === 'string'
      ? (chatRef.metadata.statusLabel as string)
      : undefined
  const statusText = statusLabel ?? formatStatusToken(status)
  return (
    <MingoInfoCard
      title={chatRef.title}
      description={chatRef.preview ?? undefined}
      icon={<TagIcon size={24} />}
      status={
        statusText
          ? { label: statusText, variant: hubspotStatusToVariant(status) }
          : undefined
      }
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
      menuGroups={cardMenuGroups(chatRef.url, discuss, {
        label: 'Open Ticket Details',
        icon: <TagIcon size={20} />,
      })}
      menuAriaLabel="Ticket actions"
    />
  )
}

/** FAQ Q&A — title=question, body=answer preview, optional section pill.
 *  No-fetch card: every field the renderer needs already lives on the
 *  ChatRef (hub's `FAQ_MAPPER.toRetrievedDoc` populates `title` /
 *  `preview` / `url` / `targetPlatform`, and the section name is threaded
 *  through `metadata.section` for the badge). The card itself stays pure
 *  presentation — same shape as `SlackChatCard` / `HubspotTicketChatCard`. */
function FaqChatCard({
  chatRef,
  isNewTab,
  discuss,
}: {
  chatRef: ChatRef
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  const section =
    typeof chatRef.metadata?.section === 'string'
      ? (chatRef.metadata.section as string).trim()
      : undefined
  const statusLabel = section && section.length > 0 ? section : 'FAQ'
  return (
    <MingoInfoCard
      title={chatRef.title}
      description={chatRef.preview ?? undefined}
      icon={<QuestionCircleIcon size={24} />}
      status={{ label: statusLabel, variant: 'grey' }}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
      menuGroups={cardMenuGroups(chatRef.url, discuss)}
      menuAriaLabel="FAQ actions"
    />
  )
}

function SlackChatCard({
  chatRef,
  isNewTab,
  discuss,
}: {
  chatRef: ChatRef
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  const channelName =
    typeof chatRef.metadata?.channelName === 'string'
      ? (chatRef.metadata.channelName as string).trim()
      : undefined
  // Prefix the channel (with a leading "#") onto the author title, e.g.
  // "Pavlo Shylo · #general".
  const channelPretty = channelName
    ? channelName.startsWith('#')
      ? channelName
      : `#${channelName}`
    : undefined
  const title = channelPretty ? `${chatRef.title} · ${channelPretty}` : chatRef.title
  return (
    <MingoInfoCard
      title={title}
      description={chatRef.preview ?? undefined}
      icon={<SlackLogoGreyIcon size={24} />}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
      menuGroups={cardMenuGroups(chatRef.url, discuss)}
      menuAriaLabel="Message actions"
    />
  )
}

function DataRoomDocChatCard({
  chatRef,
  isNewTab,
  discuss,
}: {
  chatRef: ChatRef
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  // Provenance label. NEVER fall back to "Data room" — that would
  // falsely label non-data-room content (openframe-docs, etc.) as
  // private investor material when `sourceRepo` is missing or
  // unrecognized. Generic "Document" is intentionally neutral so users
  // can't be misled about sensitivity / scope.
  const badgeText = chatRef.sourceRepo ? getSourceLabel(chatRef.sourceRepo) : 'Document'
  return (
    <MingoInfoCard
      title={chatRef.title}
      description={chatRef.preview ?? undefined}
      icon={<FileContentIcon size={24} />}
      status={{ label: badgeText, variant: 'grey' }}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
      menuGroups={cardMenuGroups(chatRef.url, discuss)}
      menuAriaLabel="Document actions"
    />
  )
}

function GenericFinancialChatCard({
  chatRef,
  icon,
  isNewTab,
  discuss,
}: {
  chatRef: ChatRef
  icon: React.ReactNode
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  const subtitle =
    typeof chatRef.metadata?.subtitle === 'string'
      ? (chatRef.metadata.subtitle as string)
      : undefined
  return (
    <MingoInfoCard
      title={chatRef.title}
      description={subtitle}
      icon={icon}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
      menuGroups={cardMenuGroups(chatRef.url, discuss)}
      menuAriaLabel="Document actions"
    />
  )
}

function ChatInlineVideoPill({ chatRef }: { chatRef: ChatRef }) {
  const title = chatRef.title || 'Video'
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs align-middle bg-ods-card border border-ods-border text-ods-text-primary">
      <span aria-hidden="true" className="text-ods-text-secondary">▶</span>
      <span className="truncate max-w-[220px]">{title}</span>
    </span>
  )
}

/** Wrap a chat-inline card with the "Ask"/"Display" affordance + source
 *  tracking strip. Mirrors the hub's `ChatCardWithDiscuss` layout exactly
 *  — the visual contract here drove the lib refactor in the first place. */
function ChatCardWithDiscuss({
  chatRef,
  onDiscuss,
  onDisplay,
  displayAction,
  children,
}: {
  chatRef: ChatRef
  onDiscuss?: (ref: ChatRef) => void
  onDisplay?: (ref: ChatRef) => void
  displayAction?: boolean
  children: React.ReactNode
}) {
  const { Icon: SourceIcon, label: sourceLabel } = resolveSourceIcon({
    sourceRepo: chatRef.sourceRepo,
    documentType: chatRef.type,
  })
  const idDisplay =
    chatRef.id && (chatRef.id.length > 24 ? `${chatRef.id.slice(0, 24)}…` : chatRef.id)
  const useDisplay = displayAction && !!onDisplay
  const cardBody = <span className="block [&>*]:!my-0">{children}</span>
  return (
    <span className="mt-1.5 mb-2 block w-full">
      {cardBody}
      <span className="mt-1 flex items-center justify-between gap-2 pl-0.5">
        <SourceActionButton
          chatRef={chatRef}
          onDiscuss={useDisplay ? onDisplay : onDiscuss}
          label={useDisplay ? 'Display' : undefined}
          density="card"
        />
        {!onDiscuss && !useDisplay ? <span /> : null}
        {idDisplay ? (
          <span
            className="inline-flex items-center gap-1 text-code shrink-0 text-ods-text-secondary opacity-60 hover:opacity-100 hover:text-ods-text-primary transition-opacity"
            title={`${sourceLabel} · ${chatRef.id}`}
          >
            <SourceIcon className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[180px]">{idDisplay}</span>
          </span>
        ) : null}
      </span>
    </span>
  )
}

// =============================================================================
// Per-type fetch-mode card body — composed by ChatCardLoader once item is in.
// =============================================================================

/** Anchor-wrapped product-release card. */
function ProductReleaseChatCard({
  item,
  chatRef,
  buildProps,
  isNewTab,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  buildProps: NonNullable<ChatCardDispatchExtras['buildProductReleaseCardProps']>
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  const releaseProps = buildProps(item)
  const status: MingoInfoCardStatus = item?.version
    ? { label: String(item.version), variant: 'grey' }
    : { label: 'Release', variant: 'grey' }
  return (
    <EntityMingoCard
      title={item?.title ?? ''}
      description={item?.summary || releaseProps.formattedDate || undefined}
      cover={releaseProps.coverImage || undefined}
      fallbackIcon={<Rocket02Icon size={24} />}
      status={status}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Release actions"
    />
  )
}

/** Anchor-wrapped marketing-campaign card. Campaigns have no public
 *  viewer; the registry entry's `fallbackHref` synthesizes the admin
 *  URL upstream in `ChatCardLoader`, so by the time we render here
 *  `chatRef.url` is guaranteed non-null AND the parent's `isNewTab`
 *  reflects the actual destination. */
function CampaignChatCard({
  item,
  chatRef,
  isNewTab,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  discuss?: CardDiscussAction
}) {
  // Mirror CampaignCardAdmin's compact meta — "date · N goals · Marketing
  // campaign" — instead of a status pill (the original showed no status badge).
  const goalsCount = Array.isArray(item?.goals) ? item.goals.length : 0
  const meta = [
    item?.start_date ? formatDateShort(item.start_date) : null,
    goalsCount > 0 ? `${goalsCount} goal${goalsCount !== 1 ? 's' : ''}` : null,
    'Marketing campaign',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <EntityMingoCard
      title={item?.name ?? ''}
      description={meta || item?.description || undefined}
      fallbackIcon={<Megaphone01Icon size={24} />}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Campaign actions"
    />
  )
}

/**
 * Shared `MingoInfoCard` shell for fetch-mode entity cards. `cover` renders as
 * the 40px image when present; otherwise `fallbackIcon` shows. Anchor + menu +
 * alt are wired uniformly so each registry render only computes the per-type
 * title / description / cover / icon / status.
 */
function EntityMingoCard({
  title,
  description,
  cover,
  fallbackIcon,
  status,
  chatRef,
  isNewTab,
  menuAriaLabel,
  discuss,
  openDetails,
  externalLink,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  cover?: string
  fallbackIcon: React.ReactNode
  status?: MingoInfoCardStatus
  chatRef: ChatRef
  isNewTab: boolean
  menuAriaLabel: string
  discuss?: CardDiscussAction
  /** See `cardMenuGroups` — per-entity "Open Details" row override. */
  openDetails?: { label: string; icon: React.ReactNode }
  /** See `cardMenuGroups` — trailing third-party-app deep-link row. */
  externalLink?: CardExternalLink
}) {
  return (
    <MingoInfoCard
      title={title}
      description={description}
      imageSrc={cover}
      imageAlt={typeof title === 'string' ? title : undefined}
      icon={fallbackIcon}
      status={status}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
      menuGroups={cardMenuGroups(chatRef.url, discuss, openDetails, externalLink)}
      menuAriaLabel={menuAriaLabel}
    />
  )
}

/** First non-empty cover URL: entity image → OG placeholder → none. */
function entityCover(image: unknown, ogPlaceholder?: string | null): string | undefined {
  return (typeof image === 'string' && image) || ogPlaceholder || undefined
}

/** Free-text status string → coloured status pill, reusing the shared
 *  `getStatusColorScheme` mapping (cyan/default collapse to neutral grey). */
function statusPill(status: unknown): MingoInfoCardStatus | undefined {
  const s = typeof status === 'string' ? status.trim() : ''
  if (!s) return undefined
  const scheme = getStatusColorScheme(s)
  const variant: MingoInfoCardStatus['variant'] =
    scheme === 'success' || scheme === 'error' || scheme === 'warning' ? scheme : 'grey'
  return { label: s, variant }
}

/** Blog post → image card. Cover is `featured_image`, falling back to the
 *  host's OG placeholder, then to a newspaper glyph when neither exists. */
function BlogChatCard({
  item,
  chatRef,
  isNewTab,
  ogPlaceholder,
  hasEmbeddedVideo,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  ogPlaceholder?: string | null
  hasEmbeddedVideo?: boolean
  discuss?: CardDiscussAction
}) {
  const category = Array.isArray(item?.categories)
    ? (item.categories.find((c: { name?: string }) => c && c.name)?.name as string | undefined)
    : undefined
  // A post with embedded video surfaces a yellow "Video" pill (mirrors the
  // original BlogCard's compact video badge + the Figma `7741:26583` sample);
  // otherwise the first category.
  const status: MingoInfoCardStatus | undefined = hasEmbeddedVideo
    ? { label: 'Video', variant: 'primary' }
    : category
      ? { label: category, variant: 'grey' }
      : undefined
  return (
    <EntityMingoCard
      title={item?.title ?? ''}
      description={item?.summary ?? undefined}
      cover={entityCover(item?.featured_image, ogPlaceholder)}
      fallbackIcon={<NewspaperIcon size={24} />}
      status={status}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Article actions"
    />
  )
}

/** Case study → trophy icon + "Case study" pill. */
function CaseStudyChatCard({
  item,
  chatRef,
  isNewTab,
  ogPlaceholder,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  ogPlaceholder?: string | null
  discuss?: CardDiscussAction
}) {
  const meta = [item?.msp?.name, item?.user?.full_name].filter(Boolean).join(' · ')
  return (
    <EntityMingoCard
      title={item?.title ?? ''}
      description={item?.summary || meta || undefined}
      cover={entityCover(item?.featured_image, ogPlaceholder)}
      fallbackIcon={<TrophyIcon size={24} />}
      status={{ label: 'Case study', variant: 'grey' }}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Case study actions"
    />
  )
}

/** Customer interview → microphone icon + "Interview" pill. */
function CustomerInterviewChatCard({
  item,
  chatRef,
  isNewTab,
  ogPlaceholder,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  ogPlaceholder?: string | null
  discuss?: CardDiscussAction
}) {
  const meta = [item?.user?.full_name, item?.msp?.name].filter(Boolean).join(' · ')
  return (
    <EntityMingoCard
      title={item?.title ?? ''}
      // Original compact body reads `video_summary` (NOT `summary`); fall back
      // to the "user · msp" meta line when absent.
      description={item?.video_summary || meta || undefined}
      cover={entityCover(item?.featured_image, ogPlaceholder)}
      fallbackIcon={<MicrophoneIcon size={24} />}
      status={{ label: 'Interview', variant: 'grey' }}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Interview actions"
    />
  )
}

/** Investor update → presentation icon + "Investor update" pill. Title falls
 *  back to "Update #N" when the row has no explicit title. */
function InvestorUpdateChatCard({
  item,
  chatRef,
  isNewTab,
  ogPlaceholder,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  ogPlaceholder?: string | null
  discuss?: CardDiscussAction
}) {
  const title = item?.title || `Update #${item?.update_number ?? '?'}`
  return (
    <EntityMingoCard
      title={title}
      // Original compact body reads `strategic_update || content` (NOT
      // `summary`); fall back to the period text.
      description={
        item?.strategic_update ||
        item?.content ||
        formatInvestorUpdatePeriod(item?.period_start, item?.period_end) ||
        undefined
      }
      cover={entityCover(item?.featured_image, ogPlaceholder)}
      fallbackIcon={<PresentationLineIcon size={24} />}
      status={{ label: 'Investor update', variant: 'grey' }}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Update actions"
    />
  )
}

/** Onboarding guide → compass icon + "Guide" pill. Cover prefers the featured
 *  image, then the video thumbnail / OG image. */
function OnboardingGuideChatCard({
  item,
  chatRef,
  isNewTab,
  ogPlaceholder,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  ogPlaceholder?: string | null
  discuss?: CardDiscussAction
}) {
  const cover =
    entityCover(item?.featured_image) ??
    entityCover(item?.main_video_thumbnail) ??
    entityCover(item?.og_image_url, ogPlaceholder)
  return (
    <EntityMingoCard
      title={item?.title ?? ''}
      description={item?.summary ?? item?.description ?? undefined}
      cover={cover}
      fallbackIcon={<CompassIcon size={24} />}
      status={{ label: 'Guide', variant: 'grey' }}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Guide actions"
    />
  )
}

/** Program (podcast / webinar / event) → per-type icon + type pill. Cover is
 *  the program `cover_url`. */
function ProgramChatCard({
  item,
  chatRef,
  isNewTab,
  configKey,
  label,
  ogPlaceholder,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  configKey: 'podcast' | 'webinar' | 'event'
  label: string
  ogPlaceholder?: string | null
  discuss?: CardDiscussAction
}) {
  const icon =
    configKey === 'webinar' ? (
      <PresentationBarIcon size={24} />
    ) : configKey === 'event' ? (
      <CalendarIcon size={24} />
    ) : (
      <MicrophoneIcon size={24} />
    )

  // Rich meta line mirroring ProgramCard's compact subtitle: "date · <typeMeta>"
  // where typeMeta is podcast duration / event location / webinar time·duration.
  // The type label itself already lives in the status pill, so it's omitted here.
  const isScheduled = item?.status === 'scheduled'
  let typeMeta: string | undefined
  if (
    configKey === 'podcast' &&
    typeof item?.duration_seconds === 'number' &&
    item.duration_seconds > 0 &&
    !isScheduled
  ) {
    typeMeta = formatDurationCompact(item.duration_seconds)
  } else if (
    configKey === 'event' &&
    typeof item?.location_name === 'string' &&
    item.location_name.trim().length > 0
  ) {
    typeMeta = item.location_name
  } else if (configKey === 'webinar' && item?.start_at) {
    const time = formatTimeWithTimezone(item.start_at, item.timezone ?? null)
    const dur = formatDurationFromRange(item.start_at, item.end_at)
    typeMeta = dur ? `${time} · ${dur}` : time
  }
  const itemDate = formatDate(item?.date ?? null, { fallback: '', timezone: 'local' })
  const meta = [itemDate, typeMeta].filter(Boolean).join(' · ')

  return (
    <EntityMingoCard
      title={item?.title ?? ''}
      description={meta || item?.description || undefined}
      cover={entityCover(item?.cover_url, ogPlaceholder)}
      fallbackIcon={icon}
      status={{ label, variant: 'grey' }}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel={`${label} actions`}
    />
  )
}

/**
 * Roadmap / delivery / task → coloured status pill, no cover image. Icon
 * priority mirrors `RoadmapCard`:
 *   1. task-type glyph for internal tasks (and logo-less typed items)
 *   2. the server-provided integration logo (`item.icon`, ClickUp, …),
 *      shown contained inside the icon box
 *   3. a per-type default glyph
 */
function RoadmapChatCard({
  item,
  chatRef,
  isNewTab,
  cardType,
  discuss,
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
  cardType: 'roadmap_item' | 'delivery_item' | 'internal_task'
  discuss?: CardDiscussAction
}) {
  const logoUrl =
    typeof item?.icon === 'string' && item.icon.startsWith('http') ? item.icon : undefined
  const useTypeIcon = cardType === 'internal_task' || (!logoUrl && item?.customItemId != null)
  const defaultIcon =
    cardType === 'delivery_item' ? (
      <TruckFastIcon size={24} />
    ) : cardType === 'internal_task' ? (
      <CheckSquareIcon size={24} />
    ) : (
      <MapIcon size={24} />
    )
  const icon = useTypeIcon ? (
    <TaskTypeIcon customItemId={item?.customItemId} className="size-6" />
  ) : logoUrl ? (
    // Contained (not full-bleed) so the integration logo keeps its aspect
    // ratio inside the bordered icon box — matches RoadmapCard.
    <img src={logoUrl} alt="" className="size-6 object-contain" />
  ) : (
    defaultIcon
  )
  // Every card here is a mirrored ClickUp task whose ref id IS the ClickUp
  // task id, so the "⋯" menu deep-links into ClickUp. internal_task's card
  // URL already IS that deep link (its mapper resolves no public
  // destination) — there we relabel the existing "Open Details" row instead
  // of adding a duplicate second ClickUp row.
  const clickupHref = clickupTaskUrl(chatRef.id)
  const clickupIcon = <ClickupLogoIcon size={20} />
  const cardUrlIsClickup = cardType === 'internal_task'
  return (
    <EntityMingoCard
      title={item?.title ?? ''}
      description={item?.description ?? undefined}
      fallbackIcon={icon}
      status={statusPill(item?.status)}
      chatRef={chatRef}
      isNewTab={isNewTab}
      discuss={discuss}
      menuAriaLabel="Roadmap actions"
      openDetails={
        cardUrlIsClickup ? { label: 'Open in ClickUp', icon: clickupIcon } : undefined
      }
      externalLink={
        !cardUrlIsClickup && clickupHref
          ? { label: 'Open in ClickUp', icon: clickupIcon, href: clickupHref }
          : undefined
      }
    />
  )
}

// =============================================================================
// CHAT_CARD_REGISTRY — single source of truth.
// =============================================================================

/**
 * ONE entry shape — no fetch/no-fetch mode split. Every card type fetches
 * its data by id ("send ids → get full objects"); the ONLY entries without
 * a `contentRefType` are the two types that have nothing server-side to
 * fetch: `deleted_data` (a tombstone for a row that no longer exists) and
 * `video` (body-embed content-hash ids with no backing table row) — those
 * render straight from the server-built ref.
 */
interface ChatCardRegistryEntry {
  label: string
  /** Render the card alone — skip the `ChatCardWithDiscuss` "Ask" +
   *  provenance source row. */
  bareInline?: boolean
  displayAction?: boolean
  /** Hydration type for `useChatCardItem` → `buildListUrl`. Content types
   *  resolve to their public list APIs; ref-shaped types resolve to the
   *  hub's generic `/api/chat/entity-refs?type=&ids=`. ABSENT only for
   *  `deleted_data` + `video` (see above). */
  contentRefType?: string
  /** Required whenever `contentRefType` is set. */
  skeleton?: () => React.ReactNode
  /** `item` is the fetched row (`undefined` only on the ref-only render
   *  path — `deleted_data` / `video`). */
  render: (item: any, chatRef: ChatRef, opts: ChatCardRenderOptions) => React.ReactNode
  /** Optional post-fetch URL synthesizer. When `chatRef.url` is null
   *  AFTER `resolveSourceRowCTA`, the loader runs this against the
   *  hydrated item to produce a fallback URL (e.g.
   *  `/admin/campaigns/${item.id}` for marketing campaigns; `item.url`
   *  for ChatRef-shaped items). Result is validated via `safeHref`
   *  before being attached to the resolved ref — so the wrapper sees a
   *  non-null `href`, the pre-computed `isNewTab` reflects the actual
   *  destination, and the click goes through `handleChatNavClick` (no
   *  silent bypass of embed-mode / close-on-nav). Takes precedence over
   *  the `composeContentUrl` fallback below. */
  fallbackHref?: (item: any) => string | null
  /** Opt OUT of the post-fetch `composeContentUrl` fallback (see
   *  `resolveFetchedCardHref`). Set for types with NO public destination
   *  — the seam would otherwise synthesize `<contentOrigin>/<type>/<id>`
   *  from its default branch and hand the user a 404. Types with a real
   *  route (hosted, or covered by a host `override`) leave it unset. */
  noComposedHref?: boolean
}

/**
 * Entry preset for types hydrated by their per-object card route
 * (`/api/github/commits`, `/api/slack-community/messages`, …;
 * `hubspot_ticket_self` via `/api/tickets`) — the fetched item IS a
 * `ChatRef`, and the API is the SINGLE display-data layer
 * (`fetchedItemDisplayRef`): `item.url` is the canonical destination
 * (`fallbackHref`), no `<origin>/<type>/<id>` synthesis
 * (`noComposedHref`). Loading shows the skeleton, exactly like every
 * other fetch card.
 */
function refHydratedEntry(
  docType: string,
  label: string,
  renderRef: (displayRef: ChatRef, opts: ChatCardRenderOptions) => React.ReactNode,
): ChatCardRegistryEntry {
  return {
    label,
    bareInline: true,
    contentRefType: docType,
    noComposedHref: true,
    fallbackHref: (item: { url?: string | null }) => item?.url ?? null,
    skeleton: () => <MingoInfoCardSkeleton />,
    render: (item, chatRef, opts) => renderRef(fetchedItemDisplayRef(item, chatRef), opts),
  }
}

interface FinancialCardConfig {
  label: string
  /** Per-type leading glyph — carries the type signal now that the
   *  badge pill is dropped. */
  icon: () => React.ReactNode
}
const FINANCIAL_CARD_CONFIGS: Record<string, FinancialCardConfig> = {
  financial_kpi: { label: 'Financial KPI', icon: () => <ChartBar01VerIcon size={24} /> },
  cap_table: { label: 'Cap table entry', icon: () => <ChartPieIcon size={24} /> },
  profit_loss: { label: 'P&L period', icon: () => <MoneyBillDollarIcon size={24} /> },
  balance_sheet: { label: 'Balance sheet', icon: () => <BankIcon size={24} /> },
  cash_flow: { label: 'Cash flow', icon: () => <CoinsExchangeCurrencyIcon size={24} /> },
}
/** Expand a per-family config map into registry entries — ONE loop shell
 *  for every card family (financial, github, program, roadmap); adding a
 *  family is a config map + one `registryEntries(...)` call. */
function registryEntries<C>(
  configs: Record<string, C>,
  build: (cfg: C, docType: string) => ChatCardRegistryEntry,
): Record<string, ChatCardRegistryEntry> {
  const out: Record<string, ChatCardRegistryEntry> = {}
  for (const [docType, cfg] of Object.entries(configs)) out[docType] = build(cfg, docType)
  return out
}

function financialRegistryEntries(): Record<string, ChatCardRegistryEntry> {
  return registryEntries(FINANCIAL_CARD_CONFIGS, (cfg, docType) =>
    refHydratedEntry(docType, cfg.label, (displayRef, opts) => (
      <GenericFinancialChatCard
        chatRef={displayRef}
        icon={cfg.icon()}
        isNewTab={opts.isNewTab}
        discuss={opts.discuss}
      />
    )),
  )
}

interface GitHubCardConfig {
  label: string
  kind: GitHubActivityKind
}
const GITHUB_CARD_CONFIGS: Record<string, GitHubCardConfig> = {
  github_commit: { label: 'GitHub commit', kind: 'commit' },
  github_commit_public: { label: 'GitHub commit (public)', kind: 'commit' },
  github_pull_request: { label: 'GitHub PR', kind: 'pull_request' },
  github_pull_request_public: { label: 'GitHub PR (public)', kind: 'pull_request' },
  github_pr_review: { label: 'GitHub review', kind: 'pr_review' },
  github_pr_review_public: { label: 'GitHub review (public)', kind: 'pr_review' },
}
function githubRegistryEntries(): Record<string, ChatCardRegistryEntry> {
  return registryEntries(GITHUB_CARD_CONFIGS, (cfg, docType) =>
    refHydratedEntry(docType, cfg.label, (displayRef, opts) => (
      <GitHubChatCard chatRef={displayRef} kind={cfg.kind} isNewTab={opts.isNewTab}
        discuss={opts.discuss} />
    )),
  )
}

type ProgramConfigKey = 'podcast' | 'webinar' | 'event'
interface ProgramCardConfig {
  label: string
  configKey: ProgramConfigKey
  contentRefType: string
}
const PROGRAM_CARD_CONFIGS: Record<string, ProgramCardConfig> = {
  podcast: { label: 'Podcast episode', configKey: 'podcast', contentRefType: 'podcast' },
  webinar: { label: 'Webinar', configKey: 'webinar', contentRefType: 'webinar' },
  event: { label: 'Event', configKey: 'event', contentRefType: 'event' },
}
function programRegistryEntries(): Record<string, ChatCardRegistryEntry> {
  return registryEntries(PROGRAM_CARD_CONFIGS, (cfg) => ({
    label: cfg.label,
    contentRefType: cfg.contentRefType,
    bareInline: true,
    skeleton: () => <ProgramCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <ProgramChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
        discuss={opts.discuss}
        configKey={cfg.configKey}
        label={cfg.configKey.charAt(0).toUpperCase() + cfg.configKey.slice(1)}
        ogPlaceholder={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
      />
    ),
  }))
}

type RoadmapCardType = 'roadmap_item' | 'delivery_item' | 'internal_task'
interface RoadmapEntryConfig {
  label: string
  cardType: RoadmapCardType
  contentRefType: string
  /** See `ChatCardRegistryEntry.noComposedHref`. */
  noComposedHref?: boolean
}
const ROADMAP_CARD_CONFIGS: Record<string, RoadmapEntryConfig> = {
  roadmap_item: { label: 'Roadmap item', cardType: 'roadmap_item', contentRefType: 'roadmap_item' },
  delivery_item: {
    label: 'Delivery item',
    cardType: 'delivery_item',
    contentRefType: 'delivery_item',
  },
  internal_task: {
    label: 'Internal task',
    cardType: 'internal_task',
    contentRefType: 'internal_task',
    // Internal ClickUp work has no public destination on any platform — the
    // seam's default branch would synthesize `<hub>/internal_task/<id>`.
    noComposedHref: true,
  },
}
function roadmapRegistryEntries(): Record<string, ChatCardRegistryEntry> {
  return registryEntries(ROADMAP_CARD_CONFIGS, (cfg) => ({
    label: cfg.label,
    contentRefType: cfg.contentRefType,
    bareInline: true,
    ...(cfg.noComposedHref ? { noComposedHref: true } : {}),
    skeleton: () => <RoadmapCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <RoadmapChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
        discuss={opts.discuss}
        cardType={cfg.cardType}
      />
    ),
  }))
}

const CHAT_CARD_REGISTRY: Record<string, ChatCardRegistryEntry> = {
  // ───────── ref-shaped types: hydrated via /api/chat/entity-refs ─────────
  ...githubRegistryEntries(),
  // Generic TOMBSTONE for entities a chat action deleted (ClickUp task
  // today; any deletable entity tomorrow). No fetch (nothing exists
  // server-side anymore), no navigation — the placeholder keeps the
  // thread's integrity (Teams/Slack "This message was deleted" pattern).
  deleted_data: {
    label: 'Deleted',
    bareInline: true,
    // The marker descriptor carries no metadata (cards hydrate by id, and a
    // deleted entity has nothing to hydrate from), so every prop degrades to
    // null and the card renders its generic "Deleted item" tombstone. The
    // descriptor's `title` defaults to the raw cardId — suppress it so the
    // strikethrough line never shows an opaque id.
    render: (_item, chatRef) => (
      <DeletedDataCard
        title={chatRef.title && chatRef.title !== chatRef.id ? chatRef.title : null}
        entityLabel={(chatRef.metadata?.entity_label as string | undefined) ?? null}
        recoveryNote={(chatRef.metadata?.recovery_note as string | undefined) ?? null}
      />
    ),
  },
  slack_message: refHydratedEntry('slack_message', 'Slack message', (displayRef, opts) => (
    <SlackChatCard chatRef={displayRef} isNewTab={opts.isNewTab} discuss={opts.discuss} />
  )),
  // FAQ hydrates from its EXISTING public list API (`/api/faqs?ids=` —
  // also feeding related-content rails, so its base path must not move).
  // Rows are faq-shaped, not ChatRef-shaped, hence the bespoke row→display
  // mapping instead of `refHydratedEntry`.
  faq: {
    label: 'FAQ',
    bareInline: true,
    contentRefType: 'faq',
    noComposedHref: true,
    fallbackHref: (item: { id?: number | string }) =>
      item?.id != null ? `/faqs#${faqItemAnchor(item.id)}` : null,
    skeleton: () => <MingoInfoCardSkeleton />,
    render: (item, chatRef, opts) => (
      <FaqChatCard chatRef={fetchedFaqDisplayRef(item, chatRef)} isNewTab={opts.isNewTab}
          discuss={opts.discuss} />
    ),
  },
  hubspot_ticket: refHydratedEntry('hubspot_ticket', 'HubSpot ticket', (displayRef, opts) => (
    <HubspotTicketChatCard chatRef={displayRef} isNewTab={opts.isNewTab}
        discuss={opts.discuss} />
  )),
  hubspot_ticket_anon: refHydratedEntry(
    'hubspot_ticket_anon',
    'HubSpot ticket (anon)',
    (displayRef, opts) => (
      <HubspotTicketChatCard chatRef={displayRef} isNewTab={opts.isNewTab}
          discuss={opts.discuss} />
    ),
  ),
  // Self tickets hydrate via the session-scoped `GET /api/tickets?ids=`
  // (`selfScopeFilter` ACL) instead of the generic endpoint — the self
  // config's searchFilter is deliberately fail-closed there. Same
  // ChatRef item shape (`buildHubspotTicketSelfRef` SSOT), same preset.
  hubspot_ticket_self: refHydratedEntry(
    'hubspot_ticket_self',
    'HubSpot ticket (self)',
    (displayRef, opts) => (
      <HubspotTicketChatCard chatRef={displayRef} isNewTab={opts.isNewTab}
          discuss={opts.discuss} />
    ),
  ),
  data_room_doc: refHydratedEntry('data_room_doc', 'Data-room doc', (displayRef, opts) => (
    <DataRoomDocChatCard chatRef={displayRef} isNewTab={opts.isNewTab}
        discuss={opts.discuss} />
  )),
  markdown: refHydratedEntry('markdown', 'Doc page (markdown)', (displayRef, opts) => (
    <DataRoomDocChatCard chatRef={displayRef} isNewTab={opts.isNewTab}
        discuss={opts.discuss} />
  )),
  // Body-synthesized video ids (`shortVideoId` content hashes / YouTube
  // ids) have no backing table row to fetch — ref-only by nature.
  video: {
    label: 'Video',
    bareInline: true,
    render: (_item, chatRef) => <ChatInlineVideoPill chatRef={chatRef} />,
  },
  ...financialRegistryEntries(),

  // ───────── content types: full rows from their public list APIs ─────────
  blog_post: {
    label: 'Blog post',
    contentRefType: 'blog_post_existing',
    bareInline: true,
    skeleton: () => <BlogCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <BlogChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
          discuss={opts.discuss}
        ogPlaceholder={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
        hasEmbeddedVideo={chatRef.metadata?.hasEmbeddedVideo === true}
      />
    ),
  },
  case_study: {
    label: 'Case study',
    contentRefType: 'case_study',
    bareInline: true,
    skeleton: () => <CaseStudyCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <CaseStudyChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
          discuss={opts.discuss}
        ogPlaceholder={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
      />
    ),
  },
  customer_interview: {
    label: 'Customer interview',
    contentRefType: 'customer_interview',
    bareInline: true,
    skeleton: () => <CustomerInterviewCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <CustomerInterviewChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
          discuss={opts.discuss}
        ogPlaceholder={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
      />
    ),
  },
  product_release: {
    label: 'Product release',
    contentRefType: 'product_release',
    bareInline: true,
    skeleton: () => <ProductReleaseCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => {
      // Embedder-provided builder wins; lib default fills in otherwise
      // (covers `coverImage`, `hasVideoCover`, `formattedDate` — the
      // three fields the compact `size='sm'` card actually reads).
      // Hub-side embedders still pass their richer builder via
      // `extras.buildProductReleaseCardProps` to get lg-only metadata
      // (badge color, changelog counts, etc.).
      const builder =
        opts?.extras?.buildProductReleaseCardProps ?? defaultBuildProductReleaseCardProps
      return (
        <ProductReleaseChatCard
          item={item}
          chatRef={chatRef}
          buildProps={builder}
          isNewTab={opts.isNewTab}
          discuss={opts.discuss}
        />
      )
    },
  },
  ...programRegistryEntries(),
  investor_update: {
    label: 'Investor update',
    contentRefType: 'investor_update',
    bareInline: true,
    skeleton: () => <InvestorUpdateCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <InvestorUpdateChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
          discuss={opts.discuss}
        ogPlaceholder={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
      />
    ),
  },
  onboarding_guide: {
    label: 'Onboarding guide',
    contentRefType: 'onboarding_guide',
    bareInline: true,
    // "Display" affordance (verbatim guide body) instead of "Ask".
    displayAction: true,
    skeleton: () => <OnboardingGuideCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <OnboardingGuideChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
          discuss={opts.discuss}
        ogPlaceholder={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
      />
    ),
  },
  marketing_campaign: {
    label: 'Marketing campaign',
    contentRefType: 'marketing_campaign',
    bareInline: true,
    skeleton: () => <CampaignCardAdminSkeleton />,
    // No public viewer — synthesize the hub-internal admin URL post-fetch
    // so the wrapper + isNewTab computation see the actual destination.
    fallbackHref: (item: { id?: string }) =>
      item?.id ? `/admin/campaigns/${encodeURIComponent(item.id)}` : null,
    render: (item, chatRef, opts) => (
      <CampaignChatCard
        item={item}
        chatRef={chatRef}
        isNewTab={opts.isNewTab}
          discuss={opts.discuss}
      />
    ),
  },
  ...roadmapRegistryEntries(),
}

// =============================================================================
// ChatCardNavWrap — click-capture interceptor that routes inner-anchor
// clicks through the chat runtime's nav handler.
//
// Single source of truth for click handling on EVERY inline card. The
// card body provides its own `<a href={absolute}>` (per the
// pure-presentation contract) — this wrapper intercepts the primary
// click via `onClickCapture` BEFORE the browser's default navigation
// fires, and routes through `handleChatNavClick` to apply runtime nav
// rules (embed-mode `window.open` / cross-platform new-tab / host
// `runtime.navigation.navigate`). Modifier / non-primary clicks pass
// through (`handleChatNavClick` returns early so the browser opens
// the inner anchor's href naturally).
//
// Same click model as source chips — chips use `<a onClick={handleChatNavClick}>`
// directly; cards use `<span onClickCapture={→handleChatNavClick}>` outside
// the card's own anchor. Both ultimately call `handleChatNavClick` with
// the same `{href, targetPlatform}` resolved at `ChatCardLoader` via
// `resolveSourceRowCTA`. The unification:
//   - Same URL composition (`resolveSourceRowCTA`)
//   - Same embed-mode prefix (`resolveHrefForRuntime`)
//   - Same click router (`handleChatNavClick`)
//   - Same conditional close (`ChatPanelContext.closeChat` on same-tab only)
// =============================================================================

/**
 * ChatCardNavWrap — click-capture interceptor for inline cards.
 *
 * `<span onClickCapture>` wrapping the card body. The card renders its
 * own `<a href target rel>` with the canonical pre-resolved href +
 * new-tab decision applied (via `opts.isNewTab` from ChatCardLoader).
 *
 * Job:
 *   - PRIMARY clicks → preventDefault + route through `handleChatNavClick`
 *   - Modifier-clicks → pass through to the browser's native handling
 *   - Same-tab nav → close the chat panel (so the panel doesn't linger
 *     over the now-current-page content). New-tab nav leaves it open.
 *
 * Single close path for inline cards. The chip block in
 * `embeddable-chat.tsx` mirrors this logic for source chips. Both
 * gate on `!isNewTab` computed from the same `decideNewTab` rule, so
 * the close decision is consistent across surfaces.
 */
function ChatCardNavWrap({
  href,
  path,
  targetPlatform,
  isNewTab,
  children,
}: {
  href: string | null
  /** In-app doc-tree path for `markdown` / `data_room_doc` refs. The
   *  runtime's `navigate({path})` opportunistically swaps the active
   *  documentation section without a full page nav; null for everything
   *  else. Threaded straight through to `handleChatNavClick` so chips
   *  and inline cards apply the same routing rule. */
  path: string | null
  targetPlatform: string | null
  /** New-tab decision pre-computed by the parent `ChatCardLoader` —
   *  same value the card's `<a target>` already renders with.
   *  Consumed here ONLY to decide whether to close the panel. */
  isNewTab: boolean
  children: ReactNode
}) {
  const runtime = useRequiredChatRuntime()
  const router = useRouter()
  const panel = useChatPanel()
  const onClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (!href) return
    const targetEl = e.target as HTMLElement
    // Only claim clicks that physically happened INSIDE this card.
    //
    // The card's "⋯" menu renders through a React PORTAL: its DOM lives in the
    // panel's portal host, but React still bubbles its events through this
    // subtree — so this capture handler sees them first and, being a capture
    // phase, runs BEFORE the menu row's own `stopPropagation`. That swallowed
    // the menu's trailing "↗ Open in new tab" button: `executeNavigation`
    // called `preventDefault()` and routed the card's href in the SAME tab,
    // so the anchor's `target="_blank"` never applied.
    const host = e.currentTarget as HTMLElement | null
    if (!host?.contains(targetEl)) return
    // Buttons rendered INSIDE the card's outer `<a>` (e.g. RoadmapCard
    // vote buttons, ImageGallery thumbnails) bubble up with
    // `closest('a')` truthy — without this guard, clicking them would
    // route through the chat nav handler and navigate away from the
    // page. The button's own onClick keeps working because we exit
    // before stopPropagation.
    if (targetEl?.closest?.('button')) return
    if (!targetEl?.closest?.('a')) return

    const handled = handleChatNavClick(e, runtime, { href, path, targetPlatform }, router.push)
    if (!handled) return
    // Modifier-clicks fall through (handled=false) without stopPropagation
    // so ancestor telemetry handlers still see the bubble.
    e.stopPropagation()
    if (!isNewTab && panel?.closeChat) panel.closeChat()
  }
  return (
    <span className="contents" onClickCapture={onClickCapture}>
      {children}
    </span>
  )
}

// =============================================================================
// ChatCardLoader — fetch + skeleton + render for fetch-mode entries.
// =============================================================================

interface ChatCardLoaderProps {
  chatRef: ChatRef
  onDiscuss?: (ref: ChatRef) => void
  onDisplay?: (ref: ChatRef) => void
  baseRoute?: string
  chipBasePlatform?: string
  extras?: ChatCardDispatchExtras
}

/**
 * Generic fetch-mode card loader. Looks up the registry entry by
 * `chatRef.type`, fetches the full item via `useChatCardItem`, and
 * routes through skeleton / null / card-render.
 *
 * SINGLE URL-RESOLUTION POINT — same code path source chips already
 * had. Before render dispatch:
 *   - Pass the ref through `resolveSourceRowCTA` to compute the
 *     canonical `{href, targetPlatform}` (externalUrl → in-app path
 *     fallback → null, with embedder `baseRoute` / `chipBasePlatform`
 *     awareness).
 *   - Pre-resolve href against `runtime.navigation.defaultContentOrigin`
 *     in embed mode (so modifier-click + copy-link land on the hub).
 *   - Re-attach the resolved values onto the ref so EVERY downstream
 *     card — whether it renders an inner `<a>` from `href` prop
 *     (BlogCard, ProgramCard, …) or pulls `anchorProps` from
 *     `computeIsNewTab` — sees the SAME canonical URL the
 *     chip would render.
 *
 * Eliminates the entire "chip works, inline card doesn't" class of bug.
 */
export function ChatCardLoader({
  chatRef,
  onDiscuss,
  onDisplay,
  baseRoute,
  chipBasePlatform,
  extras,
}: ChatCardLoaderProps) {
  const runtime = useRequiredChatRuntime()
  const resolvedChatRef = React.useMemo<ChatRef>(() => {
    const cta = resolveSourceRowCTA(
      {
        sourceRepo: chatRef.sourceRepo,
        documentType: chatRef.type,
        id: chatRef.id,
        title: chatRef.title,
        externalUrl: chatRef.url,
        targetPlatform: chatRef.targetPlatform,
        path:
          typeof chatRef.metadata?.path === 'string'
            ? (chatRef.metadata.path as string)
            : null,
      },
      sourceRowCtxFromRuntime(runtime, { baseRoute, chipBasePlatform }),
    )
    const finalHref = cta.href ? resolveHrefForRuntime(cta.href, runtime) : null
    return {
      ...chatRef,
      url: finalHref ?? chatRef.url,
      targetPlatform: cta.targetPlatform ?? chatRef.targetPlatform ?? null,
    }
  }, [chatRef, runtime, baseRoute, chipBasePlatform])

  const entry = CHAT_CARD_REGISTRY[resolvedChatRef.type]
  // Hook order MUST be stable across renders — call the data hook
  // unconditionally regardless of entry mode. For non-fetch types the
  // `contentRefType` is empty so the hook returns `isLoading=false` and
  // `item=undefined`, which we ignore.
  const fetchEntry = entry && entry.contentRefType ? entry : null
  const { item, isLoading, isError, isFetched } = useChatCardItem<any>(
    fetchEntry?.contentRefType ?? '',
    fetchEntry ? resolvedChatRef.id : '',
  )
  if (!entry) return null

  // Apply the post-fetch URL fallback (the ref carried no `externalUrl`).
  // We mutate `resolvedChatRef.url` BEFORE computing isNewTab so the
  // wrapper's interceptor sees the destination the user will actually
  // visit. `safeHref` blocks `javascript:` / `data:` payloads even
  // though the registry callers compose hub-internal strings today.
  //
  // Two sources, in order:
  //   1. the registry's per-type `fallbackHref` — an explicit non-content
  //      destination (marketing campaign → `/admin/...`);
  //   2. the host's `composeContentUrl` seam via `resolveFetchedCardHref` —
  //      the SAME resolver page cards go through. This is what makes cards
  //      clickable on every transport: the wire ships bare
  //      `[card://type:id]` markers with no metadata, so the ref reaches
  //      us with `url: null` and `resolveSourceRowCTA` has nothing to route.
  const composedHref =
    fetchEntry?.contentRefType && !resolvedChatRef.url && item && !fetchEntry.fallbackHref && !fetchEntry.noComposedHref
      ? resolveFetchedCardHref({
          contentRefType: fetchEntry.contentRefType,
          id: resolvedChatRef.id,
          item,
          composeContentUrl: runtime.composeContentUrl,
        })
      : null
  const hrefResolvedChatRef: ChatRef =
    fetchEntry && !resolvedChatRef.url && item && fetchEntry.fallbackHref
      ? {
          ...resolvedChatRef,
          url: safeHref(fetchEntry.fallbackHref(item)),
        }
      : composedHref
        ? {
            ...resolvedChatRef,
            url: safeHref(composedHref.href),
            targetPlatform: composedHref.targetPlatform ?? resolvedChatRef.targetPlatform ?? null,
          }
        : resolvedChatRef

  // Title enrichment, same synthetic-ref gap as the href above: a Mingo
  // `[card://type:id]` marker produces `title: <id>` because the transport
  // ships no ref metadata. Downstream consumers that read `ref.title` — most
  // visibly the "Ask Mingo" prompt, which would otherwise send
  // "Tell me more about 86ad3qvv5" — get the row's real title once it loads.
  // A ref that already carries a distinct title (the SSE path) is untouched.
  const fetchedTitle = fetchEntry && item ? readFetchedCardTitle(item) : null
  const finalChatRef: ChatRef =
    fetchedTitle && (!hrefResolvedChatRef.title || hrefResolvedChatRef.title === hrefResolvedChatRef.id)
      ? { ...hrefResolvedChatRef, title: fetchedTitle }
      : hrefResolvedChatRef

  // Pre-compute new-tab decision ONCE here (the same rule chips use).
  // Render branches that pass `target` / `rel` to their card pull this
  // via `renderOpts.isNewTab` so the inner `<a>` agrees with the
  // runtime nav decision in `ChatCardNavWrap` + `handleChatNavClick`.
  const isNewTab = computeIsNewTab(runtime, finalChatRef.url, finalChatRef.targetPlatform ?? null)

  // Resolve the "Ask Mingo"/"Display" affordance ONCE — same precedence as the
  // legacy `ChatCardWithDiscuss` (displayAction + onDisplay → "Display",
  // otherwise onDiscuss → "Ask Mingo"). Threaded into each card's "⋯" menu.
  const useDisplay = !!entry.displayAction && !!onDisplay
  const discussFn = useDisplay ? onDisplay : onDiscuss
  const discuss: CardDiscussAction | undefined = discussFn
    ? {
        label: useDisplay ? 'Display' : 'Ask Mingo',
        icon: useDisplay ? (
          <FileContentIcon size={20} />
        ) : (
          <MingoIcon
            className="size-5"
            color="white"
            eyesColor="var(--ods-flamingo-cyan-base)"
            cornerColor="var(--ods-flamingo-cyan-base)"
          />
        ),
        run: () => discussFn(finalChatRef),
      }
    : undefined

  const renderOpts: ChatCardRenderOptions = {
    baseRoute,
    chipBasePlatform,
    extras,
    isNewTab,
    discuss,
  }

  // Wrap EVERY rendered card with ChatCardNavWrap so the inner anchor's
  // primary click routes through the chat runtime (same handler as the
  // source chip). The card's `<a href={absolute}>` provides the visible
  // href for hover-preview / copy-link / modifier-click; the wrapper
  // intercepts the primary click and applies runtime nav rules.
  const path =
    typeof finalChatRef.metadata?.path === 'string'
      ? (finalChatRef.metadata.path as string)
      : null
  const navWrap = (children: ReactNode) => (
    <ChatCardNavWrap
      href={finalChatRef.url ?? null}
      path={path}
      targetPlatform={finalChatRef.targetPlatform ?? null}
      isNewTab={isNewTab}
    >
      {children}
    </ChatCardNavWrap>
  )
  // ONE render tail for both modes — bare-inline cards skip the discuss
  // wrapper; everything else gets the ChatCardWithDiscuss chrome. Kept
  // here (not per-branch) so the two paths can never drift on the
  // discuss-menu wiring.
  const finish = (node: React.ReactNode) =>
    entry.bareInline ? (
      <>{navWrap(node)}</>
    ) : (
      <ChatCardWithDiscuss
        chatRef={finalChatRef}
        onDiscuss={onDiscuss}
        onDisplay={onDisplay}
        displayAction={entry.displayAction}
      >
        {navWrap(node)}
      </ChatCardWithDiscuss>
    )
  if (!fetchEntry) {
    // Ref-only types (`deleted_data`, `video` — nothing exists server-side
    // to fetch): render straight from the marker's descriptor.
    return finish(entry.render(undefined, finalChatRef, renderOpts))
  }
  if (isLoading) return <>{fetchEntry.skeleton?.() ?? null}</>
  if (!item) {
    // FAIL LOUD (explicit product decision 2026-08-13): a card that
    // cannot hydrate renders a VISIBLE error card — silent removal made
    // broken answers look fine. Three distinguishable states:
    if (isError) {
      // Transient fetch failure (auth blip, 5xx, rate limit).
      return <CardLoadFailure label={entry.label} id={finalChatRef.id} detail="Failed to load" />
    }
    if (!isFetched) {
      // Query never ran — no list URL registered for this type / empty id.
      return <CardLoadFailure label={entry.label} id={finalChatRef.id} detail="Not loadable" />
    }
    // Successful fetch, id absent — entity gone or the LLM invented the id.
    return <CardLoadFailure label={entry.label} id={finalChatRef.id} detail="Not found" />
  }
  // Hero-video promotion, API-driven: when the FETCHED item carries a
  // playable video (ChatRef-shaped items via `metadata.videoUrl` /
  // `youtubeUrl` / `highlightVideoUrl`; content rows via the canonical
  // `custom_video_url` / `main_video_url` columns), render the video
  // section as a SIBLING below the compact card. NOT `<BlockCard>` —
  // that is a render-null sentinel only chat-message-enhanced's SYNC
  // pre-scan understands; returned from inside this loader (post-fetch,
  // async) it renders nothing (the missing-videos regression,
  // 2026-08-13). The loader's output already lives in a hoisted
  // block-level sibling (`b-<key>`), so block content is legal here.
  const videoMeta = itemVideoMetadata(item)
  if (videoMeta) {
    const videoRef: ChatRef = {
      ...finalChatRef,
      metadata: { ...(finalChatRef.metadata ?? {}), ...videoMeta },
    }
    return (
      // Same 12px rhythm as the message renderer's block-sibling wrapper
      // (`my-3` in chat-message-enhanced) so card→player spacing matches
      // the spacing between any two hoisted blocks.
      <div className="flex min-w-0 flex-col gap-3">
        {finish(entry.render(item, finalChatRef, renderOpts))}
        <ChatVideoEntityCard chatRef={videoRef} />
      </div>
    )
  }
  return finish(entry.render(item, finalChatRef, renderOpts))
}

// =============================================================================
// Public dispatch entry points
// =============================================================================

/**
 * Render the chat-inline card for a `[card://<type>:<id>]` marker.
 *
 * Single dispatch through `CHAT_CARD_REGISTRY`. The function mirrors the
 * hub's `renderChatInlineEntityCard` behavior:
 *   - Video-bearing refs return a `<BlockCard>` sentinel so the
 *     `chat-message-enhanced` pre-scan hoists the player out of the
 *     assistant paragraph.
 *   - Other refs render the compact card, optionally wrapped in a
 *     close-on-anchor-click span when `onClose` is supplied.
 */
export function renderChatInlineEntityCard(
  chatRef: ChatRef,
  options: {
    onDiscuss?: (ref: ChatRef) => void
    onDisplay?: (ref: ChatRef) => void
    baseRoute?: string
    chipBasePlatform?: string
    extras?: ChatCardDispatchExtras
  } = {},
): React.ReactNode {
  const { onDiscuss, onDisplay, baseRoute, chipBasePlatform, extras } = options

  const loader = (
    <ChatCardLoader
      chatRef={chatRef}
      onDiscuss={onDiscuss}
      onDisplay={onDisplay}
      baseRoute={baseRoute}
      chipBasePlatform={chipBasePlatform}
      extras={extras}
    />
  )

  // Embedded videos are SELF-DESCRIBING: the marker id alone recovers the
  // playable URL (`decodeVideoMarkerId`), so the player renders on ANY
  // transport with zero refs/fetch. Undecodable ids (legacy sha1 hashes,
  // hallucinations) fall through to the loader → plain-text degrade.
  // Hero videos on FETCHED entity types (webinars, releases, …) are
  // handled post-fetch inside ChatCardLoader (`itemVideoMetadata`) — the
  // marker's ref plays no part in either path.
  if (chatRef.type === 'video') {
    const decoded = decodeVideoMarkerId(chatRef.id)
    if (decoded) {
      const displayRef: ChatRef = {
        ...chatRef,
        title: chatRef.title && chatRef.title !== chatRef.id ? chatRef.title : 'Video',
        url: chatRef.url ?? (decoded.videoUrl ?? (decoded.youtubeUrl ? `https://www.youtube.com/watch?v=${decoded.youtubeUrl}` : null)),
        metadata: { ...(chatRef.metadata ?? {}), ...decoded },
      }
      return (
        <BlockCard inline={<ChatInlineVideoPill chatRef={displayRef} />}>
          <ChatVideoEntityCard chatRef={displayRef} />
        </BlockCard>
      )
    }
    return loader
  }

  return loader
}

// =============================================================================
// NavLink wiring for callers that need to compose anchors (Task 2 + Task 3)
// =============================================================================

/** Re-export so call sites can wrap any subtree with chat-runtime
 *  routing in a single import. */
export { NavLinkAnchorViaRuntime }
