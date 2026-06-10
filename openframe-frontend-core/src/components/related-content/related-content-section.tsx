"use client";

/**
 * RelatedContentSection
 *
 * Renders content references grouped by type using the canonical card
 * components. MOVED from the hub (`components/shared/related-content-card.tsx`)
 * so any consuming app can embed it; the hub keeps a thin wrapper that
 * pre-binds its host-specific injections (nav hook, URL recomposition,
 * program configs, admin campaign card).
 *
 * THREE data modes (precedence top-down):
 *   1. CONTROLLED — `contentRefs` provided (even `[]`): render exactly those
 *      refs, no suggestion fetch (the original investor-update behavior).
 *   2. SUGGESTION — `entityType` + `entityId` provided: self-fetch
 *      `GET {apiBaseUrl}/api/related-content?entityType&entityId[&count][&excludeTypes]`
 *      (the generic 5-tier engine's second web service). `minResults` maps to
 *      `count`; absent → param not sent (server default applies). Each ref
 *      carries a `reason` (data-only — never rendered, matching the
 *      FaqSection/FaqWithReason precedent).
 *   3. SSR-HYDRATED suggestion — also pass `initialItems` (the server page
 *      called the engine directly); the first client fetch is skipped per the
 *      `useSelfFetch` initialData contract.
 *
 * Group layout (list vs grid) + card size (lg vs default) come from
 * `CONTENT_REF_GROUPS` in `../../utils/content-ref-groups` — single source of
 * truth, no per-type logic in this file. Skeletons come from
 * `renderSkeletonForType` so the placeholder height matches the loaded card
 * exactly (zero layout shift on resolve).
 *
 * One API call per content type via the shared list-URL builder
 * (`buildListUrl` — injectable; defaults to the lib's byte-parity-tested
 * builder prefixed with `apiBaseUrl`). Fetching uses `useSelfFetch` (plain
 * fetch, NO react-query) so third-party embedders need no QueryClientProvider;
 * cards are imported via DEEP module paths (not the chat barrel) so this
 * chunk never reaches `@tanstack/react-query`.
 *
 * LOCKSTEP NOTE: this file's per-type card/skeleton dispatch is the SIZED
 * sibling of the chat-side `CHAT_CARD_REGISTRY` (`../chat/entity-cards/
 * dispatch.tsx`), which renders compact `size='sm'` cards wired to the chat
 * runtime. Two dispatchers by design — when registering a new fetch-mode
 * content type, add it BOTH there and here (cards + skeleton + list URL).
 */

import React, { useMemo } from 'react';
import {
  CONTENT_REF_GROUPS,
  getContentRefLabelOrTitleCase,
  orderContentRefTypes,
  type ContentRefGroupConfig,
} from '../../utils/content-ref-groups';
import type { ContentRef, ContentRefWithReason } from '../../types/content-ref';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import { extractItems } from '../../utils/extract-items';
import { buildListUrl as libBuildListUrl, canonicalContentRefType } from '../../utils/list-url';
import { buildSuggestionUrl } from '../../utils/suggestion-url';
import { decideNewTab } from '../chat/utils/decide-new-tab';
// DEEP card imports — NOT the `../chat` barrel (the barrel statically reaches
// @tanstack/react-query via embeddable-chat + its hooks). Deep paths keep this
// component's SOURCE graph react-query-free. Note: tsup's shared-chunk
// splitting may still colocate the cards with chat hooks in one dist chunk
// (react-query is a required peerDep, so resolution always succeeds) — the
// guarantee that matters here is the RUNTIME one: nothing on this path ever
// instantiates a QueryClient, so embedders need NO QueryClientProvider.
import { BlogCard, BlogCardSkeleton } from '../chat/entity-cards/blog-card';
import { CaseStudyCard, CaseStudyCardSkeleton } from '../chat/entity-cards/case-study-card';
import { CustomerInterviewCard, CustomerInterviewCardSkeleton } from '../chat/entity-cards/customer-interview-card';
import { ProductReleaseCard, ProductReleaseCardSkeleton } from '../chat/entity-cards/product-release-card';
import { buildProductReleaseCardProps } from '../chat/entity-cards/product-release-card-defaults';
import { ProgramCard, ProgramCardSkeleton } from '../chat/entity-cards/program-card';
import { InvestorUpdateCard, InvestorUpdateCardSkeleton } from '../chat/entity-cards/investor-update-card';
import { OnboardingGuideCard, OnboardingGuideCardSkeleton } from '../chat/entity-cards/onboarding-guide-card';
import { RoadmapCard, RoadmapCardSkeleton } from '../chat/entity-cards/roadmap-card';
// Type-only — erased at build, no runtime dependency on the dispatch module.
import type { ChatCardDispatchExtras } from '../chat/entity-cards/dispatch';

