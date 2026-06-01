'use client'

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
 * Everything else flows through lib primitives + the ChatRuntime context
 * (chrome via `<DevSectionPage>`, search via `<DocSearchBar>`, section filter +
 * card hrefs via `runtime.composeContentUrl`).
 */

import { useMemo, useTransition, type ReactNode } from 'react'
import { GraduationCap } from 'lucide-react'

import { useRouter, useSearchParams } from '../../embed-shims'
import { useSelfFetch } from '../../hooks/use-self-fetch'
import { DevSectionPage } from '../shared/dev-section'
import { DocSearchBar, useDocSearch } from '../shared/doc-search'
import { FilterPillRow } from '../ui/filter-pill-row'
import { LoadError } from '../ui/error-state'
import { OnboardingGuideCard } from '../chat/entity-cards/onboarding-guide-card'
import { OnboardingGuidesCatalogSkeleton } from './onboarding-guides-catalog-skeleton'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide'
import { buildDefaultHref } from '../../utils/content-href'

type SectionSummary = { section: string; section_order: number; count: number }

export interface OnboardingGuidesCatalogViewProps {
  /** Controlled / SSR: server-fetched guides. Omit + pass `guidesEndpoint`
   *  for the self-fetching config-only mode. */
  initialGuides?: OnboardingGuide[]
  initialSections?: SectionSummary[]
  initialSection?: string
  /** Self-fetch: GET list endpoint (the api route). Appends `?section=`. */
  guidesEndpoint?: string
  /** Self-fetch: GET section-summary endpoint (the api route). */
  sectionsEndpoint?: string
  /** Optional per-row card renderer override. */
  renderCard?: (guide: OnboardingGuide) => ReactNode
  /** Base path the catalog is mounted under (fallback href prefix + `?section=`
   *  push target). Default `/onboarding-guides`. */
  basePath?: string
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const runtime = useChatRuntime()

  // Self-fetch only when the host supplied NO data but DID give an endpoint.
  const selfFetch = initialGuides === undefined && guidesEndpoint !== undefined
  // Active section: from the URL when self-fetching, from the prop (host RSC
  // already read the URL server-side) when controlled.
  const sectionValue = selfFetch ? searchParams.get('section') ?? '' : initialSection
  const activeSection = sectionValue || 'all'

  // Self-fetch the guides (refetched whenever `?section=` changes — it's folded
  // into the url) + the section summaries. Controlled mode passes `null` urls so
  // the hook never fetches. The guides fetch carries the error/retry affordance.
  const guidesQs = sectionValue ? `?section=${encodeURIComponent(sectionValue)}` : ''
  const guidesRes = useSelfFetch<{ data?: OnboardingGuide[] }>(
    selfFetch && guidesEndpoint ? `${guidesEndpoint}${guidesQs}` : null,
  )
  const sectionsRes = useSelfFetch<SectionSummary[]>(
    selfFetch && sectionsEndpoint ? sectionsEndpoint : null,
  )

  // Invariant: `guidesRes.data` is `null` until the first fetch resolves, then
  // `{ data: [...] }`. The `?.data ?? []` chain collapses never-fetched (null) and
  // legitimately-empty ([]) to the same `[]` — so the first-load skeleton gate below
  // keys on the OUTER `guidesRes.data == null` to distinguish them (an empty section
  // toggle keeps the chrome; only a true cold start shows the full-page skeleton).
  const guides = initialGuides ?? guidesRes.data?.data ?? []
  const sections = initialSections ?? (Array.isArray(sectionsRes.data) ? sectionsRes.data : [])
  const isLoading = selfFetch ? guidesRes.isLoading : false

  // Section grouping. Data arrives already filtered (server-side `?section=`
  // for the host, or our `?section=` fetch); this just buckets visible rows.
  const grouped = useMemo(() => {
    const map = new Map<string, { section_order: number; guides: OnboardingGuide[] }>()
    for (const g of guides) {
      const existing = map.get(g.section)
      if (existing) {
        if (g.section_order < existing.section_order) existing.section_order = g.section_order
        existing.guides.push(g)
      } else {
        map.set(g.section, { section_order: g.section_order, guides: [g] })
      }
    }
    for (const entry of map.values()) {
      entry.guides.sort((a, b) => a.step_order - b.step_order || a.title.localeCompare(b.title))
    }
    return Array.from(map.entries())
      .map(([section, info]) => ({ section, ...info }))
      .sort((a, b) => a.section_order - b.section_order || a.section.localeCompare(b.section))
  }, [guides])

