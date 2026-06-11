import Link from '../../../embed-shims/next-link'
import type { EntityAuthor } from '../../../types/entity-author'
import { SquareAvatar } from '../../ui/square-avatar'
import { formatDate, nameInitials } from '../../../utils/format'

/**
 * Author + publication metadata, rendered as the SAME 2-or-N-cell grid pattern
 * the release detail page uses.
 *
 * Each cell sits inside a single bordered/rounded container, separated by
 * `border-r` dividers — byte-identical visual contract to the release page.
 *
 * Cell taxonomy:
 *   - `<EntityMetadataValueCell>` — top: large value (`text-h4` uppercase),
 *     bottom: small label (`DM_Sans` 14px secondary). Used for Type / Status
 *     / Date.
 *   - `<EntityMetadataAuthorCell>` — `<SquareAvatar>` + name + label. Used
 *     for the Author column.
 *
 * `<EntityAuthorCard>` is the convenience composer for the common
 * "Published + Author" pair. Pass `publishedAt` to get both cells; omit it
 * to get just the Author card (single-cell mode used by surfaces with no
 * separate publication-date concept).
 *
 * Renders null when `author` is null/empty unless `renderEmptyAuthor` is set.
 */
/**
 * Documented empty-author placeholder. Single source for the visual
 * shape of "author cell with no author".
 */
export const EMPTY_AUTHOR_PLACEHOLDER = {
  full_name: '—',
  avatar_url: null,
  job_title: 'Unknown',
} as const

export interface EntityAuthorCardProps {
  author: EntityAuthor | null | undefined
  /** Role label rendered under the name. Defaults to "Author". Override
   *  to e.g. "Presenter" / "Contributor" if semantics differ. */
  roleLabel?: string
  /** Link target for the author name (e.g. the public author page). The
   *  HOST computes it (route availability is host knowledge) — absent ⇒
   *  plain text, exactly the prior render. */
  authorHref?: string
  /** Optional publication date. When provided, the component renders as a
   *  2-cell grid (Published | Author). When omitted, only the Author cell
   *  renders inside the same bordered container. */
  publishedAt?: string | Date | null
  /** Label for the Published cell. Defaults to "Published". */
  publishedLabel?: string
  /**
   * Extra value cells inserted into the metadata grid BEFORE the
   * Published cell. Each item renders as an `<EntityMetadataValueCell>`
   * with a large `text-h4` value and a small `DM_Sans` 14px label.
   *
   * Use for entity-specific labels (e.g. onboarding-guide section/step,
   * webinar host, customer-interview customer). The grid auto-sizes via
   * `grid-cols-N`.
   */
  extraCells?: Array<{ value: string; label: string; uppercase?: boolean }>
  /** When true, render the author cell even when `author?.full_name` is
   *  missing — using the `EMPTY_AUTHOR_PLACEHOLDER` shape above. Used by
   *  catalog grids that must keep a fixed shape so skeleton alignment
   *  holds. Defaults to false. */
  renderEmptyAuthor?: boolean
  className?: string
}


/**
 * Single value cell — top: large `text-h4` value (uppercase), bottom: small
 * `DM_Sans` 14px secondary label.
 */
export function EntityMetadataValueCell({
  value,
  label,
  className,
  uppercase = true,
}: {
  value: string
  label: string
  className?: string
  uppercase?: boolean
}) {
  return (
    <div className={`bg-ods-card p-4 flex flex-col gap-3 ${className ?? ''}`}>
      <div className="flex flex-col gap-0">
        <p className="text-h4 text-ods-text-primary">
          {uppercase ? value.toLocaleUpperCase() : value}
        </p>
        <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
          {label}
        </p>
      </div>
    </div>
  )
}

/**
 * Author cell — `<SquareAvatar>` + name + role label. The containing border /
 * divider is the caller's responsibility — this is just the cell content.
 */
export function EntityMetadataAuthorCell({
  author,
  roleLabel = 'Author',
  authorHref,
  className,
}: {
  author: NonNullable<EntityAuthorCardProps['author']>
  roleLabel?: string
  authorHref?: string
  className?: string
}) {
  const fullName = author.full_name || 'Unknown Author'
  return (
    <div className={`bg-ods-card p-4 flex items-center gap-3 ${className ?? ''}`}>
      <SquareAvatar
        src={author.avatar_url || ''}
        alt={fullName}
        fallback={nameInitials(fullName, '')}
        size="md"
        variant="round"
      />
      <div className="flex flex-col gap-0 flex-1 min-w-0">
        {/* title = full-name tooltip on truncation (carried over from the
            release page's cell when it adopted this shared one). */}
        <p className="text-h3 tracking-[-0.36px] text-ods-text-primary truncate" title={fullName}>
          {authorHref ? (
            <Link href={authorHref} className="hover:text-ods-accent transition-colors">
              {fullName}
            </Link>
          ) : (
            fullName
          )}
        </p>
        <p className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-ods-text-secondary">
          {author.job_title || roleLabel}
        </p>
      </div>
    </div>
  )
}

export function EntityAuthorCard({
  author,
  roleLabel = 'Author',
  authorHref,
  publishedAt,
  publishedLabel = 'Published',
  extraCells,
  renderEmptyAuthor = false,
  className,
}: EntityAuthorCardProps) {
  const hasAuthor = !!author?.full_name
  if (!hasAuthor && !renderEmptyAuthor) return null
  const effectiveAuthor = hasAuthor ? (author as NonNullable<EntityAuthorCardProps['author']>) : EMPTY_AUTHOR_PLACEHOLDER

  // Resolve the date label. `formatDate` returns "Invalid Date" for
  // unparseable inputs; collapse that to empty so the cell is hidden, not
  // literal text.
  const formatted = publishedAt ? formatDate(publishedAt as Date | string) : ''
  const dateLabel = formatted === 'Invalid Date' ? '' : formatted

  const showDateCell = !!dateLabel
  const extras = extraCells ?? []
  // Total cell count = extras + (optional Published) + Author. Map to
  // an explicit tailwind `md:grid-cols-N` class string so JIT picks it
  // up at build time.
  const totalCells = extras.length + (showDateCell ? 1 : 0) + 1
  const gridColsClass =
    totalCells >= 4 ? 'md:grid-cols-4'
    : totalCells === 3 ? 'md:grid-cols-3'
    : totalCells === 2 ? 'md:grid-cols-2'
    : 'md:grid-cols-1'

  // Helper — every cell EXCEPT the last needs the dividers (bottom on
  // mobile, right on desktop). The last cell (Author) closes the grid
  // without a trailing divider so the rounded corner stays clean.
  const dividerClass = 'border-b md:border-b-0 md:border-r border-ods-border'

  return (
    <div
      className={`grid grid-cols-1 ${gridColsClass} border border-ods-border rounded-md overflow-hidden w-full ${className ?? ''}`}
    >
      {extras.map((cell, i) => (
        <EntityMetadataValueCell
          key={`${cell.label}-${i}`}
          value={cell.value}
          label={cell.label}
          uppercase={cell.uppercase ?? true}
          className={dividerClass}
        />
      ))}
      {showDateCell && (
        <EntityMetadataValueCell
          value={dateLabel}
          label={publishedLabel}
          uppercase={false}
          className={dividerClass}
        />
      )}
      <EntityMetadataAuthorCell author={effectiveAuthor} roleLabel={roleLabel} authorHref={authorHref} />
    </div>
  )
}
