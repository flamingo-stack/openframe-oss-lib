'use client';

/**
 * Public-facing catalog view for `/onboarding-guides`.
 *
 * Two data modes:
 *   - **controlled** (hub SSR): pass `initialGuides` + `initialSections`
 *     (server-fetched; section changes re-render the host with new props).
 *   - **self-fetching** (config-only embed): omit the data props and pass
 *     `guidesEndpoint` + `sectionsEndpoint` (the api routes). The view fetches
 *     the guides (refetching on `?section=` change) + the section list itself —
 *     no host data layer. (Plain fetch + useEffect, the DeliveryLists pattern.)
 *
 * The view renders ONLY its body + its OWN controls (the RAG `<DocSearchBar>` +
 * dynamic section pills — onboarding's controls are content-driven, unlike the
 * static search/filter the `DevSectionView` chrome ships). It does NOT render the
 * page chrome: the CALLER wraps it in `<DevSectionPage sectionKey="onboarding">`
 * (hero + back button), exactly like the roadmap / releases / delivery pages — so
 * every dev-center surface composes the same way and the view stays embeddable in
 * tabbed contexts. Card hrefs flow through `runtime.composeContentUrl`.
 */

import { GraduationCap } from 'lucide-react';
import { useMemo, useTransition, type ReactNode } from 'react';

import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { useRouter, useSearchParams } from '../../embed-shims';
import { useSelfFetch } from '../../hooks/use-self-fetch';
import { cn } from '../../utils/cn';
import { resolveContentHref } from '../../utils/content-href';
import { OnboardingGuideCard } from '../chat/entity-cards/onboarding-guide-card';
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide';
import { LoadingFallback } from '../loading/loading-fallback';
import { DocSearchBar, useDocSearch } from '../shared/doc-search';
import { LoadError } from '../ui/error-state';
import { FilterPillRow } from '../ui/filter-pill-row';
import { TextLineSkeleton } from '../loading/unified-skeleton';
import { LoadingItems, useLoadingScope } from '../ui/loading-scope';

/** The catalog's layout, read by the loaded view and by its sections' skeleton, so the skeleton is the view's size. */
const CATALOG_VIEW_CLASS = 'flex w-full flex-col gap-10';
const CATALOG_CONTROLS_CLASS = 'space-y-4';
const CATALOG_SECTIONS_CLASS = 'space-y-10';
const CATALOG_SECTION_CLASS = 'space-y-4';
const CATALOG_SECTION_HEADING_CLASS = 'flex items-center gap-2 text-ods-text-primary text-h3';
const CATALOG_SECTION_COUNT_CLASS =
  'inline-flex items-center justify-center rounded-full bg-ods-text-secondary/20 px-2 py-0.5 text-ods-text-secondary text-h6';
const CATALOG_LIST_CLASS = 'flex flex-col gap-4';

/**
 * Catalog cards the skeleton's section draws: a typical count, at every width. The catalog reads every guide (no
 * page, no limit), so there is no page size to draw. The section count is the data's too: the skeleton draws ONE
 * section, and every loaded section is a `data-loading-item`.
 */
const ONBOARDING_CATALOG_SKELETON_CARDS = 3;
/**
 * The catalog's sections while the guides are read: ONE section of `ONBOARDING_CATALOG_SKELETON_CARDS` cards in the view's
 * own classes (its heading and count bars). The view draws it itself (`useLoadingScope() || loading`): its search bar
 * is real and its section pills draw their own skeleton.
 */
function OnboardingCatalogSectionsSkeleton() {
  return (
    <div className={CATALOG_SECTIONS_CLASS}>
      <section className={CATALOG_SECTION_CLASS} data-loading-item>
        <h2 className={CATALOG_SECTION_HEADING_CLASS}>
          <TextLineSkeleton type="inherit" as="span" className="w-40" />
          <span className={CATALOG_SECTION_COUNT_CLASS}>
            <TextLineSkeleton type="inherit" as="span" className="w-3" />
          </span>
        </h2>
        <ul className={CATALOG_LIST_CLASS}>
          <LoadingItems count={ONBOARDING_CATALOG_SKELETON_CARDS}>
            {() => (
              <li data-loading-item>
                <OnboardingGuideCard loading size="catalog" />
              </li>
            )}
          </LoadingItems>
        </ul>
      </section>
    </div>
  );
}

type SectionSummary = { section: string; section_order: number; count: number };

