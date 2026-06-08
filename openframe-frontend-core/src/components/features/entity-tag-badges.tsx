import Link from 'next/link'
import { StatusBadge } from '../ui/status-badge'
import type { TagAssoc } from '../../types/blog'

interface EntityTagBadgesProps {
  /** Flat `<entity>_tags[]` association array (from entity_tags hydration). */
  tags?: TagAssoc[] | null
  /**
   * When set, each badge links to `${basePath}?tags=${slug}` (clickable, SPA nav
   * via next/link). Omit for a non-interactive display (badges with no slug also
   * render non-interactive even when basePath is set).
   */
  basePath?: string
  /** Cap visible badges; the remainder collapse into a "+N" badge. */
  max?: number
  /** Extra classes on the wrapper row. */
  className?: string
}

// The ONE tag-badge skin (OpenFrame design): rounded-rect, font-mono uppercase
// StatusBadge on ods-card + ods-border. Clickable badges add the accent hover.
const BADGE_CLASS = 'bg-ods-card border border-ods-border'

/**
 * THE single tag-badge renderer for the whole product (hub + lib). Renders the
 * OpenFrame `StatusBadge` chip skin for a flat `<entity>_tags[]` array, optionally
 * clickable (links each tag to its filtered list via `basePath`). The hub's
 * `EntityTagList` delegates here so there is exactly one tag-display design.
 * Renders nothing when there are no tags.
 */
export function EntityTagBadges({ tags, basePath, max, className }: EntityTagBadgesProps) {
  const items = (tags || []).filter((t): t is TagAssoc => !!t && !!t.name)
  if (items.length === 0) return null

  const shown = max ? items.slice(0, max) : items
  const overflow = max ? items.length - shown.length : 0

  return (
    <div className={`flex flex-wrap items-center gap-2 w-full ${className || ''}`}>
      {shown.map((tag) => {
        const key = tag.tag_id ?? tag.id ?? tag.slug ?? tag.name
        const label = (tag.name || '').toUpperCase()
        if (basePath && tag.slug) {
          return (
            <Link key={key} href={`${basePath}?tags=${tag.slug}`} className="inline-flex">
              <StatusBadge
                text={label}
                variant="card"
                className={`${BADGE_CLASS} cursor-pointer transition-colors hover:border-ods-accent`}
              />
            </Link>
          )
        }
        return <StatusBadge key={key} text={label} variant="card" className={BADGE_CLASS} />
      })}
      {overflow > 0 && (
        <StatusBadge text={`+${overflow}`} variant="card" className={`${BADGE_CLASS} text-ods-text-secondary`} />
      )}
    </div>
  )
}
