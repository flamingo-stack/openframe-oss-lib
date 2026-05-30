import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RoadmapGrid } from '@flamingo-stack/openframe-frontend-core/components'
import { fetchRoadmap } from '../data/content-api'
import { EP } from '../config/endpoints'
import { PageError, PageLoading } from '../components/page-state'

export function RoadmapPage() {
  const queryClient = useQueryClient()
  const roadmap = useQuery({ queryKey: ['roadmap'], queryFn: fetchRoadmap })

  if (roadmap.isLoading) return <PageLoading label="Loading roadmap…" />
  if (roadmap.isError) return <PageError title="Couldn't load roadmap" detail={String(roadmap.error?.message ?? '')} />

  return (
    <div className="p-6">
      <RoadmapGrid
        items={roadmap.data ?? []}
        // After a vote, RoadmapGrid refreshes the single task; refetch the list so counts update.
        onItemUpdate={() => queryClient.invalidateQueries({ queryKey: ['roadmap'] })}
        buildRefreshUrl={EP.roadmapById}
        votingOptions={{ voteApiEndpoint: EP.roadmapVote }}
      />
    </div>
  )
}