export interface OnboardingGuidesCatalogViewProps {
  /** Controlled / SSR: server-fetched guides. Omit + pass `guidesEndpoint`
   *  for the self-fetching config-only mode. */
  initialGuides?: OnboardingGuide[];
  initialSections?: SectionSummary[];
  initialSection?: string;
  /** Self-fetch: GET list endpoint (the api route). Appends `?section=`. */
  guidesEndpoint?: string;
  /** Self-fetch: GET section-summary endpoint (the api route). */
  sectionsEndpoint?: string;
  /** Optional per-row card renderer override. */
  renderCard?: (guide: OnboardingGuide) => ReactNode;
  /** Base path the catalog is mounted under (fallback href prefix + `?section=`
   *  push target). Default `/onboarding-guides`. */
  basePath?: string;
}

export function OnboardingGuidesCatalogView({
  initialGuides,
  initialSections,
  initialSection = '',
  guidesEndpoint,
  sectionsEndpoint,
  renderCard,
  basePath = '/onboarding-guides',
}: OnboardingGuidesCatalogViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const runtime = useChatRuntime();

  // In a page's loading state the catalog is read: it renders its own view in the scope (every part its own
  // skeleton) and fetches nothing.
  const scoped = useLoadingScope();
  // Self-fetch only when the host supplied NO data but DID give an endpoint.
  const selfFetch = !scoped && initialGuides === undefined && guidesEndpoint !== undefined;
  // Active section: from the URL when self-fetching, from the prop (host RSC
  // already read the URL server-side) when controlled.
  const sectionValue = selfFetch ? (searchParams.get('section') ?? '') : initialSection;
  const activeSection = sectionValue || 'all';

  // Self-fetch the guides (refetched whenever `?section=` changes — it's folded
  // into the url) + the section summaries. Controlled mode passes `null` urls so
  // the hook never fetches. The guides fetch carries the error/retry affordance.
  const guidesQs = sectionValue ? `?section=${encodeURIComponent(sectionValue)}` : '';
  const guidesRes = useSelfFetch<{ data?: OnboardingGuide[] }>(
    selfFetch && guidesEndpoint ? `${guidesEndpoint}${guidesQs}` : null,
  );
  const sectionsRes = useSelfFetch<SectionSummary[]>(selfFetch && sectionsEndpoint ? sectionsEndpoint : null);

  // Invariant: `guidesRes.data` is `null` until the first fetch resolves, then
  // `{ data: [...] }`. The `?.data ?? []` chain collapses never-fetched (null) and
  // legitimately-empty ([]) to the same `[]` — so the first-load skeleton gate below
  // keys on the OUTER `guidesRes.data == null` to distinguish them (an empty section
  // toggle keeps the chrome; only a true cold start shows the full-page skeleton).
  // Memoised because the `??` fallback minted a NEW array on every
  // render, which made the memo below re-run every time — i.e. do nothing.
  const guides = useMemo(() => initialGuides ?? guidesRes.data?.data ?? [], [initialGuides, guidesRes.data?.data]);
  const sections = useMemo(
    () => initialSections ?? (Array.isArray(sectionsRes.data) ? sectionsRes.data : []),
    [initialSections, sectionsRes.data],
  );
  const isLoading = selfFetch ? guidesRes.isLoading : false;
  // The catalog's first read (no guides yet), or a host's loading scope: the view renders in a loading scope.
  const loading = scoped || (selfFetch && guidesRes.data == null && isLoading);

  // Section grouping. Data arrives already filtered (server-side `?section=`
  // for the host, or our `?section=` fetch); this just buckets visible rows.
  const grouped = useMemo(() => {
    const map = new Map<string, { section_order: number; guides: OnboardingGuide[] }>();
    for (const g of guides) {
      const existing = map.get(g.section);
      if (existing) {
        if (g.section_order < existing.section_order) existing.section_order = g.section_order;
        existing.guides.push(g);
      } else {
        map.set(g.section, { section_order: g.section_order, guides: [g] });
      }
    }
    for (const entry of map.values()) {
      entry.guides.sort((a, b) => a.step_order - b.step_order || a.title.localeCompare(b.title));
    }
    return Array.from(map.entries())
      .map(([section, info]) => ({ section, ...info }))
      .sort((a, b) => a.section_order - b.section_order || a.section.localeCompare(b.section));
  }, [guides]);

  const sectionFilterOptions = useMemo(
    () => [
      { value: 'all', label: `All (${guides.length})` },
      ...sections.map(s => ({ value: s.section, label: `${s.section} (${s.count})` })),
    ],
    [guides.length, sections],
  );

  // Section pill change → push `?section=X`. Controlled mode: host RSC
  // re-fetches. Self-fetch mode: our guides effect re-fetches on the URL change.
  const setSection = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('section');
    } else {
      params.set('section', value);
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath);
    });
  };

  // Search bar — scoped to onboarding-guides only via RAG-search `tableIds`.
  const source = runtime?.source ?? 'openframe';
  const docSearch = useDocSearch({
    source,
    baseRoute: basePath,
    onNavigate: path => router.push(path),
    tableIds: ['onboarding-guides'],
  });

  // Per-row card renderer — runtime-composed href, fallback to relative.
  const defaultRenderCard = (guide: OnboardingGuide) => {
    const cta = resolveContentHref(runtime?.composeContentUrl, {
      type: 'onboarding_guide',
      slug: guide.slug,
      basePath,
      platforms: guide.onboarding_guide_platforms,
    });
    return <OnboardingGuideCard guide={guide} href={cta.href} targetPlatform={cta.targetPlatform} size="catalog" />;
  };
  const renderCardFn = renderCard ?? defaultRenderCard;

  const preControls = (
    <div className={CATALOG_CONTROLS_CLASS}>
      <DocSearchBar
        placeholder="Search onboarding guides, releases, case studies…"
        query={docSearch.query}
        onQueryChange={docSearch.setQuery}
        results={docSearch.results}
        isLoading={docSearch.isLoading}
        onResultSelect={docSearch.handleResultSelect}
        showDropdown={docSearch.keepDropdownOpen}
      />
      {(loading || sections.length > 0) && (
        <FilterPillRow
          label="Section"
          selectedValue={activeSection}
          onValueChange={setSection}
          // While loading the options (their counts) are read: the row draws its own skeleton.
          options={loading ? [] : sectionFilterOptions}
          loading={loading}
        />
      )}
    </div>
  );

  // A failed guides fetch → a RETRYABLE error (not the indistinguishable-from-
  // empty "no guides found" state) — parity with the sibling self-fetch views.
  if (!loading && selfFetch && guidesRes.error) {
    return <LoadError message="Failed to load onboarding guides." onRetry={guidesRes.reload} />;
  }

  const view = (
    <div className={CATALOG_VIEW_CLASS}>
      {preControls}
      <OnboardingCatalogSections
        grouped={grouped}
        loading={loading}
        dimmed={isPending || isLoading}
        allSections={activeSection === 'all'}
        renderCard={renderCardFn}
      />
    </div>
  );
  // The first read (no data yet): the SAME view in a loading scope. A later section toggle that returns ZERO guides
  // keeps the page's controls and dims the grid (`dimmed`).
  if (!loading) return view;
  return <LoadingFallback label="Loading onboarding guides">{view}</LoadingFallback>;
}

