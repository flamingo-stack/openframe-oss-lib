'use client';

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
 * The per-type card + skeleton dispatch lives in `./card-registry`
 * (`RELATED_CARD_REGISTRY`): ONE entry per content type, each carrying that
 * type's own row type and the `unknown` → row decode, so a fetched row reaches
 * its card concretely typed. This file only picks the entry and builds the
 * shared render context.
 *
 * LOCKSTEP NOTE: that registry is the SIZED sibling of the chat-side
 * `CHAT_CARD_REGISTRY` (`../chat/entity-cards/dispatch.tsx`), which renders
 * compact `size='sm'` cards wired to the chat runtime. Two dispatchers by
 * design — when registering a new fetch-mode content type, add it BOTH there
 * and in `./card-registry` (card + skeleton + list URL).
 */

import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import type { ContentRef, ContentRefWithReason } from '../../types/content-ref';
import {
  CONTENT_REF_GROUPS,
  getContentRefLabelOrTitleCase,
  orderContentRefTypes,
  type ContentRefGroupConfig,
} from '../../utils/content-ref-groups';
import { extractItems, extractItemId } from '../../utils/extract-items';
import { buildListUrl as libBuildListUrl, canonicalContentRefType } from '../../utils/list-url';
import { pageCount } from '../../utils/search-params';
import { buildSuggestionUrl } from '../../utils/suggestion-url';
// Type-only — erased at build, no runtime dependency on the dispatch module.
import type { ChatCardDispatchExtras } from '../chat/entity-cards/dispatch';
import { decideNewTab } from '../chat/utils/decide-new-tab';
import { Pagination } from '../pagination';
// The per-type card dispatch — one registry entry per content type, each
// carrying its OWN row type — plus the DEEP card imports that keep this
// chunk's source graph free of @tanstack/react-query (the `../chat` barrel
// reaches it via embeddable-chat; deep paths don't). `CardSize` and
// `CardLinkAnchorProps` are declared alongside the registry, its primary
// consumer, and re-exported below so the subpath barrel is unchanged.
import {
  RELATED_CARD_REGISTRY,
  rowString,
  type CardLinkAnchorProps,
  type CardSize,
  type RelatedCardRegistryEntry,
} from './card-registry';

export type { CardLinkAnchorProps };

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
function DefaultLinkPropsProvider({
  href,
  targetPlatform,
  children,
}: CardLinkProviderProps): React.ReactElement | null {
  if (!href) return children(null);
  const newTab = decideNewTab({ href, targetPlatform, currentSource: '' });
  return children(newTab ? { href, target: '_blank', rel: 'noopener noreferrer' } : { href });
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
  /**
   * The host's own campaign card. Its `campaign` prop is a HOST row type this
   * lib cannot name (the hub's `MarketingCampaign`), and React props are
   * CONTRAVARIANT, so this is the one seam in the rail with no honest type.
   * All three alternatives were compiled against the hub's real
   * `CampaignCardAdmin`:
   *
   *   - `unknown` — the host can no longer inject: TS2322, "Type
   *     '{ campaign: unknown }' is not assignable to
   *     '{ campaign: MarketingCampaign }'".
   *   - `never` — every host component assigns, but the rail can no longer
   *     hand it a row: TS2769, "Type 'unknown' is not assignable to 'never'".
   *   - a generic on the slot's OWNER (`AdminCampaignCardSlot<TCampaign>`
   *     threaded through `RelatedContentSectionProps`) — inference from the
   *     host's card works, but the render still fails: TS2769, "'TCampaign'
   *     could be instantiated with an arbitrary type". The rail holds an
   *     unvalidated row; only the HOST knows how to narrow it.
   *
   * Typing this means changing the injection contract (a host-supplied
   * `render(row: unknown)` closure instead of a component), which is a
   * breaking change for every embedder that passes `{ Card, Skeleton }`.
   * Everything the rail renders ITSELF now goes through the per-type
   * `RELATED_CARD_REGISTRY`; this is the only `any` left.
   */
  Card: React.ComponentType<{ campaign: any }>;
  Skeleton: React.ComponentType<{ size?: 'default' | 'sm' }>;
}

