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
import { resolveSourceRowCTA, resolveSourceIcon } from '../utils/source-row-cta'
import { resolveHrefForRuntime } from '../utils/chat-nav-resolution'
import {
  computeIsNewTab,
  newTabAnchorAttrs,
  buildAnchorProps,
} from '../utils/nav-anchor-props'
import { safeHref } from '../utils/compact-card-classes'
import { useChatPanel } from '../chat-panel-context'
import { getSourceLabel } from '../utils/source-icons'
import { SourceActionButton } from '../source-action-button'
import { NavLinkAnchorViaRuntime } from '../nav-link-anchor-via-runtime'
import { DEFAULT_PROGRAM_CONFIGS } from './program-card-defaults'
import { defaultBuildProductReleaseCardProps } from './product-release-card-defaults'
import { ChatVideoEntityCard } from './chat-video-entity-card'
import { BlockCard } from './block-card'
import { BlogCard, BlogCardSkeleton } from './blog-card'
import { CaseStudyCard, CaseStudyCardSkeleton } from './case-study-card'
import {
  CustomerInterviewCard,
  CustomerInterviewCardSkeleton,
} from './customer-interview-card'
import {
  ProductReleaseCard,
  ProductReleaseCardSkeleton,
  type ProductReleaseCardProps,
} from './product-release-card'
import {
  ProgramCard,
  ProgramCardSkeleton,
  type ProgramCardProps,
} from './program-card'
import {
  InvestorUpdateCard,
  InvestorUpdateCardSkeleton,
} from './investor-update-card'
import {
  OnboardingGuideCard,
  OnboardingGuideCardSkeleton,
} from './onboarding-guide-card'
import {
  CampaignCardAdmin,
  CampaignCardAdminSkeleton,
} from './campaign-card-admin'
import { RoadmapCard, RoadmapCardSkeleton } from './roadmap-card'
import {
  GitHubActivityCard,
  type GitHubActivityCardAnchorProps,
} from './github-activity-card'
import { SlackMessageCard } from './slack-message-card'
import { HubspotTicketCard } from './hubspot-ticket-card'
import { DataRoomDocCard } from './data-room-doc-card'
import {
  GenericEntityCard,
  type GenericEntityCardAnchorProps,
} from './generic-entity-card'
import type { GitHubActivityKind } from '../types/entities/github-activity'
import type { BaseProgramItem, ProgramConfig } from '../types/entities/program-types'

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

function GitHubChatCard({
  chatRef,
  kind,
  isNewTab,
}: {
  chatRef: ChatRef
  kind: GitHubActivityKind
  isNewTab: boolean
}) {
  const anchorProps: GitHubActivityCardAnchorProps | undefined = buildAnchorProps(
    chatRef.url,
    isNewTab,
  )
  return (
    <GitHubActivityCard
      item={{
        id: chatRef.id,
        title: chatRef.title,
        url: chatRef.url ?? null,
        dateUpdated: chatRef.date ?? null,
        kind,
      }}
      variant="compact"
      anchorProps={anchorProps}
    />
  )
}

function HubspotTicketChatCard({
  chatRef,
  isNewTab,
}: {
  chatRef: ChatRef
  isNewTab: boolean
}) {
  const status =
    typeof chatRef.metadata?.status === 'string' ? (chatRef.metadata.status as string) : undefined
  const statusLabel =
    typeof chatRef.metadata?.statusLabel === 'string'
      ? (chatRef.metadata.statusLabel as string)
      : undefined
  const priority =
    typeof chatRef.metadata?.priority === 'string'
      ? (chatRef.metadata.priority as string)
      : undefined
  const customerCompany =
    typeof chatRef.metadata?.customerCompany === 'string'
      ? (chatRef.metadata.customerCompany as string)
      : undefined
  const customerEmail =
    typeof chatRef.metadata?.customerEmail === 'string'
      ? (chatRef.metadata.customerEmail as string)
      : undefined
  return (
    <HubspotTicketCard
      item={{
        id: chatRef.id,
        title: chatRef.title,
        preview: chatRef.preview,
        status,
        statusLabel,
        priority,
        customerCompany,
        customerEmail,
        url: chatRef.url ?? null,
        dateUpdated: chatRef.date ?? null,
      }}
      variant="compact"
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
    />
  )
}

