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
import Link from '../../../embed-shims/next-link';
import { useImageEdgeColor } from '../../../hooks/ui/use-image-edge-color';
import { MEDIA_ASPECT } from '../../../styles/component-sizes';
import { cn } from '../../../utils/cn';
import { formatProgramDate, formatProgramDateRange } from '../../../utils/format';
import { isImageMedia } from '../../../utils/media-type';
import { programMetaFormatters, programMetaLine } from '../../../utils/program-instant';
import { PROGRAM_META_RENDERERS } from '../../../utils/program-meta-renderers';
import { programItemToStripProfile } from '../../features/video-bites-shared';
import { CardHoverPlay } from '../../features/video-center-badge';
import { InteractiveSkeleton, TextLineSkeleton, UnifiedSkeleton } from '../../loading/unified-skeleton';
import { Button } from '../../ui/button/button';
import { ImageGalleryModal } from '../../ui/image-gallery-modal';
import { LoadingItems, useLoadingScope } from '../../ui/loading-scope';
import { SquareAvatar } from '../../ui/square-avatar';
import { Tag } from '../../ui/tag';
import type { BaseProgramItem, ProgramConfig, ProgramMedia, ProgramHost } from '../types/entities/program-types';
import {
  COMPACT_CARD_IMAGE_SLOT,
  COMPACT_CARD_META_ROW_BOX,
  COMPACT_CARD_OUTER,
  COMPACT_CARD_ROW_FILLER,
  COMPACT_CARD_SUMMARY,
  COMPACT_CARD_TEXT_COL,
  COMPACT_CARD_TITLE,
  COMPACT_CARD_TITLE_ROW,
} from '../utils/compact-card-classes';
import { CompactCardSkeleton } from '../utils/compact-card-skeleton';
import { CONTENT_CARD_SKELETON_FRAME_CLASS, ContentCardFrame } from './content-card-frame';
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
const EDITORIAL_ROW_THUMB = `relative block ${MEDIA_ASPECT.square} w-full overflow-hidden rounded-md`;
const EDITORIAL_ROW_TEXT = 'flex min-w-0 flex-col gap-[var(--spacing-system-xs)]';
const EDITORIAL_FEATURE_COVER = `relative block ${MEDIA_ASPECT.video} w-full overflow-hidden`;
const EDITORIAL_FEATURE_BODY = 'flex flex-col gap-[var(--spacing-system-s)] p-[var(--spacing-system-l)]';
const EDITORIAL_META_ROW =
  'flex h-[1lh] min-w-0 items-center gap-x-[var(--spacing-system-s)] overflow-hidden whitespace-nowrap text-h6';
const EDITORIAL_PERSON_ROW = 'flex h-8 min-w-0 items-center gap-[var(--spacing-system-s)]';

// The default card's boxes, shared by the card and its skeleton: a large SQUARE cover
// (the picture fills it), a two-line display title, the date and meta row (stacked up to
// lg, where the text column is wide enough for one line), a three-line description, a tag row, the gallery and the action,
// so a card is one height whatever its copy and cover.
const DEFAULT_BODY =
  'flex flex-col gap-[var(--spacing-system-lf)] p-[var(--spacing-system-lf)] md:p-[var(--spacing-system-xlf)]';
const DEFAULT_HEADER = 'flex flex-col gap-[var(--spacing-system-lf)] md:flex-row md:gap-[var(--spacing-system-xlf)]';
const DEFAULT_COVER_FRAME =
  'relative aspect-square w-full flex-shrink-0 overflow-hidden rounded-lg md:w-[240px] lg:w-[320px] xl:w-[400px]';
const DEFAULT_TEXT = 'flex min-w-0 flex-1 flex-col gap-[var(--spacing-system-mf)]';
const DEFAULT_TITLE = 'line-clamp-2 min-h-[2lh] text-ods-text-primary text-h1';
const DEFAULT_META_ROW =
  'flex min-h-[calc(2lh+0.5rem)] flex-col gap-2 text-h4 lg:min-h-[1lh] lg:flex-row lg:items-center lg:gap-4';
const DEFAULT_DESCRIPTION = 'line-clamp-3 min-h-[3lh] text-ods-text-secondary text-h4';
const DEFAULT_TAG_ROW = 'flex flex-wrap gap-[var(--spacing-system-xsf)]';
const DEFAULT_GALLERY_ROW = 'flex gap-[var(--spacing-system-mf)]';
const DEFAULT_GALLERY_THUMB =
  'relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg md:h-40 md:w-40 xl:h-[200px] xl:w-[200px]';