/**
 * Per-type skeleton dispatch — returns the SAME colocated skeleton the
 * resolved card renders, sized to match (zero layout shift on resolve). One
 * lookup through `RELATED_CARD_REGISTRY`, exactly the way the chat-side
 * `CHAT_CARD_REGISTRY` does it via `entry.skeleton()`.
 *
 * `marketing_campaign` is the one type with no registry entry: BOTH its card
 * and its skeleton are host-injected (`AdminCampaignCardSlot`), so there is no
 * lib component to register.
 */
function renderSkeletonForType(
  type: string,
  size: CardSize,
  adminCampaignCard?: AdminCampaignCardSlot,
): React.ReactNode {
  if (type === 'marketing_campaign') {
    return adminCampaignCard ? <adminCampaignCard.Skeleton size={size === 'sm' ? 'sm' : 'default'} /> : null;
  }
  const entry: RelatedCardRegistryEntry | undefined = RELATED_CARD_REGISTRY[type];
  return entry ? entry.skeleton(size) : null;
}

/**
 * Per-type card dispatch — ONE lookup through `RELATED_CARD_REGISTRY`, whose
 * entries each pair a skeleton with a card renderer that closes over that
 * type's OWN row type. Sized cards (`'lg'` / `'default'`) are unique to this
 * rail; the chat dispatcher only renders `'sm'`.
 *
 * PURE FUNCTION COMPONENT WITH ZERO HOOK CALLS: the placeholder comes from a
 * plain `extras.buildOgPlaceholderUrl` call (the chat `dispatch.tsx`
 * pattern) and the anchor-prop bundle arrives via the `LinkProvider`
 * render-prop from the parent — so per-card hook legality is owned by the
 * injected provider component, not by this dispatcher.
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
  /** One fetched row, still unvalidated. Its shape is decided at RUNTIME by
   *  `type` (each group fetches from its own per-type list API), so it stays
   *  `unknown` right up to the registry entry for that type — which owns the
   *  `unknown` → row-type decode and hands its card a concretely typed row. */
  item: unknown;
  size: CardSize;
  href: string;
  targetPlatform: string | null;
  linkProps: CardLinkAnchorProps | null;
  extras?: ChatCardDispatchExtras;
  adminCampaignCard?: AdminCampaignCardSlot;
}): React.ReactNode {
  // Host-injected admin slot — the only type with no registry entry, because
  // both its card and its skeleton come from the host (see
  // `AdminCampaignCardSlot`). Handled before the lookup so the registry stays
  // a pure lib-card table.
  if (type === 'marketing_campaign') {
    return adminCampaignCard ? <adminCampaignCard.Card campaign={item} /> : null;
  }

  const entry: RelatedCardRegistryEntry | undefined = RELATED_CARD_REGISTRY[type];
  if (!entry) return null;

  return entry.render(item, {
    size,
    // Most card variants accept only `{default, sm}`. `'lg'` collapses to
    // `'default'` for those. ProductReleaseCard uses its own lg/sm pair.
    legacySize: size === 'sm' ? 'sm' : 'default',
    href,
    targetPlatform,
    linkProps,
    // Top-level target/rel for cards that take them as separate props
    // (BlogCard, CaseStudyCard, …). ProductReleaseCard takes the bundle as a
    // single `anchorProps={...}` and uses `linkProps` directly. When the host
    // didn't surface a URL, `linkProps` is null and the card stays in
    // non-anchor mode.
    anchorAttrs: linkProps ? { target: linkProps.target, rel: linkProps.rel } : {},
    // OG placeholder URL — injected into the pure-presentation cards so they
    // render a branded fallback when the row's featured image is null. Plain
    // function call (NOT a hook). Title is the universal field across all card
    // row shapes used here.
    // `item?.title as string | undefined` claimed a string without checking one:
    // a numeric title reached `buildOgPlaceholderUrl` as a number. `rowString`
    // makes the claim true.
    placeholderUrl: extras?.buildOgPlaceholderUrl?.(rowString(item, 'title') ?? '') ?? undefined,
    extras,
  });
}

// =============================================================================
// Fetch all items for a type in ONE server-sorted call, via the injectable
// list-URL builder. `useSelfFetch` (URL = cache key) replaces the hub's old
// react-query usage: `enabled` ≙ `url === null`, `!res.ok`/network error ≙
// `error → items null → group renders nothing`. Accepted deltas vs
// react-query: no retry/backoff, no focus refetch, no cross-mount cache.
// =============================================================================

