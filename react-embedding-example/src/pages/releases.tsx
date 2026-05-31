import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ProductReleasesView } from '@flamingo-stack/openframe-frontend-core/components'
import type { ProductReleaseListResponse } from '@flamingo-stack/openframe-frontend-core/types'
import { EP } from '../config/endpoints'

/**
 * Props-driven releases LIST — the §5 "every page-level surface is the same
 * shared lib component" instance. We fetch a page from /content/api/releases
 * ourselves and hand it to the lib's `<ProductReleasesView>` (the SAME view the
 * hub's `/releases` renders). No per-card prop builder is passed, so the view
 * uses the lib default (`defaultBuildProductReleaseCardProps`) — embedders that
 * want the richer lg metadata (Type/Status/changelog/author) pass their own
 * `buildCardProps`, exactly as the hub does.
 */
const ITEMS_PER_PAGE = 5

export function ReleasesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const currentPage = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
  const offset = (currentPage - 1) * ITEMS_PER_PAGE

  const releases = useQuery({
    queryKey: ['product-releases', currentPage],
    queryFn: async (): Promise<ProductReleaseListResponse> => {
      const res = await fetch(`${EP.productReleases}?limit=${ITEMS_PER_PAGE}&offset=${offset}`)
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      return res.json()
    },
    // Keep the previous page visible while the next loads so the pagination
    // control doesn't flicker out (totalPages momentarily 0) on page change.
    placeholderData: (prev) => prev,
  })

  const totalCount = releases.data?.count ?? 0
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', String(page))
    setSearchParams(params)
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-ods-text-primary">Product releases</h1>
      <ProductReleasesView
        releases={releases.data?.data ?? []}
        isLoading={releases.isLoading}
        error={releases.isError}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        // Soft TanStack refetch on error instead of the default full page
        // reload — the right UX for a reverse-proxy SPA embed.
        onRetry={() => releases.refetch()}
        itemsPerPage={ITEMS_PER_PAGE}
      />
    </div>
  )
}
