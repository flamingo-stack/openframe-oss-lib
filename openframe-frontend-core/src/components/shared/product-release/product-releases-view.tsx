'use client'

/**
 * `<ProductReleasesView />` — the shared releases LIST surface.
 *
 * Lifted from the hub's `ReleasesList`
 * (`multi-platform-hub/components/releases/product-releases-tab-content.tsx`)
 * so the hub `/releases` page AND every embedder render ONE implementation
 * (the §5 "every page-level surface is a fully-shared, parameterized lib
 * component" rule). The decoupling recipe:
 *
 *   - **data** via props (`releases` + pagination state) — the host fetches
 *     through its own endpoint/QueryClient, exactly like
 *     `OnboardingGuidesCatalogView.initialGuides`; no hard-wired hub hook.
 *   - **card props** via `buildCardProps` — defaults to the lib's
 *     `defaultBuildProductReleaseCardProps` (the `lg` card then renders
 *     em-dash placeholders for the metadata it can't derive); the hub passes
 *     its richer `buildProductReleaseCardProps` to populate Type/Status/
 *     changelog/author.
 *   - **nav** via the existing `runtime.composeContentUrl` seam +
 *     `useEntityCardLink` (target/rel) + soft-nav through
 *     `runtime.navigation.navigate` — NOT `useNavLink` / `currentPlatform`.
 *     The card keeps its existing `anchorProps` API (a real `<a href>`), so
 *     cmd/middle-click new-tab work natively and the related-content rail's
 *     use of the same card is unaffected.
 *   - **chrome** via the already-lib `EmptyState`, `PersistentPaginationWrapper`,
 *     and `ProductReleaseCardSkeleton`.
 *
 * Controls (search + status filter) live ABOVE this view in the host's
 * section chrome; this component only consumes the resulting page of data +
 * filter flags.
 */

import * as React from 'react'

import { useChatRuntime } from '../../../contexts/chat-runtime-context'
import type { ProductRelease } from '../../../types/product-release'
import { cn } from '../../../utils/cn'
import { buildDefaultHref } from '../../../utils/content-href'
import { isModifierClick } from '../../chat/utils/chat-nav-resolution'
import { useEntityCardLink } from '../../chat/entity-cards/use-entity-card-link'
import { defaultBuildProductReleaseCardProps } from '../../chat/entity-cards/product-release-card-defaults'
import { EmptyState } from '../../empty-state'
import { PersistentPaginationWrapper } from '../../persistent-pagination'
import { ProductReleaseCard, type ProductReleaseCardProps } from './product-release-card'
import { ProductReleaseCardSkeleton } from './product-release-card-skeleton'

/** The `<ProductReleaseCard>` props the caller derives per release — the
 *  card's own data fields minus the ones this view supplies directly
 *  (title/summary/version/size/nav). `formattedDate` stays required so the
 *  spread satisfies the card's required prop. */
export type ProductReleaseCardExtras = Omit<
  ProductReleaseCardProps,
  'title' | 'summary' | 'version' | 'size' | 'anchorProps' | 'onClick' | 'className'
>

export interface ProductReleasesViewProps {
  /** The current page of releases (host-fetched). */
  releases: ProductRelease[]
  isLoading?: boolean
  /** Truthy when the fetch failed — renders the retry block. */
  error?: boolean
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  /** True when a search/status filter is active → the empty state offers a
   *  reset instead of the "nothing yet" copy. */
  hasActiveFilters?: boolean
  /** Clear the active filters (host owns the URL/param reset). */
  onResetFilters?: () => void
  /** Retry handler for the error block. Defaults to a full reload. */
  onRetry?: () => void
  /** Fallback detail-href prefix when `runtime.composeContentUrl` is not
   *  wired (single-platform embedders). Default `/releases`. */
  basePath?: string
  /** Derive the per-card prop bundle. Defaults to the lib's sm-subset
   *  builder; the hub passes its full lg builder via this seam. */
  buildCardProps?: (release: ProductRelease) => ProductReleaseCardExtras
  /** Fixed slot count → stable min-height across loading/loaded. Default 5. */
  itemsPerPage?: number
  className?: string
}