function SlackChatCard({ chatRef, isNewTab }: { chatRef: ChatRef; isNewTab: boolean }) {
  const channelName =
    typeof chatRef.metadata?.channelName === 'string'
      ? (chatRef.metadata.channelName as string)
      : undefined
  return (
    <SlackMessageCard
      item={{
        id: chatRef.id,
        title: chatRef.title,
        preview: chatRef.preview,
        url: chatRef.url ?? null,
        dateUpdated: chatRef.date ?? null,
        channel: channelName,
      }}
      variant="compact"
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
    />
  )
}

function DataRoomDocChatCard({
  chatRef,
  baseRoute,
  chipBasePlatform,
  isNewTab,
}: {
  chatRef: ChatRef
  baseRoute?: string
  chipBasePlatform?: string
  isNewTab: boolean
}) {
  const path =
    typeof chatRef.metadata?.path === 'string' ? (chatRef.metadata.path as string) : undefined
  // Provenance label. NEVER fall back to "Data room" — that would
  // falsely label non-data-room content (openframe-docs, etc.) as
  // private investor material when `sourceRepo` is missing or
  // unrecognized. Generic "Document" is intentionally neutral so users
  // can't be misled about sensitivity / scope.
  const badgeText = chatRef.sourceRepo ? getSourceLabel(chatRef.sourceRepo) : 'Document'
  return (
    <DataRoomDocCard
      item={{
        id: chatRef.id,
        title: chatRef.title,
        preview: chatRef.preview ?? undefined,
        path,
        url: chatRef.url ?? null,
        sourceRepo: chatRef.sourceRepo ?? null,
        baseRoute,
        chipBasePlatform,
      }}
      badgeText={badgeText}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
    />
  )
}

function GenericFinancialChatCard({
  chatRef,
  badge,
  scheme,
  isNewTab,
}: {
  chatRef: ChatRef
  badge: string
  scheme: 'cyan' | 'warning' | 'success' | 'error' | 'default'
  isNewTab: boolean
}) {
  const facts = Array.isArray(chatRef.metadata?.facts)
    ? (chatRef.metadata!.facts as Array<{ label: string; value: string }>)
    : null
  const subtitle =
    typeof chatRef.metadata?.subtitle === 'string'
      ? (chatRef.metadata.subtitle as string)
      : null
  const anchorProps: GenericEntityCardAnchorProps | undefined = buildAnchorProps(
    chatRef.url,
    isNewTab,
  )
  return (
    <GenericEntityCard
      item={{
        id: chatRef.id,
        title: chatRef.title,
        subtitle,
        preview: chatRef.preview ?? null,
        url: chatRef.url ?? null,
        badge: { text: badge, scheme },
        facts,
        dateUpdated: chatRef.date ?? null,
      }}
      anchorProps={anchorProps}
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
            className="inline-flex items-center gap-1 text-[10px] leading-3 font-mono shrink-0 text-ods-text-secondary opacity-60 hover:opacity-100 hover:text-ods-text-primary transition-opacity"
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
}: {
  item: any
  chatRef: ChatRef
  buildProps: NonNullable<ChatCardDispatchExtras['buildProductReleaseCardProps']>
  isNewTab: boolean
}) {
  const releaseProps = buildProps(item)
  return (
    <ProductReleaseCard
      size="sm"
      title={item.title}
      summary={item.summary}
      version={item.version}
      {...releaseProps}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)}
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
}: {
  item: any
  chatRef: ChatRef
  isNewTab: boolean
}) {
  return (
    <CampaignCardAdmin
      campaign={item}
      anchorProps={buildAnchorProps(chatRef.url, isNewTab)!}
    />
  )
}

// =============================================================================
// CHAT_CARD_REGISTRY — single source of truth.
// =============================================================================

type ChatCardRegistryEntry =
  | {
      mode: 'no-fetch'
      label: string
      bareInline?: boolean
      displayAction?: boolean
      render: (chatRef: ChatRef, opts: ChatCardRenderOptions) => React.ReactNode
    }
  | {
      mode: 'fetch'
      label: string
      contentRefType: string
      displayAction?: boolean
      skeleton: () => React.ReactNode
      render: (item: any, chatRef: ChatRef, opts: ChatCardRenderOptions) => React.ReactNode
      /** Optional post-fetch URL synthesizer. When `chatRef.url` is null
       *  AFTER `resolveSourceRowCTA`, the loader runs this against the
       *  hydrated item to produce a fallback hub-internal URL (e.g.
       *  `/admin/campaigns/${item.id}` for marketing campaigns). Result
       *  is validated via `safeHref` before being attached to the
       *  resolved ref — so the wrapper sees a non-null `href`, the
       *  pre-computed `isNewTab` reflects the actual destination, and
       *  the click goes through `handleChatNavClick` (no silent
       *  bypass of embed-mode / close-on-nav). */
      fallbackHref?: (item: any) => string | null
    }