const DEFAULT_FOOTER = 'flex justify-end border-t border-ods-border pt-[var(--spacing-system-lf)]';
/** The hosts' avatars (32px each): beside the text from md, their own row under it on a phone. */
const DEFAULT_HOSTS_ROW = 'flex flex-wrap gap-2 md:justify-end';
/**
 * The tags a card's skeleton draws when it shows a tag row: a typical count. The loaded row draws every tag the item
 * carries (no cap), so there is no limit to draw.
 */
const DEFAULT_SKELETON_TAGS = 2;
/** Host avatars a loading card draws for a type whose cards show hosts (`cardShowsHosts`): a typical one. */
export const PROGRAM_CARD_SKELETON_HOSTS = 1;
/** Gallery thumbnails a loading card draws for a type whose cards show a gallery (`cardShowsGallery`): the row's
 *  first fold (the row scrolls past it). */
export const PROGRAM_CARD_SKELETON_MEDIA = 4;
/** The person's avatar in the editorial feature card, read by the card and its skeleton. */
const EDITORIAL_PERSON_AVATAR = { variant: 'round', size: 'sm' } as const;

/** The default card's action: the config's own words ("View podcast"). */
const programActionLabel = (singular: string): string => `View ${singular.toLowerCase()}`;

/** The default card's action button (copy), read by the card and by its skeleton. */
function ProgramActionButton({ label, href, newTab }: { label: string; href?: string; newTab?: boolean }) {
  return (
    <Button variant="outline" href={href} openInNewTab={newTab} rightIcon={<ArrowRight className="h-5 w-5" />}>
      {label}
    </Button>
  );
}

function ProgramCardSkeleton({
  size = 'default',
  eyebrow = true,
  media = 0,
  tags = false,
  hosts = PROGRAM_CARD_SKELETON_HOSTS,
  typeLabel,
  actionLabel,
  className,
}: {
  /** `default` size: the action's words (copy: `View <type>`), drawn for real; else a button of its size. */
  actionLabel?: string;
  /** `default` size: how many host avatars the card shows (a row of its own on a phone). 0 = none. */
  hosts?: number;
  size?: CardSize;
  /** `portrait` size: the content-type chip (the config's static label), when the card shows one. */
  typeLabel?: string;
  className?: string;
  eyebrow?: boolean;
  /** `default` size: how many gallery thumbnails the card shows (`MediaGallery`'s row). 0 = no gallery. */
  media?: number;
  /** `default` size: the card shows a tag row. */
  tags?: boolean;
}) {
  // The editorial pair: the card's own boxes (EDITORIAL_*), each text row a bar of
  // that row's line height.
  if (size === 'portrait')
    return <EntityPortraitCard loading href="" imageAlt="" title="" typeLabel={typeLabel} className={className} />;
  if (size === 'row') {
    return (
      <span className={cn(EDITORIAL_FRAME, EDITORIAL_ROW_GRID, className)}>
        <UnifiedSkeleton as="span" className={EDITORIAL_ROW_THUMB} />
        <span className={EDITORIAL_ROW_TEXT}>
          <TextLineSkeleton as="span" type="h3" lines={2} className="w-full" />
          <span className={EDITORIAL_META_ROW}>
            <TextLineSkeleton as="span" type="inherit" className="w-40" />
          </span>
          <TextLineSkeleton as="span" type="h6" lines={2} className="w-full" />
        </span>
      </span>
    );
  }
  if (size === 'feature') {
    return (
      <span className={cn(EDITORIAL_FRAME, 'flex flex-col', className)}>
        <UnifiedSkeleton as="span" className={cn(EDITORIAL_FEATURE_COVER, 'rounded-none')} />
        <span className={EDITORIAL_FEATURE_BODY}>
          {eyebrow && <TextLineSkeleton as="span" type="h5" className="w-28" />}
          <TextLineSkeleton as="span" type="h3" lines={2} className="w-full" />
          <span className={EDITORIAL_META_ROW}>
            <TextLineSkeleton as="span" type="inherit" className="w-40" />
          </span>
          <TextLineSkeleton as="span" type="h4" lines={3} className="w-full" />
          <span className={EDITORIAL_PERSON_ROW}>
            <SquareAvatar loading {...EDITORIAL_PERSON_AVATAR} className="shrink-0" />
            <TextLineSkeleton as="span" type="h6" className="w-40" />
          </span>
        </span>
      </span>
    );
  }
  if (size === 'sm') {
    return <CompactCardSkeleton trailingIcon className={className} />;
  }
  return (
    <div className={cn(CONTENT_CARD_SKELETON_FRAME_CLASS, DEFAULT_BODY, className)}>
      <div className={DEFAULT_HEADER}>
        <UnifiedSkeleton className={DEFAULT_COVER_FRAME} />
        <div className={DEFAULT_TEXT}>
          <div className={DEFAULT_TITLE}>
            <TextLineSkeleton as="span" type="inherit" lines={2} className="w-3/4" />
          </div>
          <div className={DEFAULT_META_ROW}>
            <TextLineSkeleton as="span" type="inherit" className="w-32" />
            <TextLineSkeleton as="span" type="inherit" className="w-40" />
          </div>
          <div className={DEFAULT_DESCRIPTION}>
            <TextLineSkeleton as="span" type="inherit" lines={3} className="w-full" />
          </div>
          {tags && (
            <div className={DEFAULT_TAG_ROW}>
              <LoadingItems count={DEFAULT_SKELETON_TAGS}>
                {() => <Tag loading as="span" label="" variant="outline" data-loading-item />}
              </LoadingItems>
            </div>
          )}
        </div>
        {hosts > 0 && (
          <div className={DEFAULT_HOSTS_ROW}>
            <LoadingItems count={hosts}>
              {() => <SquareAvatar loading variant="round" size="sm" data-loading-item />}
            </LoadingItems>
          </div>
        )}
      </div>
      {media > 0 && (
        <div className={DEFAULT_GALLERY_ROW}>
          <LoadingItems count={media}>
            {() => <UnifiedSkeleton className={DEFAULT_GALLERY_THUMB} data-loading-item />}
          </LoadingItems>
        </div>
      )}
      <div className={DEFAULT_FOOTER}>
        {actionLabel ? (
          // The action's words are copy: the real button, not a control while it loads.
          <span inert aria-hidden className="flex">
            <ProgramActionButton label={actionLabel} />
          </span>
        ) : (
          <InteractiveSkeleton.Button size="default" className="w-40" />
        )}
      </div>
    </div>
  );
}

