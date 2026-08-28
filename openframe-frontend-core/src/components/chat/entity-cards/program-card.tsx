'use client';

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

import { format } from 'date-fns';
import { ExternalLink, Clock, Play, Video } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import Image from '../../../embed-shims/next-image';
import { cn } from '../../../utils/cn';
import { formatDurationCompact, formatTimeWithTimezone, formatDurationFromRange } from '../../../utils/format';
import { Button } from '../../ui/button/button';
import { ImageGalleryModal } from '../../ui/image-gallery-modal';
import { SquareAvatar } from '../../ui/square-avatar';
import {
  programItemToStripProfile,
  type BaseProgramItem,
  type ProgramConfig,
  type ProgramMedia,
  type ProgramHost,
} from '../types/entities/program-types';
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
} from '../utils/compact-card-classes';
import { EntityPortraitCard } from './entity-portrait-card';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

type CardSize = 'default' | 'sm' | 'portrait';

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
  // A row can legitimately arrive without a date (the field is not guaranteed by
  // the wire type), and `new Date(undefined)` / `new Date('')` both give an
  // Invalid Date, which makes date-fns `format()` throw RangeError. Thrown from
  // render that takes down the whole card rail, not just this card — so the
  // helper is total and an unknown date renders as nothing.
  if (Number.isNaN(date.getTime())) return '';
  return format(new Date(date.getTime() + date.getTimezoneOffset() * 60_000), fmt);
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
        <span className="flex h-5 shrink-0 items-center self-start">
          <span className="h-3.5 w-3.5 rounded bg-ods-bg" />
        </span>
      </span>
    );
  }
  return (
    <div
      className="flex animate-pulse flex-col overflow-hidden rounded-lg border border-ods-border"
      style={{ backgroundColor: 'var(--ods-system-greys-black)' }}
    >
      <div className="flex-1 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">
          <div className="h-[180px] w-full flex-shrink-0 rounded-lg bg-ods-bg md:w-[180px]" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="h-7 w-3/4 rounded bg-ods-bg" />
            <div className="h-7 w-1/2 rounded bg-ods-bg" />
            <div className="h-4 w-1/3 rounded bg-ods-bg/60" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-ods-bg/60" />
              <div className="h-3 w-5/6 rounded bg-ods-bg/60" />
              <div className="h-3 w-4/5 rounded bg-ods-bg/60" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-auto p-6 pt-0">
        <div className="border-t border-ods-border pt-4">
          <div className="h-9 w-40 rounded bg-ods-bg" />
        </div>
      </div>
    </div>
  );
}

export interface ProgramCardProps<T extends BaseProgramItem> {
  config: ProgramConfig<T>;
  item: T;
  media?: ProgramMedia[];
  renderMeta?: (item: T) => React.ReactNode;
  size?: CardSize;
  /** Portrait density: render the content-type chip. Mixed rails only; single-type rails pass false. Default true. */
  showTypeBadge?: boolean;
  /** Detail URL resolved by the caller. */
  href: string;
  /** When `_blank`, opens in a new tab. Set by chat dispatch via
   *  `computeIsNewTab` so the inner `<a>` matches the runtime
   *  nav decision (cross-platform / embed → new tab). Defaults to
   *  same-tab for non-chat callsites. */
  target?: '_blank';
  rel?: 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL used by the compact branch when no cover. */
  placeholderUrl?: string | null;
  wholeCardClickable?: boolean;
  className?: string;
}

function getHosts(hosts: ProgramHost[] | null | undefined): Array<{ name: string; avatar: string | null }> {
  if (!hosts) return [];
  try {
    if (Array.isArray(hosts)) {
      return hosts.map(host => ({
        name: host.name || 'Unknown',
        avatar: host.avatar_url || null,
      }));
    }
    if (typeof hosts === 'string') {
      const parsed: unknown = JSON.parse(hosts);
      if (Array.isArray(parsed)) {
        return parsed.map((host: unknown) => {
          const row: Record<string, unknown> = typeof host === 'object' && host !== null ? { ...host } : {};
          const name = typeof row.name === 'string' && row.name ? row.name : null;
          const displayName = typeof row.display_name === 'string' && row.display_name ? row.display_name : null;
          return {
            name: name ?? displayName ?? 'Unknown',
            avatar: typeof row.avatar_url === 'string' && row.avatar_url ? row.avatar_url : null,
          };
        });
      }
    }
  } catch (error) {
    console.warn('Failed to parse hosts data:', error);
  }
  return [];
}

/**
 * Webinar scheduling columns, read off a `BaseProgramItem` that has already
 * been `in`-guarded for `start_at`. Each field is validated rather than
 * asserted — the generic item type does not declare them.
 */
function webinarTiming(item: BaseProgramItem): {
  startAt: string | null;
  endAt: string | null;
  timezone: string | null;
} {
  const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
  return {
    startAt: 'start_at' in item ? str(item.start_at) : null,
    endAt: 'end_at' in item ? str(item.end_at) : null,
    timezone: 'timezone' in item ? str(item.timezone) : null,
  };
}

