import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ReleaseDetailPage, RoadmapGrid } from '@flamingo-stack/openframe-frontend-core/components'
import type { RoadmapItem } from '@flamingo-stack/openframe-frontend-core/components/chat'
import { EP } from '../config/endpoints'

/**
 * Host-supplied data hook — ReleaseDetailPage REQUIRES this so it fetches through the
 * app's QueryClient. Points at the hub's public single-release route
 * (`/content/api/releases/<slug>`); a miss surfaces the lib's error state (no crash).
 */
function useRelease(slug: string | undefined) {
  const query = useQuery({
    queryKey: ['product-release', slug],
    queryFn: async () => {
      const res = await fetch(EP.productReleaseBySlug(slug!))
      if (!res.ok) throw new Error(`Request failed (${res.status})`)
      return res.json()
    },
    enabled: !!slug,
  })
  return { data: query.data, error: (query.error as Error) ?? null, isLoading: query.isLoading }
}

// Injected roadmap section — wraps RoadmapGrid so linked roadmap items vote/refresh via /content.
function RoadmapSection({
  items,
  onItemUpdate,
}: {
  items: RoadmapItem[]
  isLoading: boolean
  onItemUpdate?: (item: RoadmapItem) => void
}) {
  return (
    <RoadmapGrid
      items={items}
      onItemUpdate={onItemUpdate}
      buildRefreshUrl={EP.roadmapById}
      votingOptions={{ voteApiEndpoint: EP.roadmapVote }}
      showLeftMargin={false}
    />
  )
}

export function ReleaseDetailRoute() {
  const { slug = '' } = useParams()
  return (
    <ReleaseDetailPage
      slug={slug}
      useRelease={useRelease}
      RoadmapSection={RoadmapSection}
      roadmapApiEndpoint={EP.roadmap}
      deliveryApiEndpoint={EP.deliveryCompleted}
      backButton={{ label: 'Back to releases', href: '/releases' }}
    />
  )
}