type CardSize = 'lg' | 'default' | 'sm';

/** Anchor prop bundle the per-card link surface receives — same shape the
 *  hub's `useNavLink` returns and the chat dispatcher's anchor builders
 *  produce. `null` = non-anchor mode (no URL). */
export interface CardLinkAnchorProps {
  href: string;
  target?: '_blank';
  rel?: 'noopener noreferrer';
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

/** Render-prop component injection for the navigation decision — keeps hook
 *  calls legal (hooks live INSIDE the injected component; `CardForType`
 *  itself calls zero hooks). The hub injects a `useNavLink`-backed provider;
 *  the default is hook-free (pure `decideNewTab`). MUST be defined at module
 *  scope by hosts — an inline arrow would remount every card each render. */
export interface CardLinkProviderProps {
  href: string | null;
  targetPlatform: string | null;
  children: (linkProps: CardLinkAnchorProps | null) => React.ReactElement | null;
}
export type CardLinkProvider = React.ComponentType<CardLinkProviderProps>;

/** Default link provider for standalone embeds: relative/-same-origin hrefs
 *  stay same-tab, cross-origin pops a new tab (pure `decideNewTab` with no
 *  platform context — `currentSource: ''` falls through to the origin
 *  check). No router integration, no hooks. */
function DefaultLinkPropsProvider({ href, targetPlatform, children }: CardLinkProviderProps): React.ReactElement | null {
  if (!href) return children(null);
  const newTab = decideNewTab({ href, targetPlatform, currentSource: '' });
  return children(
    newTab
      ? { href, target: '_blank', rel: 'noopener noreferrer' }
      : { href },
  );
}

/** Default href resolution: trust the ref's stored url/targetPlatform as the
 *  API composed them. The hub overrides this with its `buildContentURL`
 *  re-composition so dev gets localhost and prod gets platform domains. */
function defaultResolveHref(ref: ContentRef): { href: string | null; targetPlatform: string | null } {
  return { href: ref.url || null, targetPlatform: ref.targetPlatform ?? null };
}

/** Host-injected renderer pair for the admin-only `marketing_campaign` type.
 *  Absent (every non-hub embed) → the type renders nothing (its list URL
 *  hits `/api/admin`, unreachable outside the hub anyway). */
export interface AdminCampaignCardSlot {
  Card: React.ComponentType<{ campaign: any }>;
  Skeleton: React.ComponentType<{ size?: 'default' | 'sm' }>;
}

/**
 * Per-type skeleton dispatch — returns the SAME colocated skeleton the
 * resolved card renders, sized to match (zero layout shift on resolve).
 * The chat-side `CHAT_CARD_REGISTRY` already does this via
 * `entry.skeleton()`; this surface exposes the same discipline to the
 * related-content rail.
 */
function renderSkeletonForType(
  type: string,
  size: CardSize,
  adminCampaignCard?: AdminCampaignCardSlot,
): React.ReactNode {
  // Most card skeletons accept only `{default, sm}`. `'lg'` collapses to
  // `'default'`. ProductReleaseCardSkeleton uses lg/sm pair.
  const legacySize: 'default' | 'sm' = size === 'sm' ? 'sm' : 'default';
  switch (type) {
    case 'blog_post_existing':
      return <BlogCardSkeleton size={legacySize} />;
    case 'case_study':
      return <CaseStudyCardSkeleton size={legacySize} />;
    case 'customer_interview':
      return <CustomerInterviewCardSkeleton size={legacySize} />;
    case 'product_release':
      return <ProductReleaseCardSkeleton size={size === 'sm' ? 'sm' : 'lg'} />;
    case 'podcast':
    case 'webinar':
    case 'event':
      return <ProgramCardSkeleton size={legacySize} />;
    case 'investor_update':
      return <InvestorUpdateCardSkeleton size={legacySize} />;
    case 'onboarding_guide':
      // The rich catalog variant (hero + author grid, clamped description) —
      // the step-numbered 'default' variant is for the guide detail page's
      // "More in section" rail, not this full-width row.
      return <OnboardingGuideCardSkeleton size={size === 'sm' ? 'sm' : 'catalog'} />;
    case 'marketing_campaign':
      return adminCampaignCard ? <adminCampaignCard.Skeleton size={legacySize} /> : null;
    case 'roadmap_item':
    case 'delivery_item':
    case 'internal_task':
      return <RoadmapCardSkeleton size={legacySize} />;
    default:
      return null;
  }
}

/**
 * Per-type card dispatch — renders the right card with the right size.
 * Sized cards (`'lg'` / `'default'`) are unique to this rail — the chat
 * dispatcher only renders `'sm'`, so we go directly through the per-type
 * cards here.
 *
 * PURE FUNCTION COMPONENT WITH ZERO HOOK CALLS: the placeholder comes from a
 * plain `extras.buildOgPlaceholderUrl` call (the chat `dispatch.tsx`
 * pattern) and the anchor-prop bundle arrives via the `LinkProvider`
 * render-prop from the parent — so per-card hook legality is owned by the
 * injected provider component, not by this switch.
 *
 * `href` comes from the host's `resolveHref(ref)` (hub: live
 * `buildContentURL` recomposition; default: the ref's stored url).
 */
function CardForType({
  type,
  item,
  size,
  href,
  targetPlatform,
  linkProps,
  extras,
  adminCampaignCard,
}: {
  type: string;
  item: any;
  contentRef: ContentRef;
  size: CardSize;
  href: string;
  targetPlatform: string | null;
  linkProps: CardLinkAnchorProps | null;
  extras?: ChatCardDispatchExtras;
  adminCampaignCard?: AdminCampaignCardSlot;
}): React.ReactNode {
  // Most card variants accept only `{default, sm}`. `'lg'` collapses to
  // `'default'` for those. ProductReleaseCard uses its own lg/sm pair.
  const legacySize: 'default' | 'sm' = size === 'sm' ? 'sm' : 'default';
  // OG placeholder URL — injected into the pure-presentation cards so they
  // render a branded fallback when the row's featured image is null. Plain
  // function call (NOT a hook). Title is the universal field across all card
  // item shapes used here.
  const placeholderUrl =
    extras?.buildOgPlaceholderUrl?.((item?.title as string | undefined) ?? '') ?? undefined;

  // Top-level target/rel for cards that take them as separate props
  // (BlogCard, CaseStudyCard, …). ProductReleaseCard takes the bundle as a
  // single `anchorProps={...}` and uses `linkProps` directly. When the host
  // didn't surface a URL, `linkProps` is null and the card stays in
  // non-anchor mode.
  const anchorAttrs: Pick<CardLinkAnchorProps, 'target' | 'rel'> = linkProps
    ? { target: linkProps.target, rel: linkProps.rel }
    : {};

  switch (type) {
    case 'blog_post_existing':
      return <BlogCard post={item} size={legacySize} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />;
    case 'case_study':
      return <CaseStudyCard study={item} size={legacySize} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />;
    case 'customer_interview':
      return <CustomerInterviewCard interview={item} size={legacySize} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />;
    case 'product_release': {
      // Anchor-prop pattern: build product-release lg-variant props from the
      // shared `buildProductReleaseCardProps` so this rail and the /releases
      // catalog page render byte-identically. The card wraps in
      // `<a {...anchorProps}>` ONLY when `anchorProps.href` is set — pass
      // `undefined` (not an empty object) when href is empty so the card
      // stays in non-anchor mode without rendering a dead <a> tag.
      const releaseSize = size === 'sm' ? 'sm' : 'lg';
      const buildReleaseProps = extras?.buildProductReleaseCardProps ?? buildProductReleaseCardProps;
      const releaseProps = buildReleaseProps(item);
      return (
        <ProductReleaseCard
          size={releaseSize}
          title={item.title}
          summary={item.summary}
          version={item.version}
          {...releaseProps}
          anchorProps={linkProps ?? undefined}
        />
      );
    }
    case 'podcast':
      return extras?.programConfigs?.podcast
        ? <ProgramCard config={extras.programConfigs.podcast} item={item} size={legacySize} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />
        : null;
    case 'webinar':
      return extras?.programConfigs?.webinar
        ? <ProgramCard config={extras.programConfigs.webinar} item={item} size={legacySize} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />
        : null;
    case 'event':
      return extras?.programConfigs?.event
        ? <ProgramCard config={extras.programConfigs.event} item={item} size={legacySize} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />
        : null;
    case 'investor_update':
      return <InvestorUpdateCard update={item} size={legacySize} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />;
    case 'onboarding_guide':
      // Catalog variant (see skeleton note) — full-width rich card with a
      // line-clamped description instead of the step-numbered rail card.
      return <OnboardingGuideCard guide={item} size={size === 'sm' ? 'sm' : 'catalog'} href={href} targetPlatform={targetPlatform} placeholderUrl={placeholderUrl} {...anchorAttrs} />;
    case 'marketing_campaign':
      return adminCampaignCard ? <adminCampaignCard.Card campaign={item} /> : null;
    case 'roadmap_item':
    case 'delivery_item':
    case 'internal_task':
      return (
        <RoadmapCard
          item={item}
          href={href ?? ''}
          targetPlatform={targetPlatform}
          userVote={null}
          onVote={() => {}}
          size={legacySize}
          cardType={type as 'roadmap_item' | 'delivery_item' | 'internal_task'}
          {...anchorAttrs}
        />
      );
    default:
      return null;
  }
}

// =============================================================================
// Fetch all items for a type in ONE server-sorted call, via the injectable
// list-URL builder. `useSelfFetch` (URL = cache key) replaces the hub's old
// react-query usage: `enabled` ≙ `url === null`, `!res.ok`/network error ≙
// `error → items null → group renders nothing`. Accepted deltas vs
// react-query: no retry/backoff, no focus refetch, no cross-mount cache.
// =============================================================================

function useGroupItems(
  type: string,
  refs: ContentRef[],
  buildUrl: (type: string, ids: string[]) => string | null,
) {
  const ids = refs.map((r) => r.id);
  const url = ids.length > 0 ? buildUrl(type, ids) : null;
  const { data, isLoading } = useSelfFetch<unknown>(url);
  const items = data != null ? extractItems(data) : null;
  return { items, isLoading };
}

// =============================================================================
// Per-group renderer — one API call, server-sorted, then render cards via the
// dispatcher with per-type skeletons + per-type layout from CONTENT_REF_GROUPS.
// =============================================================================

/** Map columns prop → tailwind grid class. Only consulted for grid-layout
 *  groups; list-layout groups stack vertically. */
function gridClassFor(columns: 2 | 3): string {
  return columns === 3
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-6';
}

/** Resolve the group config for a type, falling back to a grid layout with
 *  the default card size for unregistered types so the section still renders
 *  rather than silently dropping them. The `label` field on the fallback is
 *  intentionally a placeholder — the section heading goes through
 *  `getContentRefLabelOrTitleCase(type)` instead so cross-surface labels
 *  stay consistent between this rail and the investor-email builder. */
function resolveGroupConfig(type: string): ContentRefGroupConfig {
  return CONTENT_REF_GROUPS[type] ?? {
    label: type,
    order: 999,
    layout: 'grid',
    gridSize: 'default',
  };
}

function ContentGroup({
  type,
  refs,
  columns,
  buildUrl,
  resolveHref,
  LinkProvider,
  extras,
  adminCampaignCard,
}: {
  type: string;
  refs: ContentRef[];
  columns: 2 | 3;
  buildUrl: (type: string, ids: string[]) => string | null;
  resolveHref: (ref: ContentRef) => { href: string | null; targetPlatform: string | null };
  LinkProvider: CardLinkProvider;
  extras?: ChatCardDispatchExtras;
  adminCampaignCard?: AdminCampaignCardSlot;
}) {
  const { items, isLoading } = useGroupItems(type, refs, buildUrl);
  const config = resolveGroupConfig(type);
  const isListLayout = config.layout === 'list';
  const cardSize = config.gridSize;

  // Skeleton gate: `isLoading && !items` — SSR HTML and the client's first
  // paint render identical skeletons (useSelfFetch starts isLoading=true on
  // both sides), and once items exist they are never replaced by skeletons.
  if (isLoading && !items) {
    const skeletons = refs.map((r) => (
      <div key={r.id}>{renderSkeletonForType(type, cardSize, adminCampaignCard)}</div>
    ));
    return isListLayout ? (
      <div className="space-y-4">{skeletons}</div>
    ) : (
      <div className={gridClassFor(columns)}>{skeletons}</div>
    );
  }

  if (!items || items.length === 0) return null;

  // Index fetched rows by id, then render in REF order — refs carry the
  // intended sequence (suggestion mode: the engine's tier order, so
  // same-platform/tag-matched items lead; controlled mode: the curated
  // display_order). The list APIs return rows date-sorted, which would
  // otherwise scramble that ordering (same-platform items sinking below
  // newer cross-platform ones).
  const itemById = new Map((items as any[]).map((it) => [String(it.id), it]));

  const cards = refs
    .map((contentRef) => {
      const itemId = String(contentRef.id);
      const item = itemById.get(itemId);
      if (!item) return null;
      // Re-compose the URL via the host's resolver (hub: buildContentURL so
      // dev gets localhost and prod the right platform domain; default: the
      // ref's stored url as the API composed it).
      const resolved = resolveHref(contentRef);
      const href = resolved.href ?? '';
      const targetPlatform = resolved.targetPlatform ?? contentRef.targetPlatform ?? null;
      return (
        <div key={itemId}>
          <LinkProvider href={href || null} targetPlatform={targetPlatform}>
            {(linkProps) => (
              <CardForType
                type={type}
                item={item}
                contentRef={contentRef}
                size={cardSize}
                href={href}
                targetPlatform={targetPlatform}
                linkProps={linkProps}
                extras={extras}
                adminCampaignCard={adminCampaignCard}
              />
            )}
          </LinkProvider>
        </div>
      );
    })
    .filter(Boolean);

  if (cards.length === 0) return null;

  return isListLayout ? (
    <div className="space-y-4">{cards}</div>
  ) : (
    <div className={gridClassFor(columns)}>{cards}</div>
  );
}

// =============================================================================
// Main component
// =============================================================================

interface RelatedContentResponse {
  refs: ContentRefWithReason[];
}

export interface RelatedContentSectionProps {
  /** CONTROLLED mode (the original behavior). When defined — even `[]` — no
   *  suggestion fetch runs and exactly these refs render. */
  contentRefs?: ContentRef[];
  /** SUGGESTION mode (with `entityId`): self-fetch suggestions for this host
   *  entity from `{apiBaseUrl}/api/related-content`. Ignored when
   *  `contentRefs` is provided. */
  entityType?: string;
  entityId?: number | string;
  /** Maps to the suggestion API's `count` param — the PER-TYPE fill target
   *  for every candidate type EXCEPT the host's own. Absent → param not sent
   *  (server default applies). */
  minResults?: number;
  /** Maps to the suggestion API's `sameTypeCount` param — the budget for the
   *  candidate type MATCHING the host's own `entityType` (same-type boost:
   *  a blog post's rail leads with more blog posts). Absent → param not
   *  sent (host's type uses the server's `count`). */
  sameTypeMinResults?: number;
  /** SSR hydrate for suggestion mode — the server page ran the engine and
   *  drills the refs here; the first client fetch is skipped (useSelfFetch
   *  initialData contract). */
  initialItems?: ContentRefWithReason[];
  /** Section title (default: "Related Content") */
  title?: string;
  /**
   * Grid columns at desktop. 2 = denser cards / wider summary (original
   * investor-update layout); 3 = more cards per row for dashboards.
   * Only consulted for grid-layout groups. Default: 2.
   */
  columns?: 2 | 3;
  /**
   * ContentRef.type values to exclude. Honored in ALL modes — controlled
   * mode post-filters (original behavior); suggestion mode ALSO forwards the
   * list verbatim as the API's `excludeTypes=` param so excluded types never
   * consume engine fill slots (`minResults` stays honored). The subtraction
   * happens SERVER-side — this component never mirrors the hub's candidate
   * list.
   */
  excludeTypes?: string[];
  /** Fetch-URL prefix for third-party embeds / reverse proxies
   *  ('' = same-origin). Applied to BOTH the suggestion fetch and the
   *  default per-group list fetches. */
  apiBaseUrl?: string;
  /** Host injection bundle — REUSES the chat dispatcher's
   *  `ChatCardDispatchExtras` (programConfigs, buildOgPlaceholderUrl,
   *  buildProductReleaseCardProps override). Program groups render nothing
   *  when their config is absent. */
  extras?: ChatCardDispatchExtras;
  /** Hub injects its `buildContentURL` recomposition; default uses the
   *  ref's stored `url`/`targetPlatform` as the API composed them. */
  resolveHref?: (ref: ContentRef) => { href: string | null; targetPlatform: string | null };
  /** Hub injects its registry-driven entity-list-api builder; default = the
   *  lib's `buildListUrl(type, ids, apiBaseUrl)`. */
  buildListUrl?: (type: string, ids: string[]) => string | null;
  /** Hub injects a `useNavLink`-backed render-prop provider; default = pure
   *  anchor via `decideNewTab`. MUST be a module-scope component. */
  LinkProvider?: CardLinkProvider;
  /** Renderer pair for the admin-only `marketing_campaign` type. Absent →
   *  the type renders nothing. */
  adminCampaignCard?: AdminCampaignCardSlot;
}

export function RelatedContentSection({
  contentRefs,
  entityType,
  entityId,
  minResults,
  sameTypeMinResults,
  initialItems,
  title = 'Related Content',
  columns = 2,
  excludeTypes,
  apiBaseUrl = '',
  extras,
  resolveHref = defaultResolveHref,
  buildListUrl,
  LinkProvider = DefaultLinkPropsProvider,
  adminCampaignCard,
}: RelatedContentSectionProps) {
  // ── Hooks above EVERY early return (the original `if (!contentRefs.length)
  // return null` guard moved below them). ──

  // Suggestion-mode fetch URL — null in controlled mode (contentRefs defined,
  // even []) or when the entity scope is incomplete.
  const suggestUrl =
    contentRefs === undefined && entityType && entityId !== undefined && entityId !== null && entityId !== ''
      ? buildSuggestionUrl('/api/related-content', {
          apiBaseUrl,
          entityType,
          entityId,
          count: minResults,
          extraParams: {
            sameTypeCount: sameTypeMinResults !== undefined ? String(sameTypeMinResults) : undefined,
            excludeTypes: excludeTypes && excludeTypes.length > 0 ? excludeTypes.join(',') : undefined,
          },
        })
      : null;
  // Memoize the initialData wrapper — useSelfFetch re-syncs on [initialData],
  // and a fresh per-render object would loop setState under re-rendering
  // parents (the latent FaqSection bug, fixed there in the same change).
  const initialData = useMemo<RelatedContentResponse | undefined>(
    () => (initialItems ? { refs: initialItems } : undefined),
    [initialItems],
  );
  const { data } = useSelfFetch<RelatedContentResponse>(suggestUrl, { initialData });

  // Default group fetcher: the lib's byte-parity-tested builder, prefixed for
  // embeds. Memoized so group-fetch URLs stay value-stable across renders.
  const effectiveBuildListUrl = useMemo(
    () => buildListUrl ?? ((type: string, ids: string[]) => libBuildListUrl(type, ids, apiBaseUrl)),
    [buildListUrl, apiBaseUrl],
  );

  const refs: ContentRef[] = contentRefs ?? data?.refs ?? [];

  // Per-consumer type gating — drops refs whose `type` is in the exclude
  // list. In suggestion mode the server already subtracted these (the param
  // is forwarded above); the client filter stays as an idempotent guard and
  // IS the mechanism in controlled mode (original behavior).
  const exclude = new Set(excludeTypes || []);
  const visibleRefs = exclude.size > 0 ? refs.filter((r) => !exclude.has(r.type)) : refs;
  // Zero refs (still loading in suggestion mode, or genuinely empty) → no
  // empty shell.
  if (!visibleRefs.length) return null;

  const grouped: Record<string, ContentRef[]> = {};
  for (const ref of visibleRefs) {
    if (!grouped[ref.type]) grouped[ref.type] = [];
    grouped[ref.type].push(ref);
  }

  // Registered types in CONTENT_REF_GROUPS order, then any unregistered
  // types appended (same shape the investor-email builder uses — both
  // consume `orderContentRefTypes` so cross-surface ordering matches).
  // SAME-TYPE FIRST: when a host entityType is known (suggestion / SSR
  // modes), its own content-type group is hoisted to the top — a blog
  // post's rail leads with blog posts. Rail group keys are compared via
  // the shared alias canonicalizer (blog_post_existing ↔ blog_post).
  let orderedTypes = orderContentRefTypes(Object.keys(grouped));
  if (entityType) {
    const sameType = orderedTypes.filter((t) => canonicalContentRefType(t) === entityType);
    if (sameType.length > 0) {
      orderedTypes = [...sameType, ...orderedTypes.filter((t) => canonicalContentRefType(t) !== entityType)];
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-ods-text-primary">{title}</h2>
      {orderedTypes.map((type) => (
        <div key={type} className="space-y-4">
          <h3 className="font-['Azeret_Mono'] text-[14px] font-semibold uppercase text-ods-text-secondary tracking-wider">
            {getContentRefLabelOrTitleCase(type)}
          </h3>
          <ContentGroup
            type={type}
            refs={grouped[type]}
            columns={columns}
            buildUrl={effectiveBuildListUrl}
            resolveHref={resolveHref}
            LinkProvider={LinkProvider}
            extras={extras}
            adminCampaignCard={adminCampaignCard}
          />
        </div>
      ))}
    </div>
  );
}
