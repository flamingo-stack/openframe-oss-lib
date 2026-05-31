import { RoadmapView } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

/**
 * Roadmap — config-only. The shared lib `<RoadmapView>` fetches the list,
 * renders the grid, and handles voting internally; this page supplies only the
 * **api routes** (list + per-task refresh + vote endpoints).
 */
export function RoadmapPage() {
  return (
    <div className="p-6">
      <RoadmapView
        endpoint={EP.roadmap}
        buildRefreshUrl={EP.roadmapById}
        votingOptions={{ voteApiEndpoint: EP.roadmapVote }}
      />
    </div>
  )
}
