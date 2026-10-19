'use client';

import Link from 'next/link';
import type { TagAssoc } from '../../types/blog';
import { cn } from '../../utils/cn';
import { useLoadingScope } from '../ui/loading-scope';
import { StatusBadge, StatusBadgeSkeleton } from '../ui/status-badge';

interface EntityTagBadgesProps {
  /** Flat `<entity>_tags[]` association array (from entity_tags hydration). */
  tags?: TagAssoc[] | null;
  /**
   * When set, each badge links to `${basePath}?tags=${slug}` (clickable, SPA nav
   * via next/link). Omit for a non-interactive display (badges with no slug also
   * render non-interactive even when basePath is set).
   */
  basePath?: string;
  /** Cap visible badges; the remainder collapse into a "+N" badge. */
  max?: number;
  /** In a loading state with no `max`: how many tag boxes the row draws from tablet width up (default the row's fold). */
  skeletonCount?: number;
  /** In a loading state with no `max`: how many tag boxes a phone's row draws (default `skeletonCount`). */
  skeletonPhoneCount?: number;
  /** Extra classes on the wrapper row. */
  className?: string;
}

// The ONE tag-badge skin (OpenFrame design): rounded-rect, font-mono uppercase
// StatusBadge on ods-card + ods-border. Clickable badges add the accent hover.
// Exported so other tag-shaped chips (e.g. FaqAccordion's section badge)
// render the IDENTICAL skin without re-declaring it.
export const TAG_BADGE_CLASS = 'bg-ods-card border border-ods-border';
const BADGE_CLASS = TAG_BADGE_CLASS;

/**
 * THE single tag-badge renderer for the whole product (hub + lib). Renders the
 * OpenFrame `StatusBadge` chip skin for a flat `<entity>_tags[]` array, optionally
 * clickable (links each tag to its filtered list via `basePath`). The hub's
 * `EntityTagList` delegates here so there is exactly one tag-display design.
 * Renders nothing when there are no tags.
 */
/** The row's layout, read by the row and by its skeleton. */
const TAG_ROW_CLASS = 'flex w-full flex-wrap items-center gap-2';
/**
 * Each tag's box: the tags are a read list (`data-loading-item`: how many there are, and so how many lines the row
 * wraps to, is the record's).
 */
const TAG_ITEM_CLASS = 'inline-flex';
/** How many tags a row usually shows: what its loading state draws. */
export const ENTITY_TAG_BADGES_SKELETON_COUNT = 3;

/**
 * A tag's label while it is read: a typical label's width, ten characters of the badge's monospaced type (measured
 * across records, a tag is about ten characters, e.g. "COMPLIANCE"), so the row wraps where a typical row wraps.
 */
const TAG_SKELETON_WIDTH_CLASS = 'w-[10ch]';
/** The "+N" badge's skeleton: the width of a two-digit count. */
const OVERFLOW_BADGE_SKELETON_CLASS = 'w-5';

/**
 * A tag row while its tags are read: `count` badge boxes of the tag badge's size (the row's fold from tablet width
 * up), and `phoneCount` below that width when a phone's row shows fewer (or more) before it wraps. Hosts pass their
 * row's layout fold (`<THING>_TAG_ROW_FOLD`); the default is `ENTITY_TAG_BADGES_SKELETON_COUNT`. `overflow` adds the
 * "+N" badge a row capped by `max` draws after its tags.
 */
export function EntityTagBadgesSkeleton({
  count = ENTITY_TAG_BADGES_SKELETON_COUNT,
  phoneCount = count,
  overflow = false,
  className,
  itemClassName,
}: {
  count?: number;
  phoneCount?: number;
  overflow?: boolean;
  className?: string;
  /** Extra classes on each tag's box (a host's typical tag width); the row keeps the row's own classes. */
  itemClassName?: string;
}) {
  return (
    <div aria-hidden className={cn(TAG_ROW_CLASS, className)}>
      {Array.from({ length: Math.max(count, phoneCount) }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton badges never reorder
          key={i}
          className={cn(
            TAG_ITEM_CLASS,
            itemClassName,
            i >= phoneCount && 'hidden content-md:inline-flex',
            i >= count && 'content-md:hidden',
          )}
          data-loading-item
        >
          {/* The loaded badge's 1px border (its colours are the skeleton's). */}
          {/* A host's typical tag width (`itemClassName`) is the box's: the badge fills it. */}
          <StatusBadgeSkeleton
            variant="card"
            className={cn('border', itemClassName ? 'box-border w-full' : TAG_SKELETON_WIDTH_CLASS)}
          />
        </span>
      ))}
      {/* The "+N" badge counts the tags left out: read data, so it is one of the list's items. */}
      {overflow && (
        <span className={TAG_ITEM_CLASS} data-loading-item>
          <StatusBadgeSkeleton variant="card" className={cn('border', OVERFLOW_BADGE_SKELETON_CLASS)} />
        </span>
      )}
    </div>
  );
}

export function EntityTagBadges({
  tags,
  basePath,
  max,
  skeletonCount,
  skeletonPhoneCount,
  className,
}: EntityTagBadgesProps) {
  // A capped row draws its cap and its "+N" badge while it loads, in the row's own wrapping layout: the skeleton
  // takes the lines a typical capped row takes, and a loaded tag is never cut to fit it.
  if (useLoadingScope()) {
    return max == null ? (
      <EntityTagBadgesSkeleton count={skeletonCount} phoneCount={skeletonPhoneCount} className={className} />
    ) : (
      <EntityTagBadgesSkeleton count={max} overflow className={className} />
    );
  }
  const items = (tags || []).filter((t): t is TagAssoc => !!t && !!t.name);
  if (items.length === 0) return null;

  // Only null/undefined means "no cap"; max={0} shows none, negatives clamp to 0.
  const visibleLimit = max == null ? items.length : Math.max(0, max);
  const shown = items.slice(0, visibleLimit);
  const overflow = items.length - shown.length;

  return (
    <div className={cn(TAG_ROW_CLASS, className)}>
      {shown.map(tag => {
        const key = tag.tag_id ?? tag.id ?? tag.slug ?? tag.name;
        const label = (tag.name || '').toUpperCase();
        if (basePath && tag.slug) {
          return (
            <Link key={key} href={`${basePath}?tags=${tag.slug}`} className={TAG_ITEM_CLASS} data-loading-item>
              <StatusBadge
                text={label}
                variant="card"
                className={cn(BADGE_CLASS, 'cursor-pointer transition-colors hover:border-ods-accent')}
              />
            </Link>
          );
        }
        return (
          <span key={key} className={TAG_ITEM_CLASS} data-loading-item>
            <StatusBadge text={label} variant="card" className={BADGE_CLASS} />
          </span>
        );
      })}
      {overflow > 0 && (
        <span className={TAG_ITEM_CLASS} data-loading-item>
          <StatusBadge text={`+${overflow}`} variant="card" className={cn(BADGE_CLASS, 'text-ods-text-secondary')} />
        </span>
      )}
    </div>
  );
}