function useGroupItems(type: string, refs: ContentRef[], buildUrl: (type: string, ids: string[]) => string | null) {
  const ids = refs.map(r => r.id);
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
  return (
    CONTENT_REF_GROUPS[type] ?? {
      label: type,
      order: 999,
      layout: 'grid',
      gridSize: 'default',
    }
  );
}

/** Items per page within one type group. Groups larger than this paginate
 *  with the standard Pagination control (NO nested scrolling — a bounded
 *  scrollbox inside the page traps wheel events and hides the sections
 *  below it). MUST stay at or above the largest suggestion fill
 *  (RELATED_SAME_TYPE_COUNT in the hub's lib/constants/suggestions.ts) so
 *  current rails never paginate — only genuinely big groups (author pages)
 *  do. Exported through the subpath barrel for the hub's module-load
 *  assertion of that relation (entity-suggestion-sections.tsx). */
export const GROUP_PAGE_SIZE = 12;

function ContentGroup({
  type,
  refs,
  columns,
  buildUrl,
  resolveHref,
  LinkProvider,
  extras,
  adminCampaignCard,
  heading,
}: {
  type: string;
  refs: ContentRef[];
  columns: 2 | 3;
  buildUrl: (type: string, ids: string[]) => string | null;
  resolveHref: (ref: ContentRef) => { href: string | null; targetPlatform: string | null };
  LinkProvider: CardLinkProvider;
  extras?: ChatCardDispatchExtras;
  adminCampaignCard?: AdminCampaignCardSlot;
  /** Group heading, rendered INSIDE the group so a group that resolves to
   *  nothing (fetch miss / unsupported type / missing program config) drops
   *  its heading too — no orphaned titles. */
  heading: React.ReactNode;
}) {
  const { items, isLoading } = useGroupItems(type, refs, buildUrl);
  const config = resolveGroupConfig(type);
  const isListLayout = config.layout === 'list';
  const cardSize = config.gridSize;

  // Per-group pagination for big groups (author pages): GROUP_PAGE_SIZE items
  // per page with the standard Pagination control below the group. Client-side
  // slicing — useGroupItems already fetched every row in one batched call, so
  // page flips are instant. Hooks live above every early return (file
  // convention). Page is clamped so a shrinking refs array (suggestion
  // refetch) can never strand the view past the last page, and RESET when the
  // ref set actually changes (shrink→grow must not return to a stale page).
  const [page, setPage] = useState(1);
  const refsKey = refs.map(r => r.id).join('|');
  const prevRefsKeyRef = useRef(refsKey);
  useEffect(() => {
    if (prevRefsKeyRef.current !== refsKey) {
      prevRefsKeyRef.current = refsKey;
      setPage(1);
    }
  }, [refsKey]);
  const totalGroupPages = pageCount(refs.length, GROUP_PAGE_SIZE);
  const safePage = Math.min(page, totalGroupPages);
  const visibleGroupRefs =
    refs.length > GROUP_PAGE_SIZE ? refs.slice((safePage - 1) * GROUP_PAGE_SIZE, safePage * GROUP_PAGE_SIZE) : refs;
  const groupPagination =
    totalGroupPages > 1 ? (
      <Pagination currentPage={safePage} totalPages={totalGroupPages} onPageChange={setPage} />
    ) : null;

  // Skeleton gate: `isLoading && !items` — SSR HTML and the client's first
  // paint render identical skeletons (useSelfFetch starts isLoading=true on
  // both sides), and once items exist they are never replaced by skeletons.
  if (isLoading && !items) {
    const skeletons = visibleGroupRefs.map(r => (
      <div key={r.id}>{renderSkeletonForType(type, cardSize, adminCampaignCard)}</div>
    ));
    return (
      <div className="space-y-4">
        {heading}
        {isListLayout ? (
          <div className="space-y-4">{skeletons}</div>
        ) : (
          <div className={gridClassFor(columns)}>{skeletons}</div>
        )}
      </div>
    );
  }

  if (!items || items.length === 0) return null;

  // Index fetched rows by id, then render in REF order — refs carry the
  // intended sequence (suggestion mode: the engine's tier order, so
  // same-platform/tag-matched items lead; controlled mode: the curated
  // display_order). The list APIs return rows date-sorted, which would
  // otherwise scramble that ordering (same-platform items sinking below
  // newer cross-platform ones).
  // Shared extractor (NOT raw `.id`) — some API shapes key items differently
  // (e.g. external_id types); raw access would silently drop valid items.
  const rowKey = (it: unknown): string => {
    const extracted = extractItemId(type, it);
    if (extracted !== null) return extracted;
    // Fallback for shapes `extractItemId` doesn't recognise — same
    // `String(it?.id)` the untyped version produced.
    return String(typeof it === 'object' && it !== null ? (it as { id?: unknown }).id : undefined);
  };
  const itemById = new Map(items.map(it => [rowKey(it), it]));

  const cards = visibleGroupRefs
    .map(contentRef => {
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
            {linkProps => (
              <CardForType
                type={type}
                item={item}
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

  if (cards.length === 0) {
    // Current PAGE resolved zero cards (rows deleted between the ref fetch
    // and the group fetch, or a stricter list-API gate dropped them). When a
    // pager exists the user must keep the controls to navigate back —
    // dropping the whole group would strand them. A genuinely empty group
    // (no pager) still vanishes with its heading.
    if (groupPagination) {
      return (
        <div className="space-y-4">
          {heading}
          {groupPagination}
        </div>
      );
    }
    return null;
  }

  return (
    <div className="space-y-4">
      {heading}
      {isListLayout ? <div className="space-y-4">{cards}</div> : <div className={gridClassFor(columns)}>{cards}</div>}
      {groupPagination}
    </div>
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
  /** AUTHOR mode: self-fetch ALL published content authored by this profile
   *  from `{apiBaseUrl}/api/related-content?authorId=…` (grouped per type,
   *  endless within each group). Ignored when `contentRefs` is provided;
   *  takes precedence over the entityType/entityId suggestion scope.
   *  SSR-hydrate via `initialItems`, same as suggestion mode. */
  authorId?: string;
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
  /**
   * SUGGESTION-mode allow-list (rail vocabulary): which content types
   * participate in this rail. Sent verbatim as the API's `types=` param —
   * the SERVER intersects it with its own allowed candidate set, and
   * platform policy gates (e.g. internal-only types) ALWAYS win: the client
   * cannot request its way past them. Absent → all server-side candidates.
   */
  includeTypes?: string[];
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
  /** When true, render the section shell (title + an empty-state line) even
   *  with ZERO refs, instead of returning null. Default false (the original
   *  behavior — empty rail = no shell). Opt-in per host page (e.g. people-hub's
   *  "What I Shipped", where the section should always be present). */
  showWhenEmpty?: boolean;
  /** Empty-state copy shown under the title when `showWhenEmpty` and no refs.
   *  Default: "No related content yet." */
  emptyStateText?: string;
  /** Custom empty-state node (e.g. a hub `<EmptyState/>`) rendered under the
   *  title when `showWhenEmpty` and there are no refs — overrides
   *  `emptyStateText`. Lets a host match its canonical empty state. */
  emptyState?: React.ReactNode;
}

export function RelatedContentSection({
  contentRefs,
  entityType,
  entityId,
  authorId,
  minResults,
  sameTypeMinResults,
  includeTypes,
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
  showWhenEmpty = false,
  emptyStateText = 'No related content yet.',
  emptyState,
}: RelatedContentSectionProps) {
  // ── Hooks above EVERY early return (the original `if (!contentRefs.length)
  // return null` guard moved below them). ──

  // Suggestion-mode fetch URL — null in controlled mode (contentRefs defined,
  // even []) or when the entity scope is incomplete.
  // `includeTypes: []` is an explicit "nothing participates" — skip the fetch
  // entirely (an empty-string `types=` param would be dropped by the URL
  // builder and read server-side as "all candidates") AND ignore SSR refs.
  const suggestionsDisabled = includeTypes?.length === 0;
  // Shared type-filter params — one spelling for both fetch modes so a future
  // normalization (trim/dedupe) can't diverge between them.
  const typeFilterParams = {
    types: includeTypes !== undefined ? includeTypes.join(',') : undefined,
    excludeTypes: excludeTypes && excludeTypes.length > 0 ? excludeTypes.join(',') : undefined,
  };
  // AUTHOR mode beats suggestion mode: when `authorId` is set the rail lists
  // everything that profile authored (the server returns ALL, no count).
  const authorUrl =
    contentRefs === undefined && authorId && !suggestionsDisabled
      ? buildSuggestionUrl('/api/related-content', {
          apiBaseUrl,
          extraParams: { authorId, ...typeFilterParams },
        })
      : null;
  const suggestUrl =
    authorUrl ??
    (contentRefs === undefined &&
    entityType &&
    entityId !== undefined &&
    entityId !== null &&
    entityId !== '' &&
    !suggestionsDisabled
      ? buildSuggestionUrl('/api/related-content', {
          apiBaseUrl,
          entityType,
          entityId,
          count: minResults,
          extraParams: {
            sameTypeCount: sameTypeMinResults !== undefined ? String(sameTypeMinResults) : undefined,
            ...typeFilterParams,
          },
        })
      : null);
  // Memoize the initialData wrapper — useSelfFetch re-syncs on [initialData],
  // and a fresh per-render object would loop setState under re-rendering
  // parents (the latent FaqSection bug, fixed there in the same change).
  const initialData = useMemo<RelatedContentResponse | undefined>(
    // An explicitly disabled rail (includeTypes: []) must ignore SSR-hydrated
    // refs too — otherwise useSelfFetch(null, {initialData}) keeps serving
    // initialItems and the "nothing participates" contract silently breaks.
    () => (!suggestionsDisabled && initialItems ? { refs: initialItems } : undefined),
    [initialItems, suggestionsDisabled],
  );
  const { data, isLoading } = useSelfFetch<RelatedContentResponse>(suggestUrl, { initialData });

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
  const visibleRefs = exclude.size > 0 ? refs.filter(r => !exclude.has(r.type)) : refs;
  // Zero refs (still loading in suggestion mode, or genuinely empty). Default:
  // no empty shell. Opt-in (`showWhenEmpty`): render the title + an empty-state
  // line so the section is always present (e.g. people-hub "What I Shipped").
  if (!visibleRefs.length) {
    if (!showWhenEmpty) return null; // non-showWhenEmpty consumers stay blank (unchanged)
    // Client-fetch loading (author/suggestion mode, no SSR initialItems): render a
    // SKELETON grid — reserves height + matches the rest of the app's loading, so
    // there's no blank-then-pop jump (the prior `return null` collapsed the tab to
    // zero height during the fetch). SSR controlled mode has isLoading=false → it
    // skips straight to the empty state below. Skeleton type = the requested rail
    // type (author mode passes a single `includeTypes`).
    if (isLoading) {
      const skeletonType = includeTypes?.[0] ?? entityType ?? 'blog_post_existing';
      return (
        <div className="space-y-8">
          <h2 className="text-ods-text-primary text-h2">{title}</h2>
          <div className={gridClassFor(columns)}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>{renderSkeletonForType(skeletonType, 'default', adminCampaignCard)}</div>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-8">
        <h2 className="text-2xl font-bold text-ods-text-primary">{title}</h2>
        {emptyState ?? <p className="text-ods-text-secondary">{emptyStateText}</p>}
      </div>
    );
  }

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
    // Canonicalize BOTH sides — hosts pass registry vocab ('blog_post') but
    // rail-vocab aliases ('blog_post_existing') are also legal inputs; a raw
    // comparison would silently lose the same-type-first hoist for aliases.
    const canonicalEntityType = canonicalContentRefType(entityType);
    const sameType = orderedTypes.filter(t => canonicalContentRefType(t) === canonicalEntityType);
    if (sameType.length > 0) {
      orderedTypes = [...sameType, ...orderedTypes.filter(t => canonicalContentRefType(t) !== canonicalEntityType)];
    }
  }

  return (
    <div className="space-y-8">
      <h2 className="text-ods-text-primary text-h2">{title}</h2>
      {orderedTypes.map(type => (
        <ContentGroup
          key={type}
          type={type}
          refs={grouped[type]}
          columns={columns}
          buildUrl={effectiveBuildListUrl}
          resolveHref={resolveHref}
          LinkProvider={LinkProvider}
          extras={extras}
          adminCampaignCard={adminCampaignCard}
          heading={
            <h3 className="font-semibold text-ods-text-secondary text-h5">{getContentRefLabelOrTitleCase(type)}</h3>
          }
        />
      ))}
    </div>
  );
}
