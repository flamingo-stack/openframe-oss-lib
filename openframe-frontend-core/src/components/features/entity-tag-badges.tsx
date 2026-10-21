'use client';

import Link from 'next/link';
import type { TagAssoc } from '../../types/blog';
import { cn } from '../../utils/cn';
import { LoadingItems, useLoadingScope } from '../ui/loading-scope';
import { StatusBadge } from '../ui/status-badge';

interface EntityTagBadgesProps {
  /** Flat `<entity>_tags[]` association array (from entity_tags hydration). */
  tags?: TagAssoc[] | null;
  /**
   * When set, each badge links to `${basePath}?tags=${slug}` (clickable, SPA nav
   * via next/link). Omit for a non-interactive display (badges with no slug also
   * render non-interactive even when basePath is set).
   */
  basePath?: string;
  /** Cap visible badges from tablet width up (a phone shows at most `ENTITY_TAG_BADGES_PHONE_CAP`); the remainder
   *  collapse into a "+N" badge. */
  max?: number;
  /** In a loading state with no `max`: how many tag boxes the row draws, at every width (default
   *  `ENTITY_TAG_BADGES_SKELETON_COUNT`, a typical row). */
  skeletonCount?: number;
  /** @deprecated Ignored: a loading row draws one count at every width (`skeletonCount`). */
  skeletonPhoneCount?: number;
  /** In a loading state: a host's typical tag label width (a sizing class) where its tags run longer or shorter than
   *  the default, so its skeleton row wraps where its typical row wraps. */
  skeletonItemClassName?: string;
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
 * A tag's label while it is read: a typical label's width, eight characters of the badge's monospaced type (loaded
 * badges measure 41 to 132px, typically about 90px: "AI AGENTS", "AI IN IT"), so the row wraps where a typical row
 * wraps: a capped row's phone cap of tags and its "+N" fit one line of a phone (342px), as a typical capped row does.
 */
const TAG_SKELETON_WIDTH_CLASS = 'w-[8ch]';
/** The "+N" badge's skeleton: the width of a two-digit count. */
const OVERFLOW_BADGE_SKELETON_CLASS = 'w-5';
/**
 * How many tags a CAPPED row (`max`) shows on a phone, loaded and loading: one line of a phone's column (342px) holds
 * two typical tags and the "+N" badge, while a third typical tag wraps the row to a second line. A layout fold, the
 * same for every host; from tablet width up the row shows its `max`.
 */
export const ENTITY_TAG_BADGES_PHONE_CAP = 2;
/** A capped row's tags past the phone cap: drawn from tablet width up only. */
const PAST_PHONE_CAP_CLASS = 'hidden content-md:inline-flex';

/**
 * A tag row while its tags are read: `count` badge boxes of the tag badge's size, the same count at every width (a
 * skeleton never hides items per breakpoint). Hosts pass their row's typical count; the default is
 * `ENTITY_TAG_BADGES_SKELETON_COUNT`. `overflow` adds the "+N" badge a row capped by `max` draws after its tags.
 */
export function EntityTagBadgesSkeleton({
  count = ENTITY_TAG_BADGES_SKELETON_COUNT,
  overflow = false,
  className,
  itemClassName,
}: {
  count?: number;
  /** @deprecated Ignored: the skeleton draws `count` at every width. */
  phoneCount?: number;
  overflow?: boolean;
  className?: string;
  /** A host's typical tag label width (a sizing class on each badge, in place of the default); the row keeps the
   *  row's own classes. */
  itemClassName?: string;
}) {
  return (
    <div aria-hidden className={cn(TAG_ROW_CLASS, className)}>
      <LoadingItems count={count}>
        {() => (
          <span className={TAG_ITEM_CLASS} data-loading-item>
            {/* The loaded badge's 1px border (its colours are the skeleton's). */}
            {/* The label's typical width: the host's (`itemClassName`), else the default. */}
            <StatusBadge
              loading
              text=""
              variant="card"
              className={cn('border', itemClassName ?? TAG_SKELETON_WIDTH_CLASS)}
            />
          </span>
        )}
      </LoadingItems>
      {/* The "+N" badge counts the tags left out: read data, so it is one of the list's items. */}
      {overflow && (
        <span className={TAG_ITEM_CLASS} data-loading-item>
          <StatusBadge loading text="" variant="card" className={cn('border', OVERFLOW_BADGE_SKELETON_CLASS)} />
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
  skeletonItemClassName,
  className,
}: EntityTagBadgesProps) {
  // A capped row draws its cap and its "+N" badge while it loads, in the row's own wrapping layout: the skeleton
  // takes the lines a typical capped row takes, and a loaded tag is never cut to fit it.
  if (useLoadingScope()) {
    return max == null ? (
      <EntityTagBadgesSkeleton count={skeletonCount} itemClassName={skeletonItemClassName} className={className} />
    ) : (
      <EntityTagBadgesSkeleton count={max} overflow itemClassName={skeletonItemClassName} className={className} />
    );
  }
  const items = (tags || []).filter((t): t is TagAssoc => !!t && !!t.name);
  if (items.length === 0) return null;

  // Only null/undefined means "no cap"; max={0} shows none, negatives clamp to 0.
  const visibleLimit = max == null ? items.length : Math.max(0, max);
  const shown = items.slice(0, visibleLimit);
  const overflow = items.length - shown.length;
  // A capped row shows fewer tags on a phone (the phone cap), and its "+N" counts what the phone row leaves out.
  const phoneLimit = max == null ? shown.length : Math.min(shown.length, ENTITY_TAG_BADGES_PHONE_CAP);
  const phoneOverflow = items.length - phoneLimit;
  const itemClass = (index: number) => cn(TAG_ITEM_CLASS, index >= phoneLimit && PAST_PHONE_CAP_CLASS);

  return (
    <div className={cn(TAG_ROW_CLASS, className)}>
      {shown.map((tag, index) => {
        const key = tag.tag_id ?? tag.id ?? tag.slug ?? tag.name;
        const label = (tag.name || '').toUpperCase();
        if (basePath && tag.slug) {
          return (
            <Link key={key} href={`${basePath}?tags=${tag.slug}`} className={itemClass(index)} data-loading-item>
              <StatusBadge
                text={label}
                variant="card"
                className={cn(BADGE_CLASS, 'cursor-pointer transition-colors hover:border-ods-accent')}
              />
            </Link>
          );
        }
        return (
          <span key={key} className={itemClass(index)} data-loading-item>
            <StatusBadge text={label} variant="card" className={BADGE_CLASS} />
          </span>
        );
      })}
      {phoneOverflow === overflow ? (
        overflow > 0 && <OverflowBadge count={overflow} />
      ) : (
        <>
          {phoneOverflow > 0 && <OverflowBadge count={phoneOverflow} className="content-md:hidden" />}
          {overflow > 0 && <OverflowBadge count={overflow} className={PAST_PHONE_CAP_CLASS} />}
        </>
      )}
    </div>
  );
}

/** The "+N" badge: how many tags the row leaves out (a phone's row and a wider row may leave out different counts). */
function OverflowBadge({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn(TAG_ITEM_CLASS, className)} data-loading-item>
      <StatusBadge text={`+${count}`} variant="card" className={cn(BADGE_CLASS, 'text-ods-text-secondary')} />
    </span>
  );
}