function MediaGallery({ images, title }: { images: ProgramMedia[]; title: string }) {
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openImageModal = (index: number, event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    setSelectedImageIndex(index);
    setIsModalOpen(true);
  };
  const closeImageModal = () => {
    setIsModalOpen(false);
    setSelectedImageIndex(null);
  };
  return (
    <>
      <div className="p-6 pt-4">
        <div className="mb-4 overflow-x-auto">
          <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
            {images.map((mediaItem, index) => (
              <div
                key={mediaItem.id}
                className="group/thumb relative h-24 w-24 flex-shrink-0 cursor-pointer overflow-hidden rounded-md"
                onClick={e => openImageModal(index, e)}
              >
                <Image
                  src={mediaItem.media_url}
                  alt={`${title} photo ${index + 1}`}
                  fill
                  className="object-cover transition-transform duration-200 group-hover/thumb:scale-105"
                  sizes="96px"
                  loading="lazy"
                  unoptimized
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-200 group-hover/thumb:opacity-100">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
                    <span className="text-sm text-black">+</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ImageGalleryModal
        images={images.map(img => img.media_url)}
        isOpen={isModalOpen}
        onClose={closeImageModal}
        initialIndex={selectedImageIndex || 0}
      />
    </>
  );
}

export function ProgramCard<T extends BaseProgramItem>({
  config,
  item,
  media = [],
  renderMeta,
  size = 'default',
  showTypeBadge = true,
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
  });
  const placeholderUrl = useEntityCardPlaceholder({
    title: item.title,
    placeholderUrl: placeholderUrlProp,
    aspect: size === 'sm' ? 'square' : 'wide',
  });
  const coverImage = item.cover_url;
  const images = media.filter(m => m.media_type === 'image');
  const hosts = getHosts(item.hosts);
  const accentColor = 'var(--color-accent-primary)';
  // `status` / `duration_seconds` / `location_name` / `start_at` … live on the
  // concrete program shapes (PodcastItem / EventItem / WebinarItem), not on
  // `BaseProgramItem`. The `in` guards narrow them to `unknown`, so each read
  // below is followed by a real type check instead of a cast.
  const isScheduled = 'status' in item && item.status === 'scheduled';

  // Compact per-type meta (duration / location / start time) — shared by the
  // `sm` and `portrait` densities.
  const compactTypeMeta = (): string | null => {
    if (config.type === 'podcast' && 'duration_seconds' in item && !isScheduled) {
      const dur = item.duration_seconds;
      if (typeof dur === 'number' && dur > 0) return formatDurationCompact(dur);
    } else if (config.type === 'event' && 'location_name' in item) {
      const loc = item.location_name;
      if (typeof loc === 'string' && loc.trim().length > 0) return loc;
    } else if (config.type === 'webinar' && 'start_at' in item) {
      const { startAt, endAt, timezone } = webinarTiming(item);
      const time = formatTimeWithTimezone(startAt, timezone);
      const dur = formatDurationFromRange(startAt, endAt);
      return dur ? `${time} · ${dur}` : time;
    }
    return null;
  };
  const compactDate = formatUtc(new Date(item.date), 'MMM d, yyyy');

  if (size === 'portrait') {
    // Rail/strip density — mapped onto the shared <EntityPortraitCard> shell
    // (media aspect-[1200/630] → h-[72px] title → h-[60px] footer, p-6/gap-6).
    // Person = author-first via programItemToStripProfile (author → primary
    // host); the date · duration meta line fills the subtitle when the
    // profile has no job title.
    const profile = programItemToStripProfile(item);
    const dateMeta = [compactDate, compactTypeMeta()].filter(Boolean).join(' · ');
    return (
      <EntityPortraitCard
        href={href}
        target={target}
        rel={rel}
        typeLabel={showTypeBadge ? config.labels.singular : undefined}
        imageUrl={coverImage}
        placeholderUrl={placeholderUrl}
        imageAlt={item.title}
        title={item.title}
        titleClassName="font-['Azeret_Mono'] font-semibold text-lg leading-6"
        person={
          profile
            ? { name: profile.name, avatarUrl: profile.avatarUrl, subtitle: profile.subtitle || dateMeta }
            : { name: config.labels.singular, subtitle: dateMeta }
        }
        className={className}
      />
    );
  }

  if (size === 'sm') {
    const itemDate = compactDate;
    const compactCover = coverImage || placeholderUrl || null;
    const typeMeta = compactTypeMeta();
    const subtitleParts = [itemDate, typeMeta, config.labels?.singular].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
    return (
      <a href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {compactCover ? (
            <Image src={compactCover} alt={item.title} fill sizes="56px" className="object-contain" unoptimized />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-ods-accent">
              {config.type === 'podcast' ? (
                <Play className="h-4 w-4" />
              ) : config.type === 'webinar' ? (
                <Video className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
            </span>
          )}
          {config.type === 'podcast' && !isScheduled && compactCover && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Play className="h-4 w-4 text-ods-text-on-dark" fill="white" />
            </span>
          )}
        </span>
        <span className={COMPACT_CARD_TEXT_COL}>
          <span className={COMPACT_CARD_TITLE_ROW}>
            <span className={cn(COMPACT_CARD_TITLE, 'font-heading')}>{item.title}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className="truncate text-ods-accent text-h6">{subtitleParts.join(' · ')}</span>
          </span>
          <span className={COMPACT_CARD_META_ROW_BOX}>
            <span className={COMPACT_CARD_SUMMARY}>{item.description || COMPACT_CARD_ROW_FILLER}</span>
          </span>
        </span>
        <span className="flex h-5 shrink-0 items-center self-start text-ods-text-secondary">
          <ExternalLink className="h-3.5 w-3.5" />
        </span>
      </a>
    );
  }

  const itemDate = new Date(item.date);
  const dateFormat = formatUtc(itemDate, 'EEEE d MMMM');

  const defaultRenderMeta = () => {
    if (config.type === 'podcast' && 'duration_seconds' in item && !isScheduled) {
      const dur = item.duration_seconds;
      return (
        <>
          <Clock className="h-4 w-4 text-ods-text-secondary" />
          <span className="font-body text-ods-text-secondary">
            {formatDurationCompact(typeof dur === 'number' ? dur : null)}
          </span>
        </>
      );
    }
    if (config.type === 'event' && 'location_name' in item) {
      const loc = item.location_name;
      return (
        <span className="font-body text-ods-text-secondary">{(typeof loc === 'string' && loc) || 'Location TBD'}</span>
      );
    }
    if (config.type === 'webinar' && 'start_at' in item) {
      const { startAt, endAt, timezone } = webinarTiming(item);
      const duration = formatDurationFromRange(startAt, endAt);
      return (
        <>
          <Video className="h-4 w-4 text-ods-text-secondary" />
          <span className="font-body text-ods-text-secondary">
            {formatTimeWithTimezone(startAt, timezone)}
            {duration && ` · ${duration}`}
          </span>
          {timezone && <span className="text-ods-text-secondary text-h6">({timezone})</span>}
        </>
      );
    }
    return null;
  };

  const cardHeader = (
    <div className="flex-1 border-ods-border p-6">
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        {coverImage && (
          <div className="flex w-full flex-shrink-0 items-center md:w-[180px]">
            <div className="relative overflow-hidden rounded-lg">
              <Image
                src={coverImage}
                alt={item.title}
                width={180}
                height={180}
                className="h-auto w-full rounded-lg object-contain"
                unoptimized
              />
              {config.type === 'podcast' && !isScheduled && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="h-10 w-10 text-ods-text-on-dark" fill="white" />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="mb-3 line-clamp-2 flex min-h-[3rem] items-center text-ods-text-primary text-h2 md:min-h-[3.5rem]">
            {item.title}
          </h3>

          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
            <span className="text-h6" style={{ color: accentColor }}>
              {dateFormat}
            </span>
            {renderMeta ? (
              <>
                <span className="hidden text-ods-text-secondary md:inline">•</span>
                {renderMeta(item)}
              </>
            ) : (
              defaultRenderMeta() && (
                <>
                  <span className="hidden text-ods-text-secondary md:inline">•</span>
                  <div className="flex items-center gap-2">{defaultRenderMeta()}</div>
                </>
              )
            )}
          </div>

          <div className="flex-1">
            <p className="line-clamp-3 min-h-[4.5rem] text-ods-text-secondary text-h6">{item.description}</p>
          </div>
        </div>

        {hosts.length > 0 && (
          <div className="md:text-right">
            <div className="flex flex-wrap gap-2 md:justify-end">
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
  );

  const cardFrameClass = cn(
    'group flex flex-col overflow-hidden rounded-lg border border-ods-border transition-all duration-200',
    className,
  );
  const cardFrameStyle = { backgroundColor: 'var(--ods-system-greys-black)' } as const;

  if (wholeCardClickable) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={cn(cardFrameClass, 'no-underline hover:border-ods-accent/50')}
        style={cardFrameStyle}
        aria-label={`Open ${item.title}`}
      >
        {cardHeader}
        {images.length > 0 && <MediaGallery images={images} title={item.title} />}
        <div className="mt-auto p-6 pt-0">
          <div className="border-t border-ods-border pt-4">
            <span
              className="inline-flex items-center gap-2 rounded-md border border-ods-accent px-4 py-2 text-ods-accent text-h6"
              aria-hidden="true"
            >
              View {config.labels.singular} Details
              <ExternalLink className="h-5 w-5" />
            </span>
          </div>
        </div>
      </a>
    );
  }

  return (
    <div className={cardFrameClass} style={cardFrameStyle}>
      <a href={href} target={target} rel={rel} className="block" aria-label={`Open ${item.title}`}>
        {cardHeader}
      </a>
      {images.length > 0 && <MediaGallery images={images} title={item.title} />}
      <div className="mt-auto p-6 pt-0">
        <div className="border-t border-ods-border pt-4">
          <Button
            variant="outline"
            size="small-legacy"
            href={href}
            openInNewTab={target === '_blank'}
            rightIcon={<ExternalLink className="h-5 w-5" />}
          >
            View {config.labels.singular} Details
          </Button>
        </div>
      </div>
    </div>
  );
}