type FinancialBadgeScheme = 'cyan' | 'warning' | 'success' | 'error' | 'default'
interface FinancialBadgeConfig {
  label: string
  badge: string
  scheme?: FinancialBadgeScheme
}
const FINANCIAL_CARD_BADGES: Record<string, FinancialBadgeConfig> = {
  financial_kpi: { label: 'Financial KPI', badge: 'KPI', scheme: 'cyan' },
  cap_table: { label: 'Cap table entry', badge: 'Cap table', scheme: 'warning' },
  profit_loss: { label: 'P&L period', badge: 'P&L' },
  balance_sheet: { label: 'Balance sheet', badge: 'Balance sheet' },
  cash_flow: { label: 'Cash flow', badge: 'Cash flow' },
}
function financialRegistryEntries(): Record<string, ChatCardRegistryEntry> {
  const out: Record<string, ChatCardRegistryEntry> = {}
  for (const [docType, cfg] of Object.entries(FINANCIAL_CARD_BADGES)) {
    const scheme = cfg.scheme ?? 'default'
    out[docType] = {
      mode: 'no-fetch',
      label: cfg.label,
      render: (chatRef, opts) => (
        <GenericFinancialChatCard
          chatRef={chatRef}
          badge={cfg.badge}
          scheme={scheme}
          isNewTab={opts.isNewTab}
        />
      ),
    }
  }
  return out
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
  const out: Record<string, ChatCardRegistryEntry> = {}
  for (const [docType, cfg] of Object.entries(GITHUB_CARD_CONFIGS)) {
    out[docType] = {
      mode: 'no-fetch',
      label: cfg.label,
      render: (chatRef, opts) => (
        <GitHubChatCard chatRef={chatRef} kind={cfg.kind} isNewTab={opts.isNewTab} />
      ),
    }
  }
  return out
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
  const out: Record<string, ChatCardRegistryEntry> = {}
  for (const [docType, cfg] of Object.entries(PROGRAM_CARD_CONFIGS)) {
    out[docType] = {
      mode: 'fetch',
      label: cfg.label,
      contentRefType: cfg.contentRefType,
      skeleton: () => <ProgramCardSkeleton size="sm" />,
      render: (item, chatRef, opts) => {
        // Embedder-provided config wins; lib default fills in otherwise
        // so the compact card renders even without `extras`. See
        // `program-card-defaults.ts` for the rationale.
        const config =
          opts?.extras?.programConfigs?.[cfg.configKey] ??
          DEFAULT_PROGRAM_CONFIGS[cfg.configKey]
        return (
          <ProgramCard
            config={config}
            item={item as BaseProgramItem}
            size="sm"
            href={chatRef.url ?? ''}
            targetPlatform={chatRef.targetPlatform ?? null}
            {...newTabAnchorAttrs(opts.isNewTab)}
          />
        )
      },
    }
  }
  return out
}

type RoadmapCardType = 'roadmap_item' | 'delivery_item' | 'internal_task'
interface RoadmapEntryConfig {
  label: string
  cardType: RoadmapCardType
  contentRefType: string
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
  },
}
function roadmapRegistryEntries(): Record<string, ChatCardRegistryEntry> {
  const out: Record<string, ChatCardRegistryEntry> = {}
  for (const [docType, cfg] of Object.entries(ROADMAP_CARD_CONFIGS)) {
    out[docType] = {
      mode: 'fetch',
      label: cfg.label,
      contentRefType: cfg.contentRefType,
      skeleton: () => <RoadmapCardSkeleton size="sm" />,
      render: (item, chatRef, opts) => (
        <RoadmapCard
          item={item}
          href={chatRef.url ?? ''}
          targetPlatform={chatRef.targetPlatform ?? null}
          {...newTabAnchorAttrs(opts.isNewTab)}
          userVote={null}
          onVote={() => {}}
          size="sm"
          cardType={cfg.cardType}
        />
      ),
    }
  }
  return out
}

