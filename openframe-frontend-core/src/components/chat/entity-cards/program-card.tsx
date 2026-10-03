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

import { ArrowRight, ExternalLink, Clock, Play, Video } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import Image from '../../../embed-shims/next-image';
import { useImageEdgeColor } from '../../../hooks/ui/use-image-edge-color';
import { cn } from '../../../utils/cn';
import { formatProgramDate, formatProgramDateRange } from '../../../utils/format';
import { isImageMedia } from '../../../utils/media-type';
import { programMetaFormatters, programMetaLine } from '../../../utils/program-instant';
import { PROGRAM_META_RENDERERS } from '../../../utils/program-meta-renderers';
import { CardHoverPlay } from '../../features/video-center-badge';
import { Button } from '../../ui/button/button';
import { ImageGalleryModal } from '../../ui/image-gallery-modal';
import { SquareAvatar } from '../../ui/square-avatar';
import { Tag } from '../../ui/tag';
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
import { CONTENT_CARD_FRAME_CLASS, CONTENT_CARD_SKELETON_FRAME_CLASS } from './content-card-frame';
import { EntityPortraitCard } from './entity-portrait-card';
import { useEntityCardLink } from './use-entity-card-link';
import { useEntityCardPlaceholder } from './use-entity-card-placeholder';

type CardSize = 'default' | 'sm' | 'portrait' | 'feature' | 'row';

// The editorial pair's boxes, read by the card AND its skeleton (`ProgramCardSkeleton`
// size `feature` / `row`), so the two cannot drift. Every text row keeps its space
// (`min-h-[Nlh]` in its own typography), so a card is one height whatever its copy.
const EDITORIAL_FRAME = CONTENT_CARD_SKELETON_FRAME_CLASS;
const EDITORIAL_ROW_GRID =
  'grid grid-cols-[88px_minmax(0,1fr)] items-center gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)] sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-[var(--spacing-system-l)]';
const EDITORIAL_ROW_THUMB = 'relative block aspect-square w-full overflow-hidden rounded-md';
const EDITORIAL_ROW_TEXT = 'flex min-w-0 flex-col gap-[var(--spacing-system-xs)]';
const EDITORIAL_FEATURE_COVER = 'relative block aspect-video w-full overflow-hidden';
const EDITORIAL_FEATURE_BODY = 'flex flex-col gap-[var(--spacing-system-s)] p-[var(--spacing-system-l)]';
const EDITORIAL_META_ROW =
  'flex h-[1lh] min-w-0 items-center gap-x-[var(--spacing-system-s)] overflow-hidden whitespace-nowrap text-h6';
const EDITORIAL_PERSON_ROW = 'flex h-8 min-w-0 items-center gap-[var(--spacing-system-s)]';

// The default card's boxes, shared by the card and its skeleton: a large SQUARE cover
// (the picture fills it), a display title, the date and meta row (stacked on a phone,
// one line from md), a three-line description, a tag row, the gallery and the action,
// so a card is one height whatever its copy and cover.
const DEFAULT_BODY =
  'flex flex-col gap-[var(--spacing-system-lf)] p-[var(--spacing-system-lf)] md:p-[var(--spacing-system-xlf)]';
const DEFAULT_HEADER = 'flex flex-col gap-[var(--spacing-system-lf)] md:flex-row md:gap-[var(--spacing-system-xlf)]';
const DEFAULT_COVER_FRAME =
  'relative aspect-square w-full flex-shrink-0 overflow-hidden rounded-lg md:w-[240px] lg:w-[320px] xl:w-[400px]';
const DEFAULT_TEXT = 'flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-mf)]';
const DEFAULT_TITLE = 'line-clamp-2 text-ods-text-primary text-h1';
const DEFAULT_META_ROW =
  'flex min-h-[calc(2lh+0.5rem)] flex-col gap-2 text-h4 md:min-h-[1lh] md:flex-row md:items-center md:gap-4';
const DEFAULT_DESCRIPTION = 'line-clamp-3 min-h-[3lh] text-ods-text-secondary text-h4';
const DEFAULT_TAG_ROW = 'flex flex-wrap gap-[var(--spacing-system-xsf)]';
const DEFAULT_GALLERY_ROW = 'flex gap-[var(--spacing-system-mf)]';
const DEFAULT_GALLERY_THUMB =
  'relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg md:h-40 md:w-40 xl:h-[200px] xl:w-[200px]';
const DEFAULT_FOOTER = 'flex justify-end border-t border-ods-border pt-[var(--spacing-system-lf)]';

