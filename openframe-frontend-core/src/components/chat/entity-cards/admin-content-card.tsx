'use client';

import type React from 'react';
import Image from '../../../embed-shims/next-image';
import { useImageEdgeColor } from '../../../hooks/ui/use-image-edge-color';
import { cn } from '../../../utils/cn';
import { PlatformBadge } from '../../features/platform-badge';
import { Card } from '../../ui/card';
import { useCoverImageFallback } from './use-cover-image-fallback';

interface PlatformInfo {
  platform_id?: string;
  id?: string;
  name: string;
  display_name?: string;
}

interface AdminContentCardProps {
  /** Cover image URL */
  imageUrl?: string | null;
  /** Pre-computed placeholder URL used when `imageUrl` is missing or
   *  fails to load. Hub callers pass `useOgPlaceholderUrl({ title })`; embedders
   *  supply their own URL or leave null for a plain background fallback. */
  placeholderUrl?: string | null;
  /** Alt text / fallback title */
  title: string;
  /** Summary or description text */
  summary?: string | null;
  /** Subtitle line (e.g. customer name) */
  subtitle?: string | null;
  /** Platform badges */
  platforms?: PlatformInfo[];
  /** Status/info badges rendered after platform badges */
  badges?: React.ReactNode;
  /** Meta info row (date, views, etc.) */
  meta?: React.ReactNode;
  /** Action buttons row */
  actions?: React.ReactNode;
  /** Additional class names */
  className?: string;
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
  const { displayUrl, imageLoaded, handleLoad, handleError } = useCoverImageFallback({
    imageUrl,
    placeholderUrl,
  });
  const imageBgColor = useImageEdgeColor(displayUrl || null, 'transparent');

  return (
    <Card
      className={cn(
        'group h-full overflow-hidden',
        'flex flex-col',
        'transition-all duration-300 ease-out',
        'hover:-translate-y-1 hover:shadow-lg hover:shadow-ods-accent/[0.08]',
        'hover:border-ods-accent',
        className,
      )}
    >
      {/* Cover Image — 3:2 aspect ratio, centered with edge-color fill */}
      <div className="relative aspect-[3/2] w-full shrink-0 overflow-hidden" style={{ backgroundColor: imageBgColor }}>
        {displayUrl ? (
          <>
            {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-ods-border/20" />}
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
              onLoad={handleLoad}
              onError={handleError}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-ods-bg" />
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        {/* Title */}
        <h3 className="line-clamp-2 break-words text-ods-text-primary text-h3">{title}</h3>

        {/* Subtitle (optional) */}
        {subtitle && <p className="truncate text-ods-text-secondary text-h6">{subtitle}</p>}

        {/* Summary */}
        {summary && <p className="line-clamp-2 text-ods-text-secondary text-h6">{summary}</p>}

        {/* Badges row */}
        {(Number(platforms?.length) > 0 || badges) && (
          <div className="flex flex-wrap items-center gap-2">
            {platforms?.map(p => (
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
        {meta && <div className="flex items-center gap-3 text-ods-text-secondary text-h6">{meta}</div>}

        {/* Actions — pushed to bottom */}
        {actions && (
          <div className="mt-auto flex items-center justify-between border-t border-ods-border pt-3">{actions}</div>
        )}
      </div>
    </Card>
  );
}
