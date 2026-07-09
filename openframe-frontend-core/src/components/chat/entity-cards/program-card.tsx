'use client'

/**
 * ProgramCard (pure presentation). Generic card for podcasts / webinars /
 * events. Three densities — `default` (wide horizontal detail, archive
 * pages), `sm` (compact horizontal for chat-inline), and `portrait`
 * (vertical rail/strip card).
 *
 * `portrait` exists because mixed-content rails MUST share ONE card anatomy
 * (2026 card-UI practice: a rail mixes content types, never card layouts —
 * mixing orientations/aspects in one scroller is the anti-pattern). It
 * renders the SAME three zones as the other portrait entity cards
 * (CaseStudyCard et al.): wide media slot → fixed 72px title zone → fixed
 * 60px person/meta footer, p-6 / gap-6. The program's identity lives in the
 * Azeret Mono title and the date · duration meta line — not in a different
 * layout.
 *
 * The card writes NO click logic — callers wrap with their own anchor
 * and pass the resolved detail URL via `href`.
 */

import React, { useState } from 'react'
import Image from '../../../embed-shims/next-image'
import { format } from 'date-fns'
import { ExternalLink, Clock, Play, Video } from 'lucide-react'
import { Button } from '../../ui/button/button'
import { Card } from '../../ui/card'
import { SquareAvatar } from '../../ui/square-avatar'
import { ImageGalleryModal } from '../../ui/image-gallery-modal'
import { cn } from '../../../utils/cn'
import {
  formatDurationCompact,
  formatTimeWithTimezone,
  formatDurationFromRange,
} from '../../../utils/format'
import {
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SKELETON_IMAGE_SLOT,
  COMPACT_CARD_SKELETON_OUTER,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
} from '../utils/compact-card-classes'
import type {
  BaseProgramItem,
  ProgramConfig,
  ProgramMedia,
  ProgramHost,
} from '../types/entities/program-types'
import { useEntityCardLink } from './use-entity-card-link'
import { useEntityCardPlaceholder } from './use-entity-card-placeholder'

type CardSize = 'default' | 'sm' | 'portrait'

/**
 * Format a Date with date-fns pinned to UTC. `date-fns` `format()` reads the
 * runtime's LOCAL wall-clock, so the same instant renders differently on the
 * server (Vercel = UTC) and the client (visitor tz) → React #418 hydration
 * mismatch. Shifting by the local offset before formatting emits the UTC
 * wall-clock on every machine, so server and client agree. Mirrors the helper
 * in the hub's `program-header.tsx` (kept local — the lib has no date-fns-tz
 * dep) and the repo-wide "pin program dates to UTC" convention.
 */
function formatUtc(date: Date, fmt: string): string {
  return format(new Date(date.getTime() + date.getTimezoneOffset() * 60_000), fmt)
}

export function ProgramCardSkeleton({ size = 'default' }: { size?: CardSize }) {
  if (size === 'sm') {
    return (
      <span className={COMPACT_CARD_SKELETON_OUTER}>
        <span className={COMPACT_CARD_SKELETON_IMAGE_SLOT} />
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className="h-3.5 w-3/5 rounded bg-ods-bg" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-2/5 rounded bg-ods-bg/70" />
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="h-3 w-11/12 rounded bg-ods-bg/40" />
          </span>
        </span>
        <span className="flex shrink-0 items-center self-start h-5">
          <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
        </span>
      </span>
    )
  }
  return (
    <div
      className="border border-ods-border rounded-lg overflow-hidden flex flex-col animate-pulse"
      style={{ backgroundColor: 'var(--ods-system-greys-black)' }}
    >
      <div className="p-6 flex-1">
        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
          <div className="w-full md:w-[180px] h-[180px] bg-ods-bg rounded-lg flex-shrink-0" />
          <div className="flex-1 min-w-0 flex flex-col gap-3">
            <div className="h-7 w-3/4 bg-ods-bg rounded" />
            <div className="h-7 w-1/2 bg-ods-bg rounded" />
            <div className="h-4 w-1/3 bg-ods-bg/60 rounded" />
            <div className="space-y-2">
              <div className="h-3 w-full bg-ods-bg/60 rounded" />
              <div className="h-3 w-5/6 bg-ods-bg/60 rounded" />
              <div className="h-3 w-4/5 bg-ods-bg/60 rounded" />
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 pt-0 mt-auto">
        <div className="pt-4 border-t border-ods-border">
          <div className="h-9 w-40 bg-ods-bg rounded" />
        </div>
      </div>
    </div>
  )
}

