'use client';

import { cn } from '../../../utils/cn';
import { CONTENT_CARD_SKELETON_FRAME_CLASS } from '../../chat/entity-cards/content-card-frame';
import { UnifiedSkeleton } from '../../loading/unified-skeleton';

export interface ProductReleaseCardSkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Card density. Must match the loaded card's `size` prop so the loading
   *  height matches the resolved height (no layout shift on resolve). */
  size?: 'lg' | 'sm';
}

export function ProductReleaseCardSkeleton({ className, size = 'lg' }: ProductReleaseCardSkeletonProps) {
  // ----- LG branch — must match ProductReleaseCard size='lg'.
  // Same outer frame (`bg-ods-card border border-ods-border …
  // p-6 gap-4`). Inner: hero (16:9 cover + version pill + title + summary),
  // changelog strip placeholder, metadata-grid footer (4 cells via grid).
  // Heights chosen to match the loaded card's rendered metrics so the
  // 5-card slot grid in `ReleasesList` doesn't jump on resolve. The
  // loaded card ALSO always renders the changelog strip + a fixed 4-cell
  // grid (with em-dash placeholders for missing values), so this
  // skeleton's shape matches exactly with zero load-to-resolve reflow.
  if (size === 'lg') {
    return (
      <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, 'flex flex-col gap-4 p-6', className)}>
        {/* HERO: placeholders are `UnifiedSkeleton` bars on the page background.

            CRITICAL: title + summary use the SAME min-h containers as
            the loaded card so total card height is byte-identical
            between skeleton state and loaded state. Without this,
            individual placeholder heights underrun the loaded card's
            min-h reservations and the page jumps on resolve. */}
        <div className="flex flex-col gap-4 content-md:flex-row content-md:gap-6">
          <UnifiedSkeleton className="aspect-[1200/630] w-full flex-shrink-0 rounded-lg content-md:w-[256px]" />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Version pill — mirrors `flex items-center gap-3 mb-3` in
                the loaded card. The loaded `<span text-lg>` renders at
                line-height 28 px (Tailwind text-lg = 18 px / 28 px LH);
                placeholder uses `h-7` (28 px) to match exactly. */}
            <div className="mb-3 flex items-center gap-3">
              <UnifiedSkeleton className="h-7 w-20 rounded" />
            </div>
            {/* Title container — SAME min-h as the loaded card so the
                card height contributed by this region matches exactly. */}
            <div className="mb-3 flex min-h-[60px] flex-col justify-start gap-1.5 content-md:min-h-[72px]">
              <UnifiedSkeleton className="h-[25px] w-3/4 rounded content-md:h-[30px]" />
              <UnifiedSkeleton className="h-[25px] w-1/2 rounded content-md:h-[30px]" />
            </div>
            {/* Summary container — SAME min-h as the loaded card. The
                3 placeholder lines mirror the rendered 3-line clamp. */}
            <div className="flex min-h-[68px] flex-col justify-start gap-2 content-md:min-h-[78px]">
              <UnifiedSkeleton className="h-3 w-full rounded" />
              <UnifiedSkeleton className="h-3 w-11/12 rounded" />
              <UnifiedSkeleton className="h-3 w-5/6 rounded" />
            </div>
          </div>
        </div>

        {/* CHANGELOG strip placeholder — always rendered. Inner
            placeholder `h-5` mirrors the loaded strip's `text-sm`
            line-height (20 px) so total height is consistent with the
            loaded `border-t pt-3 + text content` (~32-33 px). */}
        <div className="border-t border-ods-border pt-3">
          <UnifiedSkeleton className="h-5 w-2/3 rounded" />
        </div>

        {/* METADATA GRID: 4-cell placeholder, the loaded cells' own boxes (no surface of
            their own; bars on the page background). Inner heights mirror the loaded cells. */}
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-md border border-ods-border content-md:grid-cols-4">
          {[0, 1, 2].map(i => (
            <div
              key={`cell-${i}`}
              className="flex flex-col gap-3 border-b border-ods-border p-4 content-md:border-b-0 content-md:border-r"
            >
              <div className="flex flex-col gap-2">
                <UnifiedSkeleton className="h-7 w-24 rounded" />
                <UnifiedSkeleton className="h-4 w-16 rounded" />
              </div>
            </div>
          ))}
          {/* Author cell */}
          <div className="flex items-center gap-3 p-4">
            <UnifiedSkeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <UnifiedSkeleton className="h-5 w-3/4 rounded" />
              <UnifiedSkeleton className="h-4 w-1/2 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ----- COMPACT branch — must match ProductReleaseCard size='sm' exactly.
  // Same outer: span + items-start + gap-3 + p-2 + my-1.5 (no border to keep
  // the skeleton 1px lighter than the resolved card is fine — but we mirror
  // the border too so width is byte-identical). Inner row 1 = title +
  // version-pill; row 2 = date; row 3 = summary line. Heights/widths chosen
  // to match the rendered card line-heights (text-sm = 14px line-height-20,
  // text-[11px] = 11/16). The total height comes out the same as the loaded
  // card so the chat message height does NOT jump on resolve.
  if (size === 'sm') {
    return (
      <span
        className={cn(
          'my-1.5 flex w-full items-start gap-3',
          'rounded-lg border border-ods-border bg-ods-card p-2',
          className,
        )}
      >
        <UnifiedSkeleton as="span" className="block aspect-square h-14 w-14 shrink-0 self-start rounded-md" />
        {/* Text column: 3 rows with FIXED heights matching the loaded
            card (h-5 title, h-4 + h-4 meta + summary). Skeleton bars
            sit centered inside each row container so a placeholder
            occupies the SAME pixel position as the loaded text will
            on resolve. */}
        <span className="flex min-h-14 min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex h-5 min-w-0 items-center gap-2">
            <UnifiedSkeleton as="span" className="h-3.5 w-3/5 rounded" />
            <UnifiedSkeleton as="span" className="h-4 w-12 shrink-0 rounded" />
          </span>
          <span className="flex h-4 min-w-0 items-center">
            <UnifiedSkeleton as="span" className="h-3 w-1/3 rounded" />
          </span>
          <span className="flex h-4 min-w-0 items-center">
            <UnifiedSkeleton as="span" className="h-3 w-11/12 rounded" />
          </span>
        </span>
      </span>
    );
  }

  // Unreachable — `size` is typed `'lg' | 'sm'` and both branches return
  // above. Kept as a defensive throw so a future variant addition that
  // forgets to return doesn't silently render `undefined`.
  throw new Error(`ProductReleaseCardSkeleton: unsupported size '${size as string}'`);
}