interface LoadedProgramCardProps<T extends BaseProgramItem> {
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
   *  `computeIsNewTab` so the inner `<Link>` matches the runtime
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
  /**
   * The card is the first thing a list draws, so its cover is likely the page's largest paint: fetch it at once and
   * ranked high, instead of lazily (the default for every other card).
   */
  priority?: boolean;
  className?: string;
}

/**
 * The record and its link, or `loading` while the host reads it: the card then draws its own loading form, as it does
 * in a loading scope. What a loading card draws is decided by the type's CONFIG (the hosts and gallery rows its cards
 * always show); with no config it draws neither.
 */
export type ProgramCardProps<T extends BaseProgramItem> =
  | (LoadedProgramCardProps<T> & { loading?: boolean })
  | (Partial<LoadedProgramCardProps<T>> & { loading: true });

/** ONE switch: in a loading scope (or `loading`) the card is its own loading form. */
export function ProgramCard<T extends BaseProgramItem>(props: ProgramCardProps<T>) {
  if (useLoadingScope() || props.loading) {
    const { config, size = 'default', showTypeBadge = true, eyebrow, className } = props;
    // A tag row is a record's optional part, not drawn.
    return (
      <ProgramCardSkeleton
        size={size}
        eyebrow={!!eyebrow}
        media={config?.cardShowsGallery ? PROGRAM_CARD_SKELETON_MEDIA : 0}
        hosts={config?.cardShowsHosts ? PROGRAM_CARD_SKELETON_HOSTS : 0}
        typeLabel={config && size === 'portrait' && showTypeBadge ? config.labels.singular : undefined}
        actionLabel={config ? programActionLabel(config.labels.singular) : undefined}
        className={className}
      />
    );
  }
  return <LoadedProgramCard {...props} />;
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

function MediaGallery({ images, title, optional }: { images: ProgramMedia[]; title: string; optional?: boolean }) {
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
      <div className="overflow-x-auto" data-loading-optional={optional || undefined}>
        <div className={DEFAULT_GALLERY_ROW} style={{ width: 'max-content' }}>
          {images.map((mediaItem, index) => (
            <div
              key={mediaItem.id}
              className={cn(DEFAULT_GALLERY_THUMB, 'group/thumb cursor-pointer')}
              onClick={e => openImageModal(index, e)}
              data-loading-item
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
  priority,
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
  priority?: boolean;
  className?: string;
}) {
  // The cover is shown WHOLE on its own edge colour: the fill AdminContentCard
  // and the portrait card use, so square artwork is never cropped or boxed.
  const edgeColor = useImageEdgeColor(feature ? cover : null, 'transparent');
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
      <ContentCardFrame as="a" href={href} target={target} rel={rel} className={cn(EDITORIAL_ROW_GRID, className)}>
        <span className={cn(EDITORIAL_ROW_THUMB, 'bg-ods-bg')}>
          {cover && (
            <Image src={cover} alt="" fill sizes="120px" className="object-cover" priority={priority} unoptimized />
          )}
          {playable && cover && <CardHoverPlay size="md" />}
        </span>
        <span className={EDITORIAL_ROW_TEXT}>
          <span className="line-clamp-2 min-h-[2lh] text-ods-text-primary text-h3">{title}</span>
          {meta}
          <span className="line-clamp-2 min-h-[2lh] text-ods-text-secondary text-h6">{description}</span>
        </span>
      </ContentCardFrame>
    );
  }

  return (
    <ContentCardFrame as="a" href={href} target={target} rel={rel} className={cn('flex flex-col', className)}>
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
            priority={priority}
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
                {...EDITORIAL_PERSON_AVATAR}
                src={profile.avatarUrl || undefined}
                alt={profile.name}
                fallback={profile.name.charAt(0).toUpperCase()}
              />
              <span className="truncate text-h6">
                <span className="text-ods-text-primary">{profile.name}</span>
                {profile.subtitle && (
                  <span data-loading-optional className="text-ods-text-secondary">
                    {' '}
                    · {profile.subtitle}
                  </span>
                )}
              </span>
            </>
          )}
        </span>
      </span>
    </ContentCardFrame>
  );
}

