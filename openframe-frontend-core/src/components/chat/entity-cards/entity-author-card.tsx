import type React from 'react';
import Link from '../../../embed-shims/next-link';
import type { EntityAuthor } from '../../../types/entity-author';
import { cn } from '../../../utils/cn';
import { formatDate, nameInitials } from '../../../utils/format';
import { TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { useLoadingScope } from '../../ui/loading-scope';
import { SQUARE_AVATAR_SIZE_CLASS, SquareAvatar } from '../../ui/square-avatar';

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
 * Documented empty-author placeholder for CHAT CARD surfaces ("—" name,
 * "Unknown" role). The release detail page deliberately keeps its legacy
 * empty rendering instead ("Unknown Author"/"Author" via a null-field stub
 * — see release-detail-page.tsx) — two documented empty styles, one cell.
 */
export const EMPTY_AUTHOR_PLACEHOLDER = {
  full_name: '—',
  avatar_url: null,
  job_title: 'Unknown',
} as const;

export interface EntityAuthorCardProps {
  author: EntityAuthor | null | undefined;
  /** Role label rendered under the name. Defaults to "Author". Override
   *  to e.g. "Presenter" / "Contributor" if semantics differ. */
  roleLabel?: string;
  /** Link target for the author name (e.g. the public author page). The
   *  HOST computes it (route availability is host knowledge) — absent ⇒
   *  plain text, exactly the prior render. */
  authorHref?: string;
  /** Optional publication date. When provided, the component renders as a
   *  2-cell grid (Published | Author). When omitted, only the Author cell
   *  renders inside the same bordered container. */
  publishedAt?: string | Date | null;
  /** Label for the Published cell. Defaults to "Published". */
  publishedLabel?: string;
  /**
   * Extra value cells inserted into the metadata grid BEFORE the
   * Published cell. Each item renders as an `<EntityMetadataValueCell>`
   * with a large `text-h4` value and a small `DM_Sans` 14px label.
   *
   * Use for entity-specific labels (e.g. onboarding-guide section/step,
   * webinar host, customer-interview customer). The grid auto-sizes via
   * `grid-cols-N`.
   *
   * `optional`: a cell only some records carry (a date a record may leave empty). It is not drawn in a loading scope
   * (list the cells every record has there) and its loaded cell is marked `data-loading-optional`.
   */
  extraCells?: Array<{ value: React.ReactNode; label: string; uppercase?: boolean; optional?: boolean }>;
  /** When true, render the author cell even when `author?.full_name` is
   *  missing — using the `EMPTY_AUTHOR_PLACEHOLDER` shape above. Used by
   *  catalog grids that must keep a fixed shape so skeleton alignment
   *  holds. Defaults to false. */
  renderEmptyAuthor?: boolean;
  className?: string;
}

/**
 * Single value cell — top: large `text-h4` value (uppercase), bottom: small
 * `DM_Sans` 14px secondary label. A non-text value (a `DepartmentBadge`) renders
 * as given in the value slot.
 */
/** The cells' layout, read by the cells and by their skeletons, so a skeleton is its cell's size. */
const VALUE_CELL_CLASS = 'flex flex-col gap-3 p-4';
const CELL_STACK_CLASS = 'flex flex-col gap-0';
const VALUE_TEXT_CLASS = 'text-ods-text-primary text-h4';
const VALUE_NODE_CLASS = 'flex min-h-6 items-center';
const LABEL_TEXT_CLASS = 'text-ods-text-secondary text-h6';
const AUTHOR_CELL_CLASS = 'flex items-center gap-3 p-4';
const AUTHOR_TEXT_CLASS = 'flex min-w-0 flex-1 flex-col gap-0';
const AUTHOR_NAME_CLASS = 'truncate text-ods-text-primary text-h3';
const AUTHOR_AVATAR_SIZE = 'md';
/** Every cell but the last: a divider below it on a phone, beside it from `md`. */
const CELL_DIVIDER_CLASS = 'border-b md:border-b-0 md:border-r border-ods-border';
const GRID_FRAME_CLASS = 'grid grid-cols-1 w-full overflow-hidden rounded-md border border-ods-border';

/** `md:grid-cols-N` for a grid of `cells` cells, as static classes the build can see. */
function gridColsClass(cells: number): string {
  return cells >= 4
    ? 'md:grid-cols-4'
    : cells === 3
      ? 'md:grid-cols-3'
      : cells === 2
        ? 'md:grid-cols-2'
        : 'md:grid-cols-1';
}

export function EntityMetadataValueCell({
  value,
  label,
  className,
  uppercase = true,
  optional = false,
}: {
  value: React.ReactNode;
  label: string;
  className?: string;
  uppercase?: boolean;
  /** A cell only some records carry: marked `data-loading-optional` (its loading state does not draw it). */
  optional?: boolean;
}) {
  if (useLoadingScope()) return <EntityMetadataValueCellSkeleton label={label} className={className} />;
  return (
    <div className={cn(VALUE_CELL_CLASS, className)} data-loading-optional={optional || undefined}>
      <div className={CELL_STACK_CLASS}>
        {typeof value === 'string' ? (
          <p className={VALUE_TEXT_CLASS}>{uppercase ? value.toLocaleUpperCase() : value}</p>
        ) : (
          <div className={VALUE_NODE_CLASS}>{value}</div>
        )}
        <p className={LABEL_TEXT_CLASS}>{label}</p>
      </div>
    </div>
  );
}

/** A value cell while its value is read: the label is the page's own words, the value a bar of its line. */
export function EntityMetadataValueCellSkeleton({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn(VALUE_CELL_CLASS, className)}>
      <div className={CELL_STACK_CLASS}>
        {/* The value's own paragraph (a read value that wraps to more lines pairs with it line for line). */}
        <p className={VALUE_TEXT_CLASS}>
          <TextLineSkeleton as="span" type="inherit" className="w-24" />
        </p>
        <p className={LABEL_TEXT_CLASS}>{label}</p>
      </div>
    </div>
  );
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
  author: NonNullable<EntityAuthorCardProps['author']>;
  roleLabel?: string;
  authorHref?: string;
  className?: string;
}) {
  const loading = useLoadingScope();
  if (loading) return <EntityMetadataAuthorCellSkeleton className={className} />;
  // Trimmed real name gates the LINK — a placeholder/unknown label must
  // never render as a clickable author (an authorHref passed alongside an
  // empty name would link "Unknown Author").
  const trimmedName = typeof author.full_name === 'string' ? author.full_name.trim() : '';
  const fullName = trimmedName || 'Unknown Author';
  return (
    <div className={cn(AUTHOR_CELL_CLASS, className)}>
      <SquareAvatar
        src={author.avatar_url || ''}
        alt={fullName}
        fallback={nameInitials(fullName, '')}
        size={AUTHOR_AVATAR_SIZE}
        variant="round"
      />
      <div className={AUTHOR_TEXT_CLASS}>
        {/* title = full-name tooltip on truncation (carried over from the
            release page's cell when it adopted this shared one). */}
        <p className={AUTHOR_NAME_CLASS} title={fullName}>
          {authorHref && trimmedName ? (
            <Link href={authorHref} className="transition-colors hover:text-ods-accent">
              {fullName}
            </Link>
          ) : (
            fullName
          )}
        </p>
        <p className={LABEL_TEXT_CLASS}>{author.job_title || roleLabel}</p>
      </div>
    </div>
  );
}

