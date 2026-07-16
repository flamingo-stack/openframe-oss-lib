'use client'

import React, { useState, useEffect } from 'react'
import Image from '../../../embed-shims/next-image'
import { cn } from '../../../utils/cn'
import { useImageEdgeColor } from '../../../hooks/ui/use-image-edge-color'
import { PlatformBadge } from '../../features/platform-badge'

interface PlatformInfo {
  platform_id?: string
  id?: string
  name: string
  display_name?: string
}

interface AdminContentCardProps {
  /** Cover image URL */
  imageUrl?: string | null
  /** Pre-computed placeholder URL used when `imageUrl` is missing or
   *  fails to load. Hub callers pass `useOgPlaceholderUrl({ title })`; embedders
   *  supply their own URL or leave null for a plain background fallback. */
  placeholderUrl?: string | null
  /** Alt text / fallback title */
  title: string
  /** Summary or description text */
  summary?: string | null
  /** Subtitle line (e.g. customer name) */
  subtitle?: string | null
  /** Platform badges */
  platforms?: PlatformInfo[]
  /** Status/info badges rendered after platform badges */
  badges?: React.ReactNode
  /** Meta info row (date, views, etc.) */
  meta?: React.ReactNode
  /** Action buttons row */
  actions?: React.ReactNode
  /** Additional class names */
  className?: string
}

export function AdminContentCard({
  imageUrl,
  placeholderUrl,
  title,
  summary,
  subtitle,
  platforms,
  badges,
  meta,
  actions,
  className,
}: AdminContentCardProps) {
  const [imageError, setImageError] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const displayUrl = (imageUrl && !imageError) ? imageUrl : placeholderUrl
  const imageBgColor = useImageEdgeColor(displayUrl || null, 'transparent')

  // Reset loading state when the displayed image URL changes
  useEffect(() => {
    setImageLoaded(false)
  }, [displayUrl])

  return (
    <article className={cn(
      'group h-full overflow-hidden rounded-2xl',
      'border border-ods-border bg-ods-card',
      'flex flex-col',
      'transition-all duration-300 ease-out',
      'hover:-translate-y-1 hover:shadow-lg hover:shadow-ods-accent/[0.08]',
      'hover:border-ods-accent',
      className,
    )}>
      {/* Cover Image — 3:2 aspect ratio, centered with edge-color fill */}
      <div
        className="relative aspect-[3/2] w-full overflow-hidden shrink-0"
        style={{ backgroundColor: imageBgColor }}
      >
        {displayUrl ? (
          <>
            {!imageLoaded && (
              <div className="absolute inset-0 animate-pulse bg-ods-border/20" />
            )}
            <Image
              src={displayUrl}
              alt={title}
              fill
              sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
              className={cn(
                'object-contain object-center',
                'transition-transform duration-500 ease-out',
                'group-hover:scale-[1.03]',
                imageLoaded ? 'opacity-100' : 'opacity-0',
              )}
              unoptimized
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-ods-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Title */}
        <h3 className="text-h3 text-ods-text-primary line-clamp-2 break-words">
          {title}
        </h3>

        {/* Subtitle (optional) */}
        {subtitle && (
          <p className="text-h6 text-ods-text-secondary truncate">
            {subtitle}
          </p>
        )}

        {/* Summary */}
        {summary && (
          <p className="text-h6 text-ods-text-secondary line-clamp-2">
            {summary}
          </p>
        )}

        {/* Badges row */}
        {(Number(platforms?.length) > 0 || badges) && (
          <div className="flex items-center gap-2 flex-wrap">
            {platforms?.map((p) => (
              <PlatformBadge
                key={p.platform_id || p.id}
                platform={{ id: p.id || p.platform_id || '', name: p.name, display_name: p.display_name || p.name }}
                size="xs"
              />
            ))}
            {badges}
          </div>
        )}

        {/* Meta row */}
        {meta && (
          <div className="flex items-center gap-3 text-h6 text-ods-text-secondary">
            {meta}
          </div>
        )}

        {/* Actions — pushed to bottom */}
        {actions && (
          <div className="flex items-center justify-between mt-auto pt-3 border-t border-ods-border">
            {actions}
          </div>
        )}
      </div>
    </article>
  )
}