export function ProgramCardSkeleton({
  size = 'default',
  eyebrow = true,
  media = 0,
  tags = false,
}: {
  size?: CardSize;
  eyebrow?: boolean;
  /** `default` size: how many gallery thumbnails the card shows (`MediaGallery`'s row). 0 = no gallery. */
  media?: number;
  /** `default` size: the card shows a tag row. */
  tags?: boolean;
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
    <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, DEFAULT_BODY, 'animate-pulse')}>
      <div className={DEFAULT_HEADER}>
        <div className={`${DEFAULT_COVER_FRAME} bg-ods-border`} />
        <div className={DEFAULT_TEXT}>
          <div className={DEFAULT_TITLE}>
            <span className="block h-[1lh] w-3/4 rounded bg-ods-border" />
          </div>
          <div className={DEFAULT_META_ROW}>
            <span className="block h-[1lh] w-32 rounded bg-ods-border" />
            <span className="block h-[1lh] w-40 rounded bg-ods-border" />
          </div>
          <div className={DEFAULT_DESCRIPTION}>
            <span className="block h-[3lh] w-full rounded bg-ods-border" />
          </div>
          {tags && (
            <div className={DEFAULT_TAG_ROW}>
              <span className="block h-8 w-24 rounded bg-ods-border" />
              <span className="block h-8 w-24 rounded bg-ods-border" />
            </div>
          )}
        </div>
      </div>
      {media > 0 && (
        <div className={DEFAULT_GALLERY_ROW}>
          {Array.from({ length: media }, (_, i) => (
            <div key={i} className={`${DEFAULT_GALLERY_THUMB} bg-ods-border`} />
          ))}
        </div>
      )}
      <div className={DEFAULT_FOOTER}>
        <div className="h-10 w-40 rounded bg-ods-border" />
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
  /** `default` density: the item's tags, drawn under the description. */
  tags?: string[];
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
      <div className="overflow-x-auto">
        <div className={DEFAULT_GALLERY_ROW} style={{ width: 'max-content' }}>
          {images.map((mediaItem, index) => (
            <div
              key={mediaItem.id}
              className={cn(DEFAULT_GALLERY_THUMB, 'group/thumb cursor-pointer')}
              onClick={e => openImageModal(index, e)}
            >
              <Image
                src={mediaItem.media_url}
                alt={`${title} photo ${index + 1}`}
                fill
                className="object-cover transition-transform duration-200 group-hover/thumb:scale-105"
                sizes="200px"
                loading="lazy"
                unoptimized
              />
            </div>
          ))}
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
  const frame = cn(CONTENT_CARD_FRAME_CLASS, 'no-underline');
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
  tags = [],
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

  // An event that spans days reads as its range ("Aug 14 – 20, 2026").
  const endAt = 'end_at' in item && typeof item.end_at === 'string' ? item.end_at : null;
  const dateLabel = formatProgramDateRange(zonedDate, endAt) ?? dateFormat;

  const cardHeader = (
    <div className={DEFAULT_HEADER}>
      {coverImage && (
        <div className={DEFAULT_COVER_FRAME}>
          <Image
            src={coverImage}
            alt={item.title}
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 320px, 100vw"
            className="object-cover"
            unoptimized
          />
          {isPlayable && <CardHoverPlay size="md" />}
        </div>
      )}

      <div className={DEFAULT_TEXT}>
        <h3 className={DEFAULT_TITLE}>{item.title}</h3>

        <div className={DEFAULT_META_ROW}>
          <span style={{ color: accentColor }}>{dateLabel}</span>
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

        <p className={DEFAULT_DESCRIPTION}>{item.description}</p>

        {tags.length > 0 && (
          <div className={DEFAULT_TAG_ROW}>
            {tags.map(tag => (
              <Tag key={tag} as="span" label={tag} variant="outline" />
            ))}
          </div>
        )}
      </div>

      {hosts.length > 0 && (
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
      )}
    </div>
  );

  const cardFrameClass = cn(CONTENT_CARD_FRAME_CLASS, DEFAULT_BODY, className);
  const actionLabel = `View ${config.labels.singular.toLowerCase()}`;

  if (wholeCardClickable) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        className={cn(cardFrameClass, 'no-underline')}
        aria-label={`Open ${item.title}`}
      >
        {cardHeader}
        {images.length > 0 && <MediaGallery images={images} title={item.title} />}
        <div className={DEFAULT_FOOTER}>
          <span
            className="inline-flex items-center gap-2 rounded-md border border-ods-border px-4 py-2 text-ods-text-primary text-h4"
            aria-hidden="true"
          >
            {actionLabel}
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>
      </a>
    );
  }

  return (
    <div className={cardFrameClass}>
      <a href={href} target={target} rel={rel} className="block" aria-label={`Open ${item.title}`}>
        {cardHeader}
      </a>
      {images.length > 0 && <MediaGallery images={images} title={item.title} />}
      <div className={DEFAULT_FOOTER}>
        <Button
          variant="outline"
          href={href}
          openInNewTab={target === '_blank'}
          rightIcon={<ArrowRight className="h-5 w-5" />}
        >
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
