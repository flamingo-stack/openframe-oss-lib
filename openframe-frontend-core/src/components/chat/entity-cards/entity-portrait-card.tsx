'use client'

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
 * Media rule ("our common way"): covers are branded WIDE images (OG-style,
 * 1200×630) rendered `object-cover`; when a source turns out not to be wide
 * (e.g. square podcast artwork) it swaps to the branded `placeholderUrl` —
 * never letterboxed art on a filler background.
 */

import React, { useEffect, useState } from 'react'
import Image from '../../../embed-shims/next-image'
import { Card } from '../../ui/card'
import { cn } from '../../../utils/cn'

/** Sources narrower than this are "not wide" → swap to the placeholder.
 *  Wide covers are 1200/630 ≈ 1.9; squares are 1.0; 1.3 splits them safely. */
const MIN_WIDE_RATIO = 1.3

export interface EntityPortraitPerson {
  name: string
  avatarUrl?: string | null
  subtitle?: string | null
  /** Small round overlay on the avatar's bottom-right corner (e.g. MSP icon). */
  iconOverlayUrl?: string | null
}

export interface EntityPortraitCardProps {
  href: string
  target?: '_blank'
  rel?: string
  /** Content-type chip on the media slot ('Case Study', 'Podcast', …). */
  typeLabel: string
  imageUrl?: string | null
  /** Branded wide OG fallback — used when `imageUrl` is missing, errors, or
   *  isn't wide. */
  placeholderUrl?: string | null
  imageAlt: string
  title: string
  /** Typography override for the title (entity identity), zone box unchanged. */
  titleClassName?: string
  person?: EntityPortraitPerson | null
  className?: string
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
  const [src, setSrc] = useState<string | null>(imageUrl || placeholderUrl || null)
  useEffect(() => {
    setSrc(imageUrl || placeholderUrl || null)
  }, [imageUrl, placeholderUrl])

  return (
    <a href={href} target={target} rel={rel} className={cn('block h-full', className)} aria-label={`Open ${title}`}>
      <Card className="bg-ods-card border border-ods-border hover:border-ods-accent hover:shadow-lg hover:shadow-ods-accent/[0.08] transition-all duration-200 p-6 flex flex-col gap-6 overflow-hidden h-full">
        {/* Media zone — branded wide cover + content-type chip. */}
        <div className="relative w-full aspect-[1200/630] rounded-sm overflow-hidden bg-ods-bg shrink-0">
          {src && (
            <Image
              src={src}
              alt={imageAlt}
              className="w-full h-full object-cover"
              sizes="(min-width: 800px) 400px, 100vw"
              fill
              unoptimized
              onLoad={e => {
                // Non-wide source (square artwork, logos) → branded placeholder.
                const img = e.currentTarget as HTMLImageElement
                if (
                  src === imageUrl &&
                  placeholderUrl &&
                  img.naturalWidth > 0 &&
                  img.naturalHeight > 0 &&
                  img.naturalWidth / img.naturalHeight < MIN_WIDE_RATIO
                ) {
                  setSrc(placeholderUrl)
                }
              }}
              onError={() => {
                // Same recovery pattern every cover-image render path uses.
                if (src === imageUrl && placeholderUrl) setSrc(placeholderUrl)
                else setSrc(null)
              }}
            />
          )}
          <span className="absolute left-3 top-3 rounded-md border border-ods-border bg-ods-bg/90 px-2 py-0.5 font-['DM_Sans'] text-xs font-medium text-ods-accent">
            {typeLabel}
          </span>
        </div>

        {/* Title zone — fixed box, per-entity typography. */}
        <div className="h-[72px] flex items-center shrink-0">
          <h3 className={cn('text-h4 text-ods-text-primary line-clamp-3 break-words', titleClassName)}>{title}</h3>
        </div>

        {/* Person/footer zone — fixed box (kept even when empty so every card
            in a rail shares baselines). */}
        <div className="h-[60px] flex items-center shrink-0">
          {person && (
            <div className="flex items-center gap-3 min-w-0 w-full">
              <div className="relative shrink-0 w-12 h-12">
                {person.avatarUrl ? (
                  <Image
                    src={person.avatarUrl}
                    alt={person.name}
                    className="w-12 h-12 rounded-full object-cover bg-ods-bg border border-ods-border"
                    width={48}
                    height={48}
                    unoptimized
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-ods-bg border border-ods-border flex items-center justify-center">
                    <span className="text-ods-text-secondary font-medium text-xl">
                      {person.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                {person.iconOverlayUrl && (
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-ods-text-primary ring-1 ring-ods-bg overflow-hidden flex items-center justify-center">
                    <Image
                      src={person.iconOverlayUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      width={24}
                      height={24}
                      unoptimized
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-['DM_Sans'] font-bold text-ods-text-primary truncate">{person.name}</span>
                {person.subtitle && (
                  <span className="font-['DM_Sans'] text-sm text-ods-text-secondary truncate">{person.subtitle}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </a>
  )
}