const CHAT_CARD_REGISTRY: Record<string, ChatCardRegistryEntry> = {
  // ───────── no-fetch: ChatRef carries everything ─────────
  ...githubRegistryEntries(),
  slack_message: {
    mode: 'no-fetch',
    label: 'Slack message',
    render: (chatRef, opts) => (
      <SlackChatCard chatRef={chatRef} isNewTab={opts.isNewTab} />
    ),
  },
  hubspot_ticket: {
    mode: 'no-fetch',
    label: 'HubSpot ticket',
    render: (chatRef, opts) => (
      <HubspotTicketChatCard chatRef={chatRef} isNewTab={opts.isNewTab} />
    ),
  },
  hubspot_ticket_anon: {
    mode: 'no-fetch',
    label: 'HubSpot ticket (anon)',
    render: (chatRef, opts) => (
      <HubspotTicketChatCard chatRef={chatRef} isNewTab={opts.isNewTab} />
    ),
  },
  hubspot_ticket_self: {
    mode: 'no-fetch',
    label: 'HubSpot ticket (self)',
    render: (chatRef, opts) => (
      <HubspotTicketChatCard chatRef={chatRef} isNewTab={opts.isNewTab} />
    ),
  },
  data_room_doc: {
    mode: 'no-fetch',
    label: 'Data-room doc',
    render: (chatRef, opts) => (
      <DataRoomDocChatCard
        chatRef={chatRef}
        baseRoute={opts?.baseRoute}
        chipBasePlatform={opts?.chipBasePlatform}
        isNewTab={opts.isNewTab}
      />
    ),
  },
  markdown: {
    mode: 'no-fetch',
    label: 'Doc page (markdown)',
    render: (chatRef, opts) => (
      <DataRoomDocChatCard
        chatRef={chatRef}
        baseRoute={opts?.baseRoute}
        chipBasePlatform={opts?.chipBasePlatform}
        isNewTab={opts.isNewTab}
      />
    ),
  },
  video: {
    mode: 'no-fetch',
    label: 'Video',
    bareInline: true,
    render: (chatRef) => <ChatInlineVideoPill chatRef={chatRef} />,
  },
  ...financialRegistryEntries(),

  // ───────── fetch: needs full row from list API ─────────
  blog_post: {
    mode: 'fetch',
    label: 'Blog post',
    contentRefType: 'blog_post_existing',
    skeleton: () => <BlogCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <BlogCard
        post={item}
        size="sm"
        href={chatRef.url ?? ''}
        targetPlatform={chatRef.targetPlatform ?? null}
        placeholderUrl={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
        {...newTabAnchorAttrs(opts.isNewTab)}
        hasEmbeddedVideo={chatRef.metadata?.hasEmbeddedVideo === true}
      />
    ),
  },
  case_study: {
    mode: 'fetch',
    label: 'Case study',
    contentRefType: 'case_study',
    skeleton: () => <CaseStudyCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <CaseStudyCard
        study={item}
        size="sm"
        href={chatRef.url ?? ''}
        targetPlatform={chatRef.targetPlatform ?? null}
        placeholderUrl={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
        {...newTabAnchorAttrs(opts.isNewTab)}
      />
    ),
  },
  customer_interview: {
    mode: 'fetch',
    label: 'Customer interview',
    contentRefType: 'customer_interview',
    skeleton: () => <CustomerInterviewCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <CustomerInterviewCard
        interview={item}
        size="sm"
        href={chatRef.url ?? ''}
        targetPlatform={chatRef.targetPlatform ?? null}
        placeholderUrl={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
        {...newTabAnchorAttrs(opts.isNewTab)}
      />
    ),
  },
  product_release: {
    mode: 'fetch',
    label: 'Product release',
    contentRefType: 'product_release',
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
        />
      )
    },
  },
  ...programRegistryEntries(),
  investor_update: {
    mode: 'fetch',
    label: 'Investor update',
    contentRefType: 'investor_update',
    skeleton: () => <InvestorUpdateCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <InvestorUpdateCard
        update={item}
        size="sm"
        href={chatRef.url ?? ''}
        targetPlatform={chatRef.targetPlatform ?? null}
        placeholderUrl={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
        {...newTabAnchorAttrs(opts.isNewTab)}
      />
    ),
  },
  onboarding_guide: {
    mode: 'fetch',
    label: 'Onboarding guide',
    contentRefType: 'onboarding_guide',
    displayAction: true,
    skeleton: () => <OnboardingGuideCardSkeleton size="sm" />,
    render: (item, chatRef, opts) => (
      <OnboardingGuideCard
        guide={item}
        size="sm"
        href={chatRef.url ?? ''}
        targetPlatform={chatRef.targetPlatform ?? null}
        placeholderUrl={opts?.extras?.buildOgPlaceholderUrl?.(item?.title ?? '') ?? null}
        {...newTabAnchorAttrs(opts.isNewTab)}
      />
    ),
  },
  marketing_campaign: {
    mode: 'fetch',
    label: 'Marketing campaign',
    contentRefType: 'marketing_campaign',
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
      {
        baseRoute,
        chipBasePlatform,
        currentPlatform: runtime.source,
      },
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
  const fetchEntry = entry && entry.mode === 'fetch' ? entry : null
  const { item, isLoading } = useChatCardItem<any>(
    fetchEntry?.contentRefType ?? '',
    fetchEntry ? resolvedChatRef.id : '',
  )
  if (!entry) return null

  // Apply per-type fallback URL AFTER fetch (e.g. campaign → /admin/...).
  // We mutate `resolvedChatRef.url` BEFORE computing isNewTab so the
  // wrapper's interceptor sees the destination the user will actually
  // visit. `safeHref` blocks `javascript:` / `data:` payloads even
  // though the registry callers compose hub-internal strings today.
  const finalChatRef: ChatRef =
    fetchEntry && !resolvedChatRef.url && item && fetchEntry.fallbackHref
      ? {
          ...resolvedChatRef,
          url: safeHref(fetchEntry.fallbackHref(item)),
        }
      : resolvedChatRef

  // Pre-compute new-tab decision ONCE here (the same rule chips use).
  // Render branches that pass `target` / `rel` to their card pull this
  // via `renderOpts.isNewTab` so the inner `<a>` agrees with the
  // runtime nav decision in `ChatCardNavWrap` + `handleChatNavClick`.
  const isNewTab = computeIsNewTab(runtime, finalChatRef.url, finalChatRef.targetPlatform ?? null)
  const renderOpts: ChatCardRenderOptions = { baseRoute, chipBasePlatform, extras, isNewTab }

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
  if (entry.mode === 'no-fetch') {
    // Synthetic-ref gate. `chat-message-enhanced.tsx` builds a minimal
    // `{ type, id, title: cardId, url: null }` ChatRef when the LLM
    // emits `[card://<type>:<id>]` for an id the server did NOT
    // surface (refs map miss) — typically an LLM hallucination of a
    // composite/invented UUID. EVERY real ref carries `sourceRepo`
    // (set by `buildChatRefFromRow` via `config.id` AND by
    // `synthesizeVideoRefs` via `EMBEDDED_VIDEO_SOURCE_REPO`), so a
    // missing `sourceRepo` is a reliable synthetic-ref signal.
    //
    // Returning null here triggers the bare-cardId fallback span in
    // chat-message-enhanced's `<a card://...>` override — the
    // documented "VISIBLE breakage" behavior. Without this gate, a
    // hallucinated marker like `[card://markdown:f18945f8-<real-uuid>]`
    // renders a `DataRoomDocChatCard` with the generic "Document"
    // badge AND the fake id as the title — which the user can't tell
    // apart from a real card (the entire point of the fallback
    // comment block in chat-message-enhanced.tsx).
    //
    // Fetch-mode types already handle this gracefully: a synthetic
    // id leads to a fetch miss → `!item` → null at line ~1034.
    if (!finalChatRef.sourceRepo) return null
    if (entry.bareInline) {
      return navWrap(entry.render(finalChatRef, renderOpts))
    }
    return (
      <ChatCardWithDiscuss
        chatRef={finalChatRef}
        onDiscuss={onDiscuss}
        onDisplay={onDisplay}
        displayAction={entry.displayAction}
      >
        {navWrap(entry.render(finalChatRef, renderOpts))}
      </ChatCardWithDiscuss>
    )
  }
  if (isLoading) return <>{entry.skeleton()}</>
  if (!item) return null
  return (
    <ChatCardWithDiscuss
      chatRef={finalChatRef}
      onDiscuss={onDiscuss}
      onDisplay={onDisplay}
      displayAction={entry.displayAction}
    >
      {navWrap(entry.render(item, finalChatRef, renderOpts))}
    </ChatCardWithDiscuss>
  )
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
  const m = chatRef.metadata ?? {}
  const hasVideo =
    (typeof m.videoUrl === 'string' && (m.videoUrl as string).length > 0) ||
    (typeof m.youtubeUrl === 'string' && (m.youtubeUrl as string).length > 0) ||
    (typeof m.highlightVideoUrl === 'string' && (m.highlightVideoUrl as string).length > 0)

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

  if (hasVideo) {
    return (
      <BlockCard inline={loader}>
        <ChatVideoEntityCard chatRef={chatRef} />
      </BlockCard>
    )
  }

  return loader
}

// =============================================================================
// NavLink wiring for callers that need to compose anchors (Task 2 + Task 3)
// =============================================================================

/** Re-export so call sites can wrap any subtree with chat-runtime
 *  routing in a single import. */
export { NavLinkAnchorViaRuntime }