/** The author cell while it is read: the avatar's box and a bar for the name and the role (both read data). */
export function EntityMetadataAuthorCellSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(AUTHOR_CELL_CLASS, className)}>
      <UnifiedSkeleton variant="circular" className={cn('shrink-0', SQUARE_AVATAR_SIZE_CLASS[AUTHOR_AVATAR_SIZE])} />
      <div className={AUTHOR_TEXT_CLASS}>
        <TextLineSkeleton type="h3" className="w-32" />
        <TextLineSkeleton type="h6" className="w-20" />
      </div>
    </div>
  );
}

export interface EntityAuthorCardSkeletonProps {
  /** The labels of the extra cells, in order (the page's own words: "Section", "Customer"). */
  extraCellLabels?: string[];
  /** The Published cell's label, or `null` when the card has no Published cell. Defaults to "Published". */
  publishedLabel?: string | null;
  className?: string;
}

/**
 * The card while it is read: the same grid, every label real, every value a bar, the author cell an avatar box and
 * two bars. `EntityAuthorCard` draws it in a loading scope.
 */
export function EntityAuthorCardSkeleton({
  extraCellLabels = [],
  publishedLabel = 'Published',
  className,
}: EntityAuthorCardSkeletonProps) {
  const totalCells = extraCellLabels.length + (publishedLabel === null ? 0 : 1) + 1;
  return (
    <div className={cn(GRID_FRAME_CLASS, gridColsClass(totalCells), className)}>
      {extraCellLabels.map((label, i) => (
        <EntityMetadataValueCellSkeleton key={`${label}-${i}`} label={label} className={CELL_DIVIDER_CLASS} />
      ))}
      {publishedLabel !== null && (
        <EntityMetadataValueCellSkeleton label={publishedLabel} className={CELL_DIVIDER_CLASS} />
      )}
      <EntityMetadataAuthorCellSkeleton />
    </div>
  );
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
  const loading = useLoadingScope();
  // In a loading scope the card is its skeleton: its cells are the ones the caller asked for (a Published cell
  // when it passed `publishedAt` at all), never decided by data that is not read yet.
  if (loading) {
    return (
      <EntityAuthorCardSkeleton
        extraCellLabels={(extraCells ?? []).filter(cell => !cell.optional).map(cell => cell.label)}
        publishedLabel={publishedAt === undefined ? null : publishedLabel}
        className={className}
      />
    );
  }
  const hasAuthor = !!author?.full_name;
  if (!hasAuthor && !renderEmptyAuthor) return null;
  const effectiveAuthor = hasAuthor ? author : EMPTY_AUTHOR_PLACEHOLDER;

  // Resolve the date label. `formatDate` returns "Invalid Date" for
  // unparseable inputs; collapse that to empty so the cell is hidden, not
  // literal text.
  const formatted = publishedAt ? formatDate(publishedAt) : '';
  const dateLabel = formatted === 'Invalid Date' ? '' : formatted;

  const showDateCell = !!dateLabel;
  const extras = extraCells ?? [];
  // Total cell count = extras + (optional Published) + Author. The last cell (Author) closes the grid without a
  // trailing divider so the rounded corner stays clean.
  const totalCells = extras.length + (showDateCell ? 1 : 0) + 1;

  return (
    <div className={cn(GRID_FRAME_CLASS, gridColsClass(totalCells), className)}>
      {extras.map((cell, i) => (
        <EntityMetadataValueCell
          key={`${cell.label}-${i}`}
          value={cell.value}
          label={cell.label}
          uppercase={cell.uppercase ?? true}
          optional={cell.optional}
          className={CELL_DIVIDER_CLASS}
        />
      ))}
      {showDateCell && (
        <EntityMetadataValueCell
          value={dateLabel}
          label={publishedLabel}
          uppercase={false}
          className={CELL_DIVIDER_CLASS}
        />
      )}
      <EntityMetadataAuthorCell author={effectiveAuthor} roleLabel={roleLabel} authorHref={authorHref} />
    </div>
  );
}