/** The catalog's sections: their own skeleton while the guides are read (`useLoadingScope() || loading`). */
function OnboardingCatalogSections({
  grouped,
  loading,
  dimmed,
  allSections,
  renderCard,
}: {
  grouped: Array<{ section: string; guides: OnboardingGuide[] }>;
  loading: boolean;
  dimmed: boolean;
  /** No section is selected (the empty state's wording). */
  allSections: boolean;
  renderCard: (guide: OnboardingGuide) => ReactNode;
}) {
  if (useLoadingScope() || loading) return <OnboardingCatalogSectionsSkeleton />;
  if (grouped.length === 0) {
    return (
      <div className="py-16 text-center">
        <GraduationCap className="mx-auto mb-4 h-12 w-12 text-ods-text-secondary" />
        <h2 className="mb-2 text-ods-text-primary text-h3">No onboarding guides found</h2>
        <p className="text-ods-text-secondary text-h6">
          {allSections ? "We're working on the onboarding library. Check back soon." : 'No guides in this section yet.'}
        </p>
      </div>
    );
  }
  return (
    <div className={cn(CATALOG_SECTIONS_CLASS, dimmed && 'opacity-60 transition-opacity')}>
      {grouped.map(sec => (
        // A section is the data's group: how many there are is the record's (`data-loading-item`).
        <section key={sec.section} className={CATALOG_SECTION_CLASS} data-loading-item>
          <h2 className={CATALOG_SECTION_HEADING_CLASS}>
            {sec.section}
            <span className={CATALOG_SECTION_COUNT_CLASS}>{sec.guides.length}</span>
          </h2>
          {/* HORIZONTAL catalog list — single column so consecutive steps
              read top-to-bottom; a grid would visually reorder them. */}
          <ul className={CATALOG_LIST_CLASS}>
            {sec.guides.map(guide => (
              <li key={guide.id} data-loading-item>
                {renderCard(guide)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
