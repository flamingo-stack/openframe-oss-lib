'use client'

/**
 * `<ProductReleasesView />` — the shared, SELF-CONTAINED releases LIST surface.
 *
 * The host configures only two things: the **api route** (`endpoint`, default
 * `/api/releases`) and the **internal page route** for a release's detail page
 * (via `runtime.composeContentUrl` / `basePath`). Everything else — reading the
 * search / status / page URL params the section chrome writes, fetching the
 * page, pagination, empty / error / loading states, card composition + nav —
 * happens INSIDE the lib. Mirrors the `DeliveryLists` internal-fetch pattern
 * (plain `fetch` + `useEffect`/`useState`, no react-query dependency).
 *
 * SSR: pass `initialData` to hydrate the first page without a client round-trip
 * (the hub can server-fetch); embedders omit it and the view fetches on mount.
 *
 * Card props: `buildCardProps` defaults to the lib's RICH `buildProductReleaseCardProps`
 * (full lg metadata — Type / Status / author / changelog counts); pass your own to customize.
 */

import * as React from 'react'

import { useRouter, useSearchParams, usePathname } from '../../../embed-shims'
import { useSelfFetch } from '../../../hooks/use-self-fetch'
import { useChatRuntime } from '../../../contexts/chat-runtime-context'
import type { ProductRelease, ProductReleaseListResponse } from '../../../types/product-release'
import { cn } from '../../../utils/cn'
import { resolveContentHref } from '../../../utils/content-href'
import { isModifierClick } from '../../chat/utils/chat-nav-resolution'
import { executeNavigationImperative } from '../../chat/utils/execute-navigation'
import { useEntityCardLink } from '../../chat/entity-cards/use-entity-card-link'
import { buildProductReleaseCardProps } from '../../chat/entity-cards/product-release-card-defaults'
import { EmptyState } from '../../empty-state'
import { LoadError } from '../../ui/error-state'
import { PersistentPaginationWrapper } from '../../persistent-pagination'
import { ProductReleaseCard, type ProductReleaseCardProps } from './product-release-card'
import { ProductReleaseCardSkeleton } from './product-release-card-skeleton'
import { DEV_SECTION_PARAM_KEYS } from '../../../utils/dev-sections/dev-section-param-keys'

const DEFAULT_ENDPOINT = '/api/releases'
// Param keys sourced from the shared registry (see RoadmapView) — single source for the
// chrome's written `?key=` and this view's read.
const DEFAULT_SEARCH_PARAM_KEY = DEV_SECTION_PARAM_KEYS.search
const DEFAULT_STATUS_PARAM_KEY = DEV_SECTION_PARAM_KEYS.releaseStatus
const DEFAULT_PAGE_PARAM_KEY = 'page'

/** The `<ProductReleaseCard>` props the caller derives per release — the card's
 *  own data fields minus the ones this view supplies (title/summary/version/
 *  size/nav). `formattedDate` stays required so the spread satisfies the card. */
export type ProductReleaseCardExtras = Omit<
  ProductReleaseCardProps,
  'title' | 'summary' | 'version' | 'size' | 'anchorProps' | 'onClick' | 'className'
>

export interface ProductReleasesViewProps {
  /** GET endpoint for the releases list (the api route). The view appends
   *  `?limit&offset&<search>&<release_status>`. Default `/api/releases`. */
  endpoint?: string
  /** Optional SSR hydrate for the first page — skips the initial client fetch. */
  initialData?: ProductReleaseListResponse
  /** Page size → fixed slot count + offset math. Default 5. */
  itemsPerPage?: number
  /** Fallback detail-href prefix when `runtime.composeContentUrl` is not wired
   *  (single-platform embedders). Default `/releases`. */
  basePath?: string
  /** Derive the per-card prop bundle. Defaults to the lib's RICH lg builder
   *  (`buildProductReleaseCardProps` — full Type/Status/author/changelog metadata)
   *  so embedders get the complete card with zero config; pass your own to customize. */
  buildCardProps?: (release: ProductRelease) => ProductReleaseCardExtras
  /** URL param key for the search input. MUST match the chrome that writes it.
   *  Default `'search'` (also the outbound query-param name). */
  searchParamKey?: string
  /** URL param key for the status filter. Default `'release_status'`. */
  statusParamKey?: string
  /** URL param key for the page number. Default `'page'`. */
  pageParamKey?: string
  className?: string
}

/**
 * Per-row child — owns the per-release hooks (`useChatRuntime` +
 * `useEntityCardLink` + `useRouter`) so they run at a component top level, NOT
 * inside the parent `.map()` (Rules-of-Hooks).
 */