  const sectionFilterOptions = useMemo(
    () => [
      { value: 'all', label: `All (${guides.length})` },
      ...sections.map((s) => ({ value: s.section, label: `${s.section} (${s.count})` })),
    ],
    [guides.length, sections],
  )

  // Section pill change → push `?section=X`. Controlled mode: host RSC
  // re-fetches. Self-fetch mode: our guides effect re-fetches on the URL change.
  const setSection = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') {
      params.delete('section')
    } else {
      params.set('section', value)
    }
    const qs = params.toString()
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath)
    })
  }

  // Search bar — scoped to onboarding-guides only via RAG-search `tableIds`.
  const source = runtime?.source ?? 'openframe'
  const docSearch = useDocSearch({
    source,
    baseRoute: basePath,
    onNavigate: (path) => router.push(path),
    tableIds: ['onboarding-guides'],
  })

  // Per-row card renderer — runtime-composed href, fallback to relative.
  const defaultRenderCard = (guide: OnboardingGuide) => {
    const cta = runtime?.composeContentUrl
      ? runtime.composeContentUrl('onboarding_guide', guide.slug, guide.onboarding_guide_platforms)
      : buildDefaultHref(basePath, guide.slug)
    return (
      <OnboardingGuideCard
        guide={guide}
        href={cta.href}
        targetPlatform={cta.targetPlatform}
        size="catalog"
      />
    )
  }
  const renderCardFn = renderCard ?? defaultRenderCard

  const preControls = (
    <div className="space-y-4">
      <DocSearchBar
        placeholder="Search onboarding guides, releases, case studies…"
        query={docSearch.query}
        onQueryChange={docSearch.setQuery}
        results={docSearch.results}
        isLoading={docSearch.isLoading}
        onResultSelect={docSearch.handleResultSelect}
        showDropdown={docSearch.keepDropdownOpen}
      />
      {sections.length > 0 && (
        <FilterPillRow
          label="Section"
          selectedValue={activeSection}
          onValueChange={setSection}
          options={sectionFilterOptions}
        />
      )}
    </div>
  )

  // A failed guides fetch → a RETRYABLE error (not the indistinguishable-from-
  // empty "no guides found" state) — parity with the sibling self-fetch views.
  if (selfFetch && guidesRes.error) {
    return <LoadError message="Failed to load onboarding guides." onRetry={guidesRes.reload} />
  }
  // Full-page skeleton ONLY on the very first load (no data has loaded yet) — a
  // later section toggle that legitimately returns ZERO guides keeps the page
  // chrome (search + section pills) and dims the grid via the className below.
  if (selfFetch && guidesRes.data == null && isLoading) {
    return <OnboardingGuidesCatalogSkeleton />
  }

  return (
    <DevSectionPage sectionKey="onboarding" preControls={preControls}>
      {guides.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="h-12 w-12 text-ods-text-secondary mx-auto mb-4" />
          <h2 className="text-ods-text-primary font-['DM_Sans'] text-[20px] font-semibold mb-2">
            No onboarding guides found
          </h2>
          <p className="text-ods-text-secondary font-['DM_Sans'] text-[14px]">
            {activeSection !== 'all'
              ? 'No guides in this section yet.'
              : "We're working on the onboarding library. Check back soon."}
          </p>
        </div>
      ) : (
        <div className={isPending || isLoading ? 'opacity-60 transition-opacity space-y-10' : 'space-y-10'}>
          {grouped.map((sec) => (
            <section key={sec.section} className="space-y-4">
              <h2 className="text-h3 tracking-[-0.36px] text-ods-text-primary flex items-center gap-2">
                {sec.section}
                <span className="inline-flex items-center justify-center rounded-full bg-ods-text-secondary/20 text-ods-text-secondary text-xs font-medium px-2 py-0.5">
                  {sec.guides.length}
                </span>
              </h2>
              {/* HORIZONTAL catalog list — single column so consecutive steps
                  read top-to-bottom; a grid would visually reorder them. */}
              <ul className="flex flex-col gap-4">
                {sec.guides.map((guide) => (
                  <li key={guide.id}>{renderCardFn(guide)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </DevSectionPage>
  )
}
