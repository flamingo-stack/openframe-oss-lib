'use client';

import { cn } from '../../../utils/cn';

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
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-ods-border bg-ods-card',
          'flex flex-col gap-4 p-6',
          'animate-pulse',
          className,
        )}
      >
        {/* HERO — placeholders use `bg-ods-border` (#3a3a3a) so they
            contrast against the card's `bg-ods-card`
            (#212121) container. The metadata grid cells below use
            `bg-ods-card` containers so `bg-ods-bg` placeholders work
            there, but in the hero the card IS `bg-ods-card`-equivalent —
            `bg-ods-bg` (#161616) is only 6 hex points darker than the
            card and renders nearly invisible.

            CRITICAL: title + summary use the SAME min-h containers as
            the loaded card so total card height is byte-identical
            between skeleton state and loaded state. Without this,
            individual placeholder heights underrun the loaded card's
            min-h reservations and the page jumps on resolve. */}
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <div className="aspect-[1200/630] w-full flex-shrink-0 rounded-lg bg-ods-border md:w-[256px]" />
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Version pill — mirrors `flex items-center gap-3 mb-3` in
                the loaded card. The loaded `<span text-lg>` renders at
                line-height 28 px (Tailwind text-lg = 18 px / 28 px LH);
                placeholder uses `h-7` (28 px) to match exactly. */}
            <div className="mb-3 flex items-center gap-3">
              <div className="h-7 w-20 rounded bg-ods-border" />
            </div>
            {/* Title container — SAME min-h as the loaded card so the
                card height contributed by this region matches exactly. */}
            <div className="mb-3 flex min-h-[60px] flex-col justify-start gap-1.5 md:min-h-[72px]">
              <div className="h-[25px] w-3/4 rounded bg-ods-border md:h-[30px]" />
              <div className="h-[25px] w-1/2 rounded bg-ods-border md:h-[30px]" />
            </div>
            {/* Summary container — SAME min-h as the loaded card. The
                3 placeholder lines mirror the rendered 3-line clamp;
                `bg-ods-border/70` keeps summary placeholders slightly
                dimmer than title placeholders (primary vs secondary
                text hierarchy). */}
            <div className="flex min-h-[68px] flex-col justify-start gap-2 md:min-h-[78px]">
              <div className="h-3 w-full rounded bg-ods-border/70" />
              <div className="h-3 w-11/12 rounded bg-ods-border/70" />
              <div className="h-3 w-5/6 rounded bg-ods-border/70" />
            </div>
          </div>
        </div>

        {/* CHANGELOG strip placeholder — always rendered. Inner
            placeholder `h-5` mirrors the loaded strip's `text-sm`
            line-height (20 px) so total height is consistent with the
            loaded `border-t pt-3 + text content` (~32-33 px). */}
        <div className="border-t border-ods-border pt-3">
          <div className="h-5 w-2/3 rounded bg-ods-border/70" />
        </div>

        {/* METADATA GRID — 4-cell placeholder. The grid cells use
            `bg-ods-card` containers and `bg-ods-bg` placeholders, which
            DO contrast correctly because the cells are brighter than
            the placeholders. Inner content heights mirror the loaded
            cells (`text-h4` ≈ 28 px + `DM_Sans 14px leading-20`) so
            total grid height matches the loaded ~86 px. */}
        <div className="grid w-full grid-cols-1 overflow-hidden rounded-md border border-ods-border md:grid-cols-4">
          {[0, 1, 2].map(i => (
            <div
              key={`cell-${i}`}
              className="flex flex-col gap-3 border-b border-ods-border bg-ods-card p-4 md:border-b-0 md:border-r"
            >
              <div className="flex flex-col gap-2">
                <div className="h-7 w-24 rounded bg-ods-bg" />
                <div className="h-4 w-16 rounded bg-ods-bg/60" />
              </div>
            </div>
          ))}
          {/* Author cell */}
          <div className="flex items-center gap-3 bg-ods-card p-4">
            <div className="h-10 w-10 shrink-0 rounded-full bg-ods-bg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="h-5 w-3/4 rounded bg-ods-bg" />
              <div className="h-4 w-1/2 rounded bg-ods-bg/60" />
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
          'my-1.5 flex w-full animate-pulse items-start gap-3',
          'rounded-lg border border-ods-border bg-ods-card p-2',
          className,
        )}
      >
        <span className="block aspect-square h-14 w-14 shrink-0 self-start rounded-md bg-ods-bg" />
        {/* Text column: 3 rows with FIXED heights matching the loaded
            card (h-5 title, h-4 + h-4 meta + summary). Skeleton bars
            sit centered inside each row container so a placeholder
            occupies the SAME pixel position as the loaded text will
            on resolve. */}
        <span className="flex min-h-14 min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex h-5 min-w-0 items-center gap-2">
            <span className="h-3.5 w-3/5 rounded bg-ods-bg" />
            <span className="h-4 w-12 shrink-0 rounded bg-ods-bg/70" />
          </span>
          <span className="flex h-4 min-w-0 items-center">
            <span className="h-3 w-1/3 rounded bg-ods-bg/70" />
          </span>
          <span className="flex h-4 min-w-0 items-center">
            <span className="h-3 w-11/12 rounded bg-ods-bg/40" />
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
