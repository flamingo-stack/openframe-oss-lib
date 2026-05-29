'use client'

/**
 * Public-facing catalog view for `/onboarding-guides` on openframe.
 *
 * Self-contained: every concern that used to require a hub-side
 * wrapper now flows through lib primitives + the ChatRuntime context.
 *
 *   - Chrome: `<DevSectionPage sectionKey="onboarding">` (same lib
 *     primitive every other dev-center surface uses).
 *   - Search bar: lib `<DocSearchBar>` + `useDocSearch` directly,
 *     pre-scoped to `tableIds: ['onboarding-guides']`. The chat
 *     runtime's `source` discriminates the RAG namespace.
 *   - Section filter: lib `<FilterSection>` + URL push via embed-shim
 *     `useRouter`/`useSearchParams`.
 *   - Cards: lib `<OnboardingGuideCard>` with hrefs composed via
 *     `runtime.composeContentUrl?.('onboarding_guide', slug, platforms)`.
 *     Falls back to a same-origin relative path when no composer is
 *     wired (single-platform embedders).
 *
 * No hub-side wrapper file required.
 */

import { useMemo, useTransition, type ReactNode } from 'react'
import { GraduationCap } from 'lucide-react'

import { useRouter, useSearchParams } from '../../embed-shims'
import { DevSectionPage } from '../shared/dev-section'
import { DocSearchBar, useDocSearch } from '../shared/doc-search'
import { FilterPillRow } from '../ui/filter-pill-row'
import { OnboardingGuideCard } from '../chat/entity-cards/onboarding-guide-card'
import { useChatRuntime } from '../../contexts/chat-runtime-context'
import type { OnboardingGuide } from '../chat/types/entities/onboarding-guide'
import { buildDefaultHref } from './build-default-href'

export interface OnboardingGuidesCatalogViewProps {
  initialGuides: OnboardingGuide[]
  initialSections: Array<{
    section: string
    section_order: number
    count: number
  }>
  initialSection?: string
  /** Optional per-row card renderer override. When omitted, lib
   *  renders `<OnboardingGuideCard>` with runtime-composed href.
   *  Embedders only override to swap the card shape entirely. */
  renderCard?: (guide: OnboardingGuide) => ReactNode
  /** Base path the catalog is mounted under. Used as the fallback
   *  `href` prefix for card hrefs when `runtime.composeContentUrl` is
   *  not wired. Embedders mounting at `/docs/onboarding/` instead of
   *  `/onboarding-guides/` should override. Also used by `setSection`
   *  for the `?section=` URL push. Default `/onboarding-guides`. */
  basePath?: string
}

export function OnboardingGuidesCatalogView({
  initialGuides,
  initialSections,
  initialSection = '',
  renderCard,
  basePath = '/onboarding-guides',
}: OnboardingGuidesCatalogViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const runtime = useChatRuntime()
  const activeSection = initialSection || 'all'

  // Section grouping. Data arrives already filtered server-side via
  // `?section=`; this just buckets the visible rows for the section-
  // header layout — no client-side `.filter()`.
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { section_order: number; guides: OnboardingGuide[] }
    >()
    for (const g of initialGuides) {
      const existing = map.get(g.section)
      if (existing) {
        if (g.section_order < existing.section_order)
          existing.section_order = g.section_order
        existing.guides.push(g)
      } else {
        map.set(g.section, { section_order: g.section_order, guides: [g] })
      }
    }
    for (const entry of map.values()) {
      entry.guides.sort(
        (a, b) =>
          a.step_order - b.step_order || a.title.localeCompare(b.title),
      )
    }
    return Array.from(map.entries())
      .map(([section, info]) => ({ section, ...info }))
      .sort(
        (a, b) =>
          a.section_order - b.section_order ||
          a.section.localeCompare(b.section),
      )
  }, [initialGuides])

  // Section-filter options for the lib `<FilterSection>` row.
  const sectionFilterOptions = useMemo(
    () => [
      { value: 'all', label: `All (${initialGuides.length})` },
      ...initialSections.map((s) => ({
        value: s.section,
        label: `${s.section} (${s.count})`,
      })),
    ],
    [initialGuides.length, initialSections],
  )

  // Section pill change → push `?section=X` so the host RSC re-
  // fetches against the DAL. Wrapped in `useTransition` so the
  // results grid dims while the new payload is in flight.
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

  // Search bar — scoped to onboarding-guides only via the RAG-search
  // `tableIds` parameter. The hook calls `/api/docs/search` directly;
  // hub or embedder must expose that endpoint (reverse-proxy on
  // non-Next.js hosts).
  const source = runtime?.source ?? 'openframe'
  const docSearch = useDocSearch({
    source,
    baseRoute: basePath,
    onNavigate: (path) => router.push(path),
    tableIds: ['onboarding-guides'],
  })

  // Per-row card renderer — uses runtime-composed href for cross-
  // platform navigation. Falls back to a same-origin relative URL
  // when no composer is wired.
  const defaultRenderCard = (guide: OnboardingGuide) => {
    const cta = runtime?.composeContentUrl
      ? runtime.composeContentUrl(
          'onboarding_guide',
          guide.slug,
          guide.onboarding_guide_platforms,
        )
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
      {initialSections.length > 0 && (
        <FilterPillRow
          label="Section"
          selectedValue={activeSection}
          onValueChange={setSection}
          options={sectionFilterOptions}
        />
      )}
    </div>
  )

  return (
    <DevSectionPage sectionKey="onboarding" preControls={preControls}>
      {initialGuides.length === 0 ? (
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
        <div
          className={
            isPending
              ? 'opacity-60 transition-opacity space-y-10'
              : 'space-y-10'
          }
        >
          {grouped.map((sec) => (
            <section key={sec.section} className="space-y-4">
              <h2 className="text-h3 tracking-[-0.36px] text-ods-text-primary flex items-center gap-2">
                {sec.section}
                <span className="inline-flex items-center justify-center rounded-full bg-ods-text-secondary/20 text-ods-text-secondary text-xs font-medium px-2 py-0.5">
                  {sec.guides.length}
                </span>
              </h2>
              {/* HORIZONTAL catalog list — single column so consecutive
                  steps read top-to-bottom (Step 1 above Step 2 above
                  Step 3); a grid would visually reorder them. */}
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
