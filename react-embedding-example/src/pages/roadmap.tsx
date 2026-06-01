import { DevSectionPage, RoadmapView } from '@flamingo-stack/openframe-frontend-core/components'
import { EP } from '../config/endpoints'

/**
 * Roadmap — config-only. `<DevSectionPage sectionKey="roadmap">` supplies the
 * canonical chrome (hero + search input + status filter pills, all URL-param-wired);
 * `<RoadmapView>` reads those params, fetches the filtered list, renders the grid,
 * and handles voting. This page supplies only the **api routes**.
 */
export function RoadmapPage() {
  return (
    <DevSectionPage sectionKey="roadmap">
      <RoadmapView
        endpoint={EP.roadmap}
        buildRefreshUrl={EP.roadmapById}
        votingOptions={{ voteApiEndpoint: EP.roadmapVote }}
      />
    </DevSectionPage>
  )
}
