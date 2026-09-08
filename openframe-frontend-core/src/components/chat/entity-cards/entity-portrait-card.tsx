'use client';

/**
 * <EntityPortraitCard> — THE portrait (rail/strip) card anatomy, shared by
 * EVERY entity card's `size="portrait"` density (case study, blog post,
 * customer interview, program, investor update, onboarding guide, …).
 *
 * One rail = one anatomy (2026 card-UI practice): identical zone boxes across
 * all content types —
 *   media  : aspect-[1200/630] slot + content-type chip overlay
 *   title  : fixed 72px zone, 3-line clamp (typography per entity via
 *            `titleClassName` — e.g. Azeret Mono for programs)
 *   footer : fixed 60px person zone (author avatar + name + subtitle, with
 *            the optional bottom-right icon overlay — the case-study MSP
 *            pattern)
 * Card surface, padding (p-6/gap-6) and the hover treatment (accent border +
 * accent shadow) are encoded HERE exactly once, so no per-card drift is
 * possible. Entity cards only MAP their row onto these props.
 *
 * Media rule ("our common way"): the REAL cover always wins. Wide covers
 * (OG-style 1200×630) fill the slot `object-cover`; a non-wide cover (square
 * podcast artwork) renders contained on an `useImageEdgeColor` background —
 * the SAME edge-sampled fill the media/news cards use (OGLinkPreview) — never
 * a flat filler and never the generic placeholder while a real image exists.
 * The cover → placeholder → hide resolution is the shared
 * `useCoverImageFallback` chain (one fallback logic for all entity cards).
 *
 * The content-type chip is the common <StatusBadge> and lives ABOVE the title
 * (an eyebrow inside the title zone), never overlaid on the artwork — branded
 * covers carry their own marks (Flamingo logo top-left) that an overlay would
 * collide with.
 */

import type React from 'react';
import { useState } from 'react';
import Image from '../../../embed-shims/next-image';
import { useImageEdgeColor } from '../../../hooks/ui/use-image-edge-color';
import { cn } from '../../../utils/cn';
import { Card } from '../../ui/card';
import { StatusBadge } from '../../ui/status-badge';
import { useCoverImageFallback } from './use-cover-image-fallback';

/** Sources narrower than this are "not wide" → contained on the edge-color
 *  fill. Wide covers are 1200/630 ≈ 1.9; squares are 1.0; 1.3 splits safely. */
const MIN_WIDE_RATIO = 1.3;

export interface EntityPortraitPerson {
  name: string;
  avatarUrl?: string | null;
  subtitle?: string | null;
  /** Small round overlay on the avatar's bottom-right corner (e.g. MSP icon). */
  iconOverlayUrl?: string | null;
}

export interface EntityPortraitCardProps {
  href: string;
  target?: '_blank';
  rel?: string;
  /** Content-type chip ('Case Study', 'Podcast', …). OMIT to hide the chip —
   *  single-type rails don't need per-card type identification; only mixed
   *  rails pass it. */
  typeLabel?: string;
  imageUrl?: string | null;
  /** Branded wide OG fallback — used when `imageUrl` is missing, errors, or
   *  isn't wide. */
  placeholderUrl?: string | null;
  imageAlt: string;
  title: string;
  /** Typography override for the title (entity identity), zone box unchanged. */
  titleClassName?: string;
  person?: EntityPortraitPerson | null;
  className?: string;
}

export function EntityPortraitCard({
  href,
  target,
  rel,
  typeLabel,
  imageUrl,
  placeholderUrl,
  imageAlt,
  title,
  titleClassName,
  person,
  className,
}: EntityPortraitCardProps) {
  const { src, onError: onMediaError } = useCoverImageFallback(imageUrl, placeholderUrl);
  // null = unknown (assume wide until the image reports its natural size).
  // The measurement carries the src it was taken from, so re-detection when the
  // source changes (prop change OR the fallback chain advancing to the
  // placeholder) is implicit — no effect writing `null` back into state, and no
  // frame in which the NEW cover is laid out using the PREVIOUS one's aspect.
  const [measured, setMeasured] = useState<{ src: string | null | undefined; isWide: boolean } | null>(null);
  const isWide = measured?.src === src ? measured.isWide : null;

  const onMediaLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setMeasured({ src, isWide: img.naturalWidth / img.naturalHeight >= MIN_WIDE_RATIO });
    }
  };

  // Edge-sampled slot fill for non-wide covers — the SAME hook/fallback the
  // media/news cards use (og-link-preview.tsx).
  const edgeColor = useImageEdgeColor(isWide === false ? src : null, 'var(--color-bg-surface)');

  return (
    <a href={href} target={target} rel={rel} className={cn('block h-full', className)} aria-label={`Open ${title}`}>
      <Card className="flex h-full flex-col gap-6 overflow-hidden border border-ods-border bg-ods-card p-6 transition-all duration-200 hover:border-ods-accent hover:shadow-lg hover:shadow-ods-accent/[0.08]">
        {/* Media zone — the real cover always wins: wide → cover-fill;
            non-wide → contained on the edge-color fill (news-card treatment). */}
        <div
          className="relative flex aspect-[1200/630] w-full shrink-0 items-center justify-center overflow-hidden rounded-sm bg-ods-bg transition-colors duration-300"
          style={isWide === false ? { backgroundColor: edgeColor } : undefined}
        >
          {src && (
            <Image
              src={src}
              alt={imageAlt}
              className={cn('h-full w-full', isWide === false ? 'object-contain' : 'object-cover')}
              sizes="(min-width: 800px) 400px, 100vw"
              fill
              unoptimized
              onLoad={onMediaLoad}
              onError={onMediaError}
            />
          )}
        </div>

        {/* Title zone — fixed box. Mixed rails: common StatusBadge eyebrow +
            2-line title (chip lives here, never on the artwork). Single-type
            rails (no typeLabel): centered 3-line title. */}
        <div className="flex h-[72px] shrink-0 flex-col justify-center gap-1.5">
          {typeLabel && (
            <StatusBadge
              variant="button"
              colorScheme="accentBorder"
              singleLine
              text={typeLabel}
              className="self-start"
            />
          )}
          <h3
            className={cn(
              'break-words leading-6 text-ods-text-primary text-h4',
              typeLabel ? 'line-clamp-2' : 'line-clamp-3',
              titleClassName,
            )}
          >
            {title}
          </h3>
        </div>

        {/* Person/footer zone — fixed box (kept even when empty so every card
            in a rail shares baselines). */}
        <div className="flex h-[60px] shrink-0 items-center">
          {person && (
            <div className="flex w-full min-w-0 items-center gap-3">
              <div className="relative h-12 w-12 shrink-0">
                {person.avatarUrl ? (
                  <Image
                    src={person.avatarUrl}
                    alt={person.name}
                    className="h-12 w-12 rounded-full border border-ods-border bg-ods-bg object-cover"
                    width={48}
                    height={48}
                    unoptimized
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-ods-border bg-ods-bg">
                    <span className="text-ods-text-secondary text-h4">{person.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                {person.iconOverlayUrl && (
                  <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-ods-text-primary ring-1 ring-ods-bg">
                    <Image
                      src={person.iconOverlayUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      width={24}
                      height={24}
                      unoptimized
                    />
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-bold text-ods-text-primary text-h6">{person.name}</span>
                {person.subtitle && <span className="truncate text-ods-text-secondary text-h6">{person.subtitle}</span>}
              </div>
            </div>
          )}
        </div>
      </Card>
    </a>
  );
}