/**
 * Per-row child — owns the per-release hooks (`useChatRuntime` +
 * `useEntityCardLink`) so they run at a component top level, NOT inside the
 * parent `.map()` (Rules-of-Hooks). Mirrors the hub `ReleaseRow`, but routes
 * via the runtime seam instead of the hub-only `useNavLink`.
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
  // Same href-composition path as OnboardingGuidesCatalogView: the runtime
  // composer when wired (hub topology / embedder hosted-types), else a
  // same-origin relative href.
  // Pass the HYDRATED junction (`product_release_platforms` — the release DAL
  // flattens each platform's `name` onto it), exactly like the blog / case-study
  // / interview grids. The hub composer reads `name` and resolves to the CURRENT
  // platform when the release belongs to it → relative same-tab href (NOT a
  // cross-domain new tab). `release.platforms` is NOT populated by the release
  // DAL; the embedder composer ignores platforms entirely (hostedTypes decides).
  const cta = runtime?.composeContentUrl
    ? runtime.composeContentUrl('product_release', release.slug, release.product_release_platforms)
    : buildDefaultHref(basePath, release.slug)
  const { target, rel } = useEntityCardLink({ href: cta.href, targetPlatform: cta.targetPlatform })

  const navigate = runtime?.navigation?.navigate
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Soft-navigate through the runtime seam (hub → router.push, embedder →
    // react-router). Let the browser handle modifier / middle / new-tab clicks
    // (shared `isModifierClick` rule) so cmd-click-new-tab keeps working on the
    // real `<a href>`.
    if (e.defaultPrevented || isModifierClick(e)) return
    if (target === '_blank') return
    if (navigate?.({ href: cta.href })) e.preventDefault()
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
  releases,
  isLoading = false,
  error = false,
  currentPage,
  totalPages,
  onPageChange,
  hasActiveFilters = false,
  onResetFilters,
  onRetry,
  basePath = '/releases',
  buildCardProps = defaultBuildProductReleaseCardProps,
  itemsPerPage = 5,
  className,
}: ProductReleasesViewProps) {
  const showEmpty = !isLoading && !error && releases.length === 0

  return (
    <div className={cn('w-full flex flex-col gap-[40px]', className)}>
      {/* Error state */}
      {!isLoading && error && (
        <div className="bg-ods-card border border-ods-border rounded-[6px] p-[40px] text-center">
          <p className="text-[--ods-attention-red-error] text-lg mb-4">Failed to load releases</p>
          <button
            onClick={() => (onRetry ? onRetry() : typeof window !== 'undefined' && window.location.reload())}
            className="px-6 py-2 bg-ods-accent text-ods-text-on-accent rounded-lg hover:opacity-90 transition-opacity font-['DM_Sans'] font-bold text-[16px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Fixed-height container — empty state OR fixed slots + pagination. */}
      <div className="min-h-[600px]">
        {showEmpty ? (
          <div className="h-[600px] flex items-center justify-center">
            {hasActiveFilters ? (
              <EmptyState
                type="search"
                title="No releases found"
                description="No releases match your current filters. Try adjusting your search or status filter."
                showCTA={!!onResetFilters}
                ctaText="Reset Filters"
                onCtaClick={onResetFilters}
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
            {/* ALWAYS render `itemsPerPage` slots — show/hide via visibility so
                the list height is stable across loading ↔ loaded. */}
            {!error && (
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
            )}

            {/* Pagination — always present at the bottom for consistent spacing. */}
            <div className="mt-6 md:mt-8 flex justify-center">
              {isLoading ? (
                <div className="h-12 m-3 w-64" />
              ) : !error && releases.length > 0 && totalPages > 1 ? (
                <PersistentPaginationWrapper
                  isLoading={false}
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={onPageChange}
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