function ReleaseRow({
  release,
  basePath,
  buildCardProps,
}: {
  release: ProductRelease
  basePath: string
  buildCardProps: (release: ProductRelease) => ProductReleaseCardExtras
}) {
  const runtime = useChatRuntime()
  const router = useRouter()
  // Pass the HYDRATED junction (`product_release_platforms` — the release DAL
  // flattens each platform's `name` onto it), like the blog / case-study /
  // interview grids. The composer reads `name` → resolves to the CURRENT
  // platform when the release belongs to it → relative same-tab href.
  const cta = resolveContentHref(runtime?.composeContentUrl, {
    type: 'product_release',
    slug: release.slug,
    basePath,
    platforms: release.product_release_platforms,
  })
  const { target, rel } = useEntityCardLink({ href: cta.href, targetPlatform: cta.targetPlatform })

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Let the browser handle modifier / middle / new-tab clicks (shared
    // `isModifierClick` rule). Otherwise soft same-origin nav: the host's
    // `navigate` (hub docNav) if wired, else the registered embed-shims router.
    if (e.defaultPrevented || isModifierClick(e) || target === '_blank') return
    e.preventDefault()
    executeNavigationImperative({
      runtime,
      href: cta.href,
      targetPlatform: cta.targetPlatform,
      fallbackNavigate: router.push,
    })
  }

  return (
    <ProductReleaseCard
      size="lg"
      title={release.title}
      summary={release.summary}
      version={release.version}
      {...buildCardProps(release)}
      anchorProps={{ href: cta.href, target, rel, onClick }}
    />
  )
}

export function ProductReleasesView({
  endpoint = DEFAULT_ENDPOINT,
  initialData,
  itemsPerPage = 5,
  basePath = '/releases',
  buildCardProps = buildProductReleaseCardProps,
  searchParamKey = DEFAULT_SEARCH_PARAM_KEY,
  statusParamKey = DEFAULT_STATUS_PARAM_KEY,
  pageParamKey = DEFAULT_PAGE_PARAM_KEY,
  className,
}: ProductReleasesViewProps = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Filter / page state from the URL (written by the section chrome above).
  const search = searchParams.get(searchParamKey) || ''
  const status = searchParams.get(statusParamKey) || 'all'
  const currentPage = Math.max(1, parseInt(searchParams.get(pageParamKey) || '1', 10) || 1)
  const offset = (currentPage - 1) * itemsPerPage

  // Fold every query param into the url so it IS the fetch key.
  const listParams = new URLSearchParams({ limit: String(itemsPerPage), offset: String(offset) })
  if (search) listParams.set(searchParamKey, search)
  if (status && status !== 'all') listParams.set(statusParamKey, status)
  const { data, isLoading, error, reload } = useSelfFetch<ProductReleaseListResponse>(
    `${endpoint}?${listParams.toString()}`,
    { initialData },
  )

  const releases = data?.data ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / itemsPerPage)
  const hasActiveFilters = search !== '' || status !== 'all'
  const showEmpty = !isLoading && !error && releases.length === 0

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(pageParamKey, String(page))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }
  const resetFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(searchParamKey)
    params.delete(statusParamKey)
    params.delete(pageParamKey)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  if (error) {
    return (
      <div className={cn('w-full', className)}>
        <LoadError message="Failed to load releases." onRetry={reload} />
      </div>
    )
  }

  return (
    <div className={cn('w-full flex flex-col gap-[40px]', className)}>
      <div className="min-h-[600px]">
        {showEmpty ? (
          <div className="h-[600px] flex items-center justify-center">
            {hasActiveFilters ? (
              <EmptyState
                type="search"
                title="No releases found"
                description="No releases match your current filters. Try adjusting your search or status filter."
                showCTA
                ctaText="Reset Filters"
                onCtaClick={resetFilters}
              />
            ) : (
              <EmptyState
                type="generic"
                title="No releases available"
                description="Check back soon for product updates!"
                showCTA={false}
              />
            )}
          </div>
        ) : (
          <>
            {/* ALWAYS render `itemsPerPage` slots — visibility toggles so the
                list height is stable across loading ↔ loaded. */}
            <div className="flex flex-col gap-6">
              {Array.from({ length: itemsPerPage }).map((_, i) => {
                const release = releases[i]
                const hasData = !!release
                return (
                  <div
                    key={release?.id ?? `slot-${i}`}
                    style={{ visibility: isLoading || hasData ? 'visible' : 'hidden' }}
                  >
                    {isLoading ? (
                      <ProductReleaseCardSkeleton size="lg" />
                    ) : release ? (
                      <ReleaseRow release={release} basePath={basePath} buildCardProps={buildCardProps} />
                    ) : (
                      <ProductReleaseCardSkeleton size="lg" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Pagination — always present at the bottom for consistent spacing. */}
            <div className="mt-6 md:mt-8 flex justify-center">
              {isLoading ? (
                <div className="h-12 m-3 w-64" />
              ) : releases.length > 0 && totalPages > 1 ? (
                <PersistentPaginationWrapper
                  isLoading={false}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  variant="blog"
                />
              ) : (
                <div className="h-12 m-3 w-64" style={{ visibility: 'hidden' }} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
