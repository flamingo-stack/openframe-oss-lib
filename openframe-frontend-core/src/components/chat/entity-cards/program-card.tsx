'use client';

/**
 * ProgramCard (pure presentation). Generic card for podcasts / webinars /
 * events. Five densities — `default` (wide horizontal detail, archive
 * pages), `sm` (compact horizontal for chat-inline), `portrait` (vertical
 * rail/strip card), and the editorial pair a page section uses to lead with
 * one item: `feature` (cover on top, label, title, date, description, person)
 * beside `row`s (square cover, title, date · length · person, two lines).
 *
 * The cover is never tinted, and a podcast's play glyph (`CardHoverPlay`)
 * shows only while the card is hovered or focused: a program's artwork carries
 * its own marks. In the editorial pair the whole card is the link, and the
 * cover sits whole on its own edge colour (the fill every entity card uses).
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

import { ExternalLink, Clock, Play, Video } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import Image from '../../../embed-shims/next-image';
import { useImageEdgeColor } from '../../../hooks/ui/use-image-edge-color';
import { cn } from '../../../utils/cn';
import { formatProgramDate } from '../../../utils/format';
import { isImageMedia } from '../../../utils/media-type';
import { programMetaFormatters, programMetaLine } from '../../../utils/program-instant';
import { PROGRAM_META_RENDERERS } from '../../../utils/program-meta-renderers';
import { CardHoverPlay } from '../../features/video-center-badge';
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

type CardSize = 'default' | 'sm' | 'portrait' | 'feature' | 'row';

// The editorial pair's boxes, read by the card AND its skeleton (`ProgramCardSkeleton`
// size `feature` / `row`), so the two cannot drift. Every text row keeps its space
// (`min-h-[Nlh]` in its own typography), so a card is one height whatever its copy.
const EDITORIAL_FRAME = 'overflow-hidden rounded-lg border border-ods-border bg-transparent';
const EDITORIAL_ROW_GRID =
  'grid grid-cols-[88px_minmax(0,1fr)] items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-[var(--spacing-system-l)]';
const EDITORIAL_ROW_THUMB = 'relative block aspect-square w-full overflow-hidden rounded-md';
const EDITORIAL_ROW_TEXT = 'flex min-w-0 flex-col gap-[var(--spacing-system-xs)]';
const EDITORIAL_FEATURE_COVER = 'relative block aspect-video w-full overflow-hidden';
const EDITORIAL_FEATURE_BODY = 'flex flex-col gap-[var(--spacing-system-s)] p-[var(--spacing-system-l)]';
const EDITORIAL_META_ROW =
  'flex h-[1lh] min-w-0 items-center gap-x-[var(--spacing-system-s)] overflow-hidden whitespace-nowrap text-h6';
const EDITORIAL_PERSON_ROW = 'flex h-8 min-w-0 items-center gap-[var(--spacing-system-s)]';

// The default card's boxes, shared by the card and its skeleton: a fixed cover frame
// (the image is contained in it, whatever its shape), a two-line title, the date and
// meta rows (stacked on a phone, one line from md) and a three-line description, so a
// card is one height whatever its copy and cover.
const DEFAULT_COVER_FRAME =
  'relative flex h-[180px] w-full flex-shrink-0 items-center justify-center overflow-hidden rounded-lg md:w-[180px]';
const DEFAULT_TITLE = 'mb-3 line-clamp-2 flex min-h-[2lh] items-center text-ods-text-primary text-h2';
const DEFAULT_META_ROW =
  'mb-4 flex min-h-[calc(2lh+0.5rem)] flex-col gap-2 text-h6 md:min-h-[1lh] md:flex-row md:items-center md:gap-4';
const DEFAULT_DESCRIPTION = 'line-clamp-3 min-h-[3lh] text-ods-text-secondary text-h6';

export function ProgramCardSkeleton({
  size = 'default',
  eyebrow = true,
  media = 0,
}: {
  size?: CardSize;
  eyebrow?: boolean;
  /** `default` size: how many gallery thumbnails the card shows (`MediaGallery`'s row). 0 = no gallery. */
  media?: number;
}) {
  // The editorial pair: the card's own boxes (EDITORIAL_*), each text row a bar of
  // that row's line height.
  if (size === 'row') {
    return (
      <span className={cn(EDITORIAL_FRAME, EDITORIAL_ROW_GRID, 'animate-pulse')}>
        <span className={cn(EDITORIAL_ROW_THUMB, 'bg-ods-border/20')} />
        <span className={EDITORIAL_ROW_TEXT}>
          <span className="block h-[2lh] w-full rounded bg-ods-border text-h3" />
          <span className={EDITORIAL_META_ROW}>
            <span className="block h-[1lh] w-40 rounded bg-ods-border" />
          </span>
          <span className="block h-[2lh] w-full rounded bg-ods-border text-h6" />
        </span>
      </span>
    );
  }
  if (size === 'feature') {
    return (
      <span className={cn(EDITORIAL_FRAME, 'flex animate-pulse flex-col')}>
        <span className={cn(EDITORIAL_FEATURE_COVER, 'bg-ods-border/20')} />
        <span className={EDITORIAL_FEATURE_BODY}>
          {eyebrow && <span className="block h-[1lh] w-28 rounded bg-ods-border text-h5" />}
          <span className="block h-[2lh] w-full rounded bg-ods-border text-h3" />
          <span className={EDITORIAL_META_ROW}>
            <span className="block h-[1lh] w-40 rounded bg-ods-border" />
          </span>
          <span className="block h-[3lh] w-full rounded bg-ods-border text-h4" />
          <span className={EDITORIAL_PERSON_ROW}>
            <span className="block h-8 w-8 shrink-0 rounded-full bg-ods-border" />
            <span className="block h-[1lh] w-40 rounded bg-ods-border text-h6" />
          </span>
        </span>
      </span>
    );
  }
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
          <div className={`${DEFAULT_COVER_FRAME} bg-ods-bg`} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className={DEFAULT_TITLE}>
              <span className="block h-[1lh] w-3/4 rounded bg-ods-bg" />
            </div>
            <div className={DEFAULT_META_ROW}>
              <span className="block h-[1lh] w-32 rounded bg-ods-bg/60" />
              <span className="block h-[1lh] w-40 rounded bg-ods-bg/60" />
            </div>
            <div className="flex-1">
              <div className={`${DEFAULT_DESCRIPTION} flex flex-col gap-1`}>
                <span className="block h-3 w-full rounded bg-ods-bg/60" />
                <span className="block h-3 w-5/6 rounded bg-ods-bg/60" />
                <span className="block h-3 w-4/5 rounded bg-ods-bg/60" />
              </div>
            </div>
          </div>
        </div>
      </div>
      {media > 0 && (
        // MediaGallery's own boxes: p-6 pt-4, mb-4 row, 96px thumbnails, gap-3, pb-2.
        <div className="p-6 pt-4">
          <div className="mb-4">
            <div className="flex gap-3 pb-2">
              {Array.from({ length: media }, (_, i) => (
                <div key={i} className="h-24 w-24 flex-shrink-0 rounded-md bg-ods-bg" />
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="mt-auto p-6 pt-0">
        <div className="border-t border-ods-border pt-4">
          <div className="h-10 w-40 rounded bg-ods-bg" />
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
  rel?: 'noopener' | 'noopener noreferrer';
  targetPlatform?: string | null;
  /** OG placeholder URL used by the compact branch when no cover. */
  placeholderUrl?: string | null;
  wholeCardClickable?: boolean;
  /** `feature` density: the label above the title ("Latest episode"). */
  eyebrow?: string;
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

/**
 * The editorial pair. `feature`: the cover across the top (a wide cover fills
 * it, square artwork is contained on its own edge colour), then label, title,
 * date · length, description and the person. `row`: a square cover beside the
 * title, date · length · person and two lines of description.
 */
function ProgramEditorialCard({
  feature,
  href,
  target,
  rel,
  title,
  description,
  cover,
  eyebrow,
  date,
  typeMeta,
  profile,
  playable,
  className,
}: {
  feature: boolean;
  href: string;
  target?: '_blank';
  rel?: string;
  title: string;
  description?: string | null;
  cover: string | null;
  eyebrow?: string;
  date: string | null;
  typeMeta: string | null | undefined;
  profile: ReturnType<typeof programItemToStripProfile>;
  playable: boolean;
  className?: string;
}) {
  // The cover is shown WHOLE on its own edge colour: the fill AdminContentCard
  // and the portrait card use, so square artwork is never cropped or boxed.
  const edgeColor = useImageEdgeColor(feature ? cover : null, 'transparent');
  const frame = cn(EDITORIAL_FRAME, 'group no-underline transition-colors duration-200 hover:border-ods-accent');
  const meta = (
    <div className={EDITORIAL_META_ROW}>
      {date && <span className="text-ods-flamingo-pink">{date}</span>}
      {[typeMeta, feature ? null : profile?.name]
        .filter((part): part is string => !!part)
        .map(part => (
          <span key={part} className="flex items-center gap-[var(--spacing-system-s)] text-ods-text-secondary">
            <span aria-hidden="true">•</span>
            {part}
          </span>
        ))}
    </div>
  );

  if (!feature) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        aria-label={`Open ${title}`}
        className={cn(frame, EDITORIAL_ROW_GRID, className)}
      >
        <span className={cn(EDITORIAL_ROW_THUMB, 'bg-ods-bg')}>
          {cover && <Image src={cover} alt="" fill sizes="120px" className="object-cover" unoptimized />}
          {playable && cover && <CardHoverPlay size="md" />}
        </span>
        <span className={EDITORIAL_ROW_TEXT}>
          <span className="line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3">{title}</span>
          {meta}
          <span className="line-clamp-2 min-h-[2lh] text-ods-text-secondary text-h6">{description}</span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={href}
      target={target}
      rel={rel}
      aria-label={`Open ${title}`}
      className={cn(frame, 'flex flex-col', className)}
    >
      <span
        className={cn(EDITORIAL_FEATURE_COVER, 'transition-colors duration-300')}
        style={{ backgroundColor: edgeColor }}
      >
        {cover && (
          <Image
            src={cover}
            alt=""
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-contain"
            unoptimized
          />
        )}
        {playable && cover && <CardHoverPlay size="lg" />}
      </span>
      <span className={EDITORIAL_FEATURE_BODY}>
        {eyebrow && <span className="block h-[1lh] text-ods-text-secondary text-h5">{eyebrow}</span>}
        <span className="line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3">{title}</span>
        {meta}
        <span className="line-clamp-3 min-h-[3lh] text-ods-text-secondary text-h4">{description}</span>
        {/* The person row keeps its space with or without a person (the skeleton draws it). */}
        <span className={EDITORIAL_PERSON_ROW}>
          {profile && (
            <>
              <SquareAvatar
                variant="round"
                src={profile.avatarUrl || undefined}
                alt={profile.name}
                fallback={profile.name.charAt(0).toUpperCase()}
                size="sm"
              />
              <span className="truncate text-h6">
                <span className="text-ods-text-primary">{profile.name}</span>
                {profile.subtitle && <span className="text-ods-text-secondary"> · {profile.subtitle}</span>}
              </span>
            </>
          )}
        </span>
      </span>
    </a>
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
  eyebrow,
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
    aspect: size === 'sm' || size === 'row' ? 'square' : 'wide',
  });
  const coverImage = item.cover_url;
  const images = media.filter(m => isImageMedia(m));
  const hosts = getHosts(item.hosts);
  const accentColor = 'var(--color-accent-primary)';
  // A published podcast episode plays; a scheduled one has nothing to play yet.
  // (`status` lives on the concrete program shapes, not on `BaseProgramItem`.)
  const isPlayable = config.type === 'podcast' && !('status' in item && item.status === 'scheduled');

  // The compact meta line, built by the ONE shared function — the chat card
  // renders the same string from the same code rather than mirroring it.
  const {
    at: zonedDate,
    typeMeta: compactTypeMetaValue,
    line: compactMetaLine,
    // Compact densities join plain strings, so the zone rides inline here; the
    // default density below renders it as its own styled span instead.
  } = programMetaLine(item, config.type, programMetaFormatters(PROGRAM_META_RENDERERS));
  const compactDate = formatProgramDate(zonedDate, 'medium');

  if (size === 'portrait') {
    // Rail/strip density — mapped onto the shared <EntityPortraitCard> shell
    // (media aspect-[1200/630] → h-[72px] title → h-[60px] footer, p-6/gap-6).
    // Person = author-first via programItemToStripProfile (author → primary
    // host); the date · duration meta line fills the subtitle when the
    // profile has no job title.
    const profile = programItemToStripProfile(item);
    const dateMeta = compactMetaLine;
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

  if (size === 'feature' || size === 'row') {
    return (
      <ProgramEditorialCard
        feature={size === 'feature'}
        href={href}
        target={target}
        rel={rel}
        title={item.title}
        description={item.description}
        cover={coverImage || placeholderUrl || null}
        eyebrow={eyebrow}
        date={formatProgramDate(zonedDate, 'weekday')}
        typeMeta={compactTypeMetaValue}
        profile={programItemToStripProfile(item)}
        playable={isPlayable}
        className={className}
      />
    );
  }

  if (size === 'sm') {
    const itemDate = compactDate;
    const compactCover = coverImage || placeholderUrl || null;
    const typeMeta = compactTypeMetaValue;
    const subtitleParts = [itemDate, typeMeta, config.labels?.singular].filter(
      (s): s is string => typeof s === 'string' && s.length > 0,
    );
    return (
      <a href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, 'group', className)}>
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
          {isPlayable && compactCover && <CardHoverPlay size="sm" />}
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

  const dateFormat = formatProgramDate(zonedDate, 'weekday');

  // The same dispatch as the compact densities — WHICH value a type shows is
  // decided once, by `programMetaLine`. Only the presentation differs here
  // (an icon, and the zone as its own styled span rather than inline), which is
  // why this asks for an unlabelled webinar value. Restating the dispatch is
  // how the two ended up with three conditions that disagreed: the podcast one
  // dropped the `> 0` check, and the event one dropped the non-empty check.
  const { typeMeta: defaultTypeMeta, audience: defaultAudience } = programMetaLine(
    item,
    config.type,
    programMetaFormatters(PROGRAM_META_RENDERERS, { withZoneLabel: false }),
  );

  const defaultRenderMeta = () => {
    if (config.type === 'podcast') {
      return defaultTypeMeta ? (
        <>
          <Clock className="h-4 w-4 text-ods-text-secondary" />
          <span className="font-body text-ods-text-secondary">{defaultTypeMeta}</span>
        </>
      ) : null;
    }
    // No 'Location TBD' fallback: the page header hides the tile entirely for
    // an event with no location, and two surfaces answering "where is this?"
    // differently — one silent, one confidently "TBD" — is the drift this
    // shared dispatch exists to end.
    if (config.type === 'event') {
      const eventMeta = [defaultTypeMeta, defaultAudience].filter(Boolean).join(' · ');
      return eventMeta ? <span className="font-body text-ods-text-secondary">{eventMeta}</span> : null;
    }
    if (config.type === 'webinar' && (defaultTypeMeta || zonedDate.timezone)) {
      return (
        <>
          <Video className="h-4 w-4 text-ods-text-secondary" />
          {defaultTypeMeta && <span className="font-body text-ods-text-secondary">{defaultTypeMeta}</span>}
          {zonedDate.timezone && <span className="text-ods-text-secondary text-h6">({zonedDate.timezone})</span>}
        </>
      );
    }
    return null;
  };

  const cardHeader = (
    <div className="flex-1 border-ods-border p-6">
      <div className="flex flex-col gap-4 md:flex-row md:gap-6">
        {coverImage && (
          <div className={DEFAULT_COVER_FRAME}>
            <Image
              src={coverImage}
              alt={item.title}
              width={180}
              height={180}
              className="h-full w-full rounded-lg object-contain"
              unoptimized
            />
            {isPlayable && <CardHoverPlay size="md" />}
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className={DEFAULT_TITLE}>{item.title}</h3>

          <div className={DEFAULT_META_ROW}>
            <span style={{ color: accentColor }}>{dateFormat}</span>
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
            <p className={DEFAULT_DESCRIPTION}>{item.description}</p>
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