export interface ProgramCardProps<T extends BaseProgramItem> {
  config: ProgramConfig<T>
  item: T
  media?: ProgramMedia[]
  renderMeta?: (item: T) => React.ReactNode
  size?: CardSize
  /** Detail URL resolved by the caller. */
  href: string
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab` so the inner `<a>` matches the runtime
   *  nav decision (cross-platform / embed → new tab). Defaults to
   *  same-tab for non-chat callsites. */
  target?: '_blank'
  rel?: 'noopener noreferrer'
  targetPlatform?: string | null
  /** OG placeholder URL used by the compact branch when no cover. */
  placeholderUrl?: string | null
  wholeCardClickable?: boolean
  className?: string
}

function getHosts(hosts: ProgramHost[] | null | undefined): Array<{ name: string; avatar: string | null }> {
  if (!hosts) return []
  try {
    if (Array.isArray(hosts)) {
      return hosts.map((host) => ({
        name: host.name || 'Unknown',
        avatar: host.avatar_url || null,
      }))
    }
    if (typeof hosts === 'string') {
      const parsed = JSON.parse(hosts)
      if (Array.isArray(parsed)) {
        return parsed.map((host: any) => ({
          name: host.name || host.display_name || 'Unknown',
          avatar: host.avatar_url || null,
        }))
      }
    }
  } catch (error) {
    console.warn('Failed to parse hosts data:', error)
  }
  return []
}

function MediaGallery({ images, title }: { images: ProgramMedia[]; title: string }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const openImageModal = (index: number, event?: React.MouseEvent) => {
    if (event) event.stopPropagation()
    setSelectedImageIndex(index)
    setIsModalOpen(true)
  }
  const closeImageModal = () => {
    setIsModalOpen(false)
    setSelectedImageIndex(null)
  }
  return (
    <>
      <div className="p-6 pt-4">
        <div className="overflow-x-auto mb-4">
          <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
            {images.map((mediaItem, index) => (
              <div
                key={mediaItem.id}
                className="flex-shrink-0 w-24 h-24 relative rounded-md overflow-hidden cursor-pointer group/thumb"
                onClick={(e) => openImageModal(index, e)}
              >
                <Image
                  src={mediaItem.media_url}
                  alt={`${title} photo ${index + 1}`}
                  fill
                  className="object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                  sizes="96px"
                  loading="lazy"
                  unoptimized
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-white/90 flex items-center justify-center">
                    <span className="text-black text-sm">+</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ImageGalleryModal
        images={images.map((img) => img.media_url)}
        isOpen={isModalOpen}
        onClose={closeImageModal}
        initialIndex={selectedImageIndex || 0}
      />
    </>
  )
}

export function ProgramCard<T extends BaseProgramItem>({
  config,
  item,
  media = [],
  renderMeta,
  size = 'default',
  href,
  target: targetProp,
  rel: relProp,
  targetPlatform,
  placeholderUrl: placeholderUrlProp,
  wholeCardClickable = false,
  className,
}: ProgramCardProps<T>) {
  const { target, rel } = useEntityCardLink({
    href,
    targetPlatform,
    target: targetProp,
    rel: relProp,
  })
  const placeholderUrl = useEntityCardPlaceholder({
    title: item.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  })
  const coverImage = item.cover_url
  const images = media.filter((m) => m.media_type === 'image')
  const hosts = getHosts(item.hosts)
  const accentColor = 'var(--color-accent-primary)'
  const isScheduled = 'status' in item && (item as any).status === 'scheduled'

  // Compact per-type meta (duration / location / start time) — shared by the
  // `sm` and `portrait` densities.
  const compactTypeMeta = (): string | null => {
    if (config.type === 'podcast' && 'duration_seconds' in item && !isScheduled) {
      const dur = (item as any).duration_seconds
      if (typeof dur === 'number' && dur > 0) return formatDurationCompact(dur)
    } else if (config.type === 'event' && 'location_name' in item) {
      const loc = (item as any).location_name
      if (typeof loc === 'string' && loc.trim().length > 0) return loc
    } else if (config.type === 'webinar' && 'start_at' in item) {
      const w = item as any
      const time = formatTimeWithTimezone(w.start_at, w.timezone ?? null)
      const dur = formatDurationFromRange(w.start_at, w.end_at)
      return dur ? `${time} · ${dur}` : time
    }
    return null
  }
  const compactDate = (() => {
    try { return formatUtc(new Date(item.date), 'MMM d, yyyy') } catch { return '' }
  })()

  if (size === 'portrait') {
    // Rail/strip density — the SAME three-zone anatomy as CaseStudyCard et
    // al. (media aspect-[1200/630] → h-[72px] title → h-[60px] footer,
    // p-6/gap-6). Square podcast artwork letterboxes (object-contain) in the
    // wide slot instead of cropping.
    const portraitCover = coverImage || placeholderUrl || null
    const host = hosts[0]
    const subtitle = [compactDate, compactTypeMeta()].filter(Boolean).join(' · ')
    const TypeGlyph = config.type === 'podcast' ? Play : config.type === 'webinar' ? Video : Clock
    return (
      <a href={href} target={target} rel={rel} className={cn('block h-full', className)} aria-label={`Open ${item.title}`}>
        <Card className="bg-ods-card border border-ods-border hover:border-ods-accent transition-colors p-6 flex flex-col gap-6 overflow-hidden h-full">
          <div className="relative w-full aspect-[1200/630] rounded-sm overflow-hidden bg-ods-bg shrink-0">
            {portraitCover ? (
              <Image
                src={portraitCover}
                alt={item.title}
                className="w-full h-full object-contain"
                sizes="(min-width: 800px) 400px, 100vw"
                fill
                unoptimized
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-ods-accent">
                <TypeGlyph className="w-8 h-8" />
              </span>
            )}
          </div>

          <div className="h-[72px] flex items-center shrink-0">
            <h3 className="font-['Azeret_Mono'] font-semibold text-lg leading-6 text-ods-text-primary line-clamp-3 break-words">
              {item.title}
            </h3>
          </div>

          <div className="h-[60px] flex items-center shrink-0">
            <div className="flex items-center gap-3 min-w-0 w-full">
              {host ? (
                <SquareAvatar
                  variant="round"
                  src={host.avatar || undefined}
                  alt={host.name}
                  fallback={host.name.charAt(0).toUpperCase()}
                  size="lg"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-ods-bg border border-ods-border flex items-center justify-center shrink-0 text-ods-accent">
                  <TypeGlyph className="w-5 h-5" />
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="font-['DM_Sans'] font-bold text-ods-text-primary truncate">
                  {host?.name || config.labels.singular}
                </span>
                <span className="font-['DM_Sans'] text-sm text-ods-text-secondary truncate">
                  {subtitle || config.labels.singular}
                </span>
              </div>
            </div>
          </div>
        </Card>
      </a>
    )
  }

  if (size === 'sm') {
    const itemDate = compactDate
    const compactCover = coverImage || placeholderUrl || null
    const typeMeta = compactTypeMeta()
    const subtitleParts = [itemDate, typeMeta, config.labels?.singular].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    )
    return (
      <a href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {compactCover ? (
            <Image
              src={compactCover}
              alt={item.title}
              fill
              sizes="56px"
              className="object-contain"
              unoptimized
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ods-accent">
              {config.type === 'podcast' ? <Play className="w-4 h-4" /> : config.type === 'webinar' ? <Video className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            </span>
          )}
          {config.type === 'podcast' && !isScheduled && compactCover && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="w-4 h-4 text-white" fill="white" />
            </span>
          )}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className={cn(COMPACT_CARD_TITLE, "font-['Azeret_Mono']")}>
              {item.title}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="truncate text-[11px] leading-4 text-[var(--color-accent-primary)]">
              {subtitleParts.join(' · ')}
            </span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>
              {item.description || COMPACT_CARD_ROW_FILLER}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center self-start h-5 text-ods-text-secondary">
          <ExternalLink className="w-3.5 h-3.5" />
        </span>
      </a>
    )
  }

  const itemDate = new Date(item.date)
  const dateFormat = formatUtc(itemDate, 'EEEE d MMMM')

  const defaultRenderMeta = () => {
    if (config.type === 'podcast' && 'duration_seconds' in item && !isScheduled) {
      return (
        <>
          <Clock className="w-4 h-4 text-ods-text-secondary" />
          <span className="font-['DM_Sans'] text-ods-text-secondary">
            {formatDurationCompact((item as any).duration_seconds)}
          </span>
        </>
      )
    }
    if (config.type === 'event' && 'location_name' in item) {
      return (
        <span className="font-['DM_Sans'] text-ods-text-secondary">
          {(item as any).location_name || 'Location TBD'}
        </span>
      )
    }
    if (config.type === 'webinar' && 'start_at' in item) {
      const webinarItem = item as any
      const duration = formatDurationFromRange(webinarItem.start_at, webinarItem.end_at)
      return (
        <>
          <Video className="w-4 h-4 text-ods-text-secondary" />
          <span className="font-['DM_Sans'] text-ods-text-secondary">
            {formatTimeWithTimezone(webinarItem.start_at, webinarItem.timezone ?? null)}
            {duration && ` · ${duration}`}
          </span>
          {webinarItem.timezone && (
            <span className="font-['DM_Sans'] text-xs text-ods-text-secondary">
              ({webinarItem.timezone})
            </span>
          )}
        </>
      )
    }
    return null
  }

  const cardHeader = (
    <div className="p-6 border-ods-border flex-1">
      <div className="flex flex-col md:flex-row gap-4 md:gap-6">
        {coverImage && (
          <div className="w-full md:w-[180px] flex-shrink-0 flex items-center">
            <div className="relative rounded-lg overflow-hidden">
              <Image
                src={coverImage}
                alt={item.title}
                width={180}
                height={180}
                className="w-full h-auto rounded-lg object-contain"
                unoptimized
              />
              {config.type === 'podcast' && !isScheduled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <Play className="w-10 h-10 text-white" fill="white" />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <h3 className="font-['Azeret_Mono'] font-semibold text-xl md:text-2xl text-ods-text-primary leading-tight mb-3 min-h-[3rem] md:min-h-[3.5rem] line-clamp-2 flex items-center">
            {item.title}
          </h3>

          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-4">
            <span className="font-['DM_Sans'] font-medium" style={{ color: accentColor }}>
              {dateFormat}
            </span>
            {renderMeta ? (
              <>
                <span className="hidden md:inline text-ods-text-secondary">•</span>
                {renderMeta(item)}
              </>
            ) : (
              defaultRenderMeta() && (
                <>
                  <span className="hidden md:inline text-ods-text-secondary">•</span>
                  <div className="flex items-center gap-2">{defaultRenderMeta()}</div>
                </>
              )
            )}
          </div>

          <div className="flex-1">
            <p className="font-['DM_Sans'] text-sm md:text-base text-ods-text-secondary leading-relaxed line-clamp-3 min-h-[4.5rem]">
              {item.description}
            </p>
          </div>
        </div>

        {hosts.length > 0 && (
          <div className="md:text-right">
            <div className="flex flex-wrap md:justify-end gap-2">
              {hosts.map((host, index) => (
                <SquareAvatar
                  variant="round"
                  key={`${item.id}-host-${index}`}
                  src={host.avatar || undefined}
                  alt={host.name}
                  fallback={host.name.charAt(0).toUpperCase()}
                  size="sm"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const cardFrameClass = cn(
    'border border-ods-border rounded-lg overflow-hidden group transition-all duration-200 flex flex-col',
    className,
  )
  const cardFrameStyle = { backgroundColor: 'var(--ods-system-greys-black)' } as const

  if (wholeCardClickable) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={cn(cardFrameClass, 'hover:border-ods-accent/50 no-underline')}
        style={cardFrameStyle}
        aria-label={`Open ${item.title}`}
      >
        {cardHeader}
        {images.length > 0 && <MediaGallery images={images} title={item.title} />}
        <div className="p-6 pt-0 mt-auto">
          <div className="pt-4 border-t border-ods-border">
            <span
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-ods-accent text-ods-accent text-sm font-medium font-['DM_Sans']"
              aria-hidden="true"
            >
              View {config.labels.singular} Details
              <ExternalLink className="w-5 h-5" />
            </span>
          </div>
        </div>
      </a>
    )
  }

  return (
    <div className={cardFrameClass} style={cardFrameStyle}>
      <a href={href} target={target} rel={rel} className="block" aria-label={`Open ${item.title}`}>
        {cardHeader}
      </a>
      {images.length > 0 && <MediaGallery images={images} title={item.title} />}
      <div className="p-6 pt-0 mt-auto">
        <div className="pt-4 border-t border-ods-border">
          <Button
            variant="outline"
            size="small-legacy"
            href={href}
            openInNewTab={target === '_blank'}
            rightIcon={<ExternalLink className="w-5 h-5" />}
          >
            View {config.labels.singular} Details
          </Button>
        </div>
      </div>
    </div>
  )
}
