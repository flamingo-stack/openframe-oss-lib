import { StatusBadge } from '../ui/status-badge'
import type { TagAssoc } from '../../types/blog'

interface EntityTagBadgesProps {
  /** Flat `<entity>_tags[]` association array (from entity_tags hydration). */
  tags?: TagAssoc[] | null
  /** Extra classes on the wrapper row. */
  className?: string
}

/**
 * The single lib-side tag-badge renderer for detail views (release, onboarding
 * guide, …). Lib-package analogue of the hub's `EntityTagList` — the hub can't
 * be imported here, so this lives in the lib and is reused across lib detail
 * pages instead of each one re-implementing the StatusBadge chip row. Renders
 * nothing when there are no tags.
 */
export function EntityTagBadges({ tags, className }: EntityTagBadgesProps) {
  if (!tags || tags.length === 0) return null
  return (
    <div className={`flex flex-wrap gap-2 w-full ${className || ''}`}>
      {tags.map((tag) => (
        <StatusBadge
          key={tag.tag_id ?? tag.id}
          text={(tag.name || '').toUpperCase()}
          variant="card"
          className="bg-ods-card border border-ods-border"
        />
      ))}
    </div>
  )
}