function LoadedProgramCard<T extends BaseProgramItem>({
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
  priority,
  className,
}: LoadedProgramCardProps<T>) {
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
        priority={priority}
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
        priority={priority}
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
      <Link href={href} target={target} rel={rel} className={cn(COMPACT_CARD_OUTER, 'group', className)}>
        <span className={COMPACT_CARD_IMAGE_SLOT}>
          {compactCover ? (
            <Image
              src={compactCover}
              alt={item.title}
              fill
              sizes="56px"
              className="object-contain"
              priority={priority}
              unoptimized
            />
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
      </Link>
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
            priority={priority}
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
              <span className="hidden text-ods-text-secondary lg:inline">•</span>
              {renderMeta(item)}
            </>
          ) : (
            defaultRenderMeta() && (
              <>
                <span className="hidden text-ods-text-secondary lg:inline">•</span>
                <div className="flex items-center gap-2">{defaultRenderMeta()}</div>
              </>
            )
          )}
        </div>

        <p className={DEFAULT_DESCRIPTION}>{item.description}</p>

        {tags.length > 0 && (
          // Only some records carry tags: the loading card leaves the row out.
          <div className={DEFAULT_TAG_ROW} data-loading-optional>
            {tags.map(tag => (
              <Tag key={tag} as="span" label={tag} variant="outline" data-loading-item />
            ))}
          </div>
        )}
      </div>

      {hosts.length > 0 && (
        // A type whose cards always show hosts (`cardShowsHosts`) draws them while loading; elsewhere only some
        // records have hosts, so the row is record-dependent.
        <div className={DEFAULT_HOSTS_ROW} data-loading-optional={config.cardShowsHosts ? undefined : true}>
          {hosts.map((host, index) => (
            <SquareAvatar
              variant="round"
              key={`${item.id}-host-${index}`}
              src={host.avatar || undefined}
              alt={host.name}
              fallback={host.name.charAt(0).toUpperCase()}
              size="sm"
              data-loading-item
            />
          ))}
        </div>
      )}
    </div>
  );

  const cardFrameClass = cn(DEFAULT_BODY, className);
  const actionLabel = programActionLabel(config.labels.singular);

  if (wholeCardClickable) {
    return (
      <ContentCardFrame as="a" href={href} target={target} rel={rel} className={cardFrameClass}>
        {cardHeader}
        {images.length > 0 && <MediaGallery images={images} title={item.title} optional={!config.cardShowsGallery} />}
        <div className={DEFAULT_FOOTER}>
          <span
            className="inline-flex items-center gap-2 rounded-md border border-ods-border px-4 py-2 text-ods-text-primary text-h4"
            aria-hidden="true"
          >
            {actionLabel}
            <ArrowRight className="h-5 w-5" />
          </span>
        </div>
      </ContentCardFrame>
    );
  }

  return (
    <ContentCardFrame as="div" className={cardFrameClass}>
      <Link href={href} target={target} rel={rel} className="block">
        {cardHeader}
      </Link>
      {images.length > 0 && <MediaGallery images={images} title={item.title} optional={!config.cardShowsGallery} />}
      <div className={DEFAULT_FOOTER}>
        <ProgramActionButton label={actionLabel} href={href} newTab={target === '_blank'} />
      </div>
    </ContentCardFrame>
  );
}
