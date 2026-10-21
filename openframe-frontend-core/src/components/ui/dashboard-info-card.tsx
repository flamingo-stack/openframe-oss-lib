'use client';

import type { ReactNode } from 'react';
import Link from '../../embed-shims/next-link';
import { cn } from '../../utils/cn';
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { CircularProgress, type CircularProgressOverflow, type CircularProgressVariant } from './circular-progress';
import { FloatingTooltip } from './floating-tooltip';
import { useLoadingScope } from './loading-scope';
import { Tag, TagSkeleton } from './tag';

/**
 * How the percentage is rendered next to the value:
 * - `'auto'` (default): a colored `Tag` for `warning`/`error` variants, plain
 *   "(NN%)" text otherwise. Preserves the original coupling to `progressVariant`.
 * - `'plain'`: always plain "(NN%)" text, regardless of `progressVariant`. Use
 *   when you want a colored progress ring but a neutral percentage (Figma).
 * - `'tag'`: always a colored `Tag`.
 */
export type DashboardInfoCardPercentageDisplay = 'auto' | 'plain' | 'tag';

/**
 * Size of the progress ring in px. A single number sets the ring size from the
 * Tailwind `md` (800px) breakpoint up — on mobile the ring always shrinks to
 * the 24px Figma spec. The responsive form sets `base` (mobile) explicitly,
 * plus optional `md` / `lg` (1280px) overrides — e.g. `{ base: 24, lg: 56 }`
 * keeps the small ring through tablet, and `{ base: 40 }` pins 40px at every
 * breakpoint.
 */
export type DashboardInfoCardProgressSize = number | { base: number; md?: number; lg?: number };

export interface DashboardInfoCardProps {
  title?: string;
  /** Node rendered in place of the title text. Takes precedence over `title`. */
  titleSlot?: ReactNode;
  /**
   * Tag rendered in the title row, after the title (Figma "status" variant) —
   * e.g. `<Tag variant="outline" label="AI Handling" />` or a TicketStatusTag.
   * Works with or without a `title`.
   */
  titleTag?: ReactNode;
  /**
   * Icon or image shown in a bordered square slot on the left (Figma "icon"
   * variant): 32px box / 16px content on mobile, 56px box / 24px content from
   * `md` up. The passed node is stretched to fill the content area, so plain
   * icon components and `<img>` both work.
   */
  icon?: ReactNode;
  value: string | number;
  percentage?: number;
  showProgress?: boolean;
  progressVariant?: CircularProgressVariant;
  /**
   * Controls how `percentage` is rendered (Tag vs plain text) independently of
   * the progress-ring color. Default `'auto'`. See {@link DashboardInfoCardPercentageDisplay}.
   */
  percentageDisplay?: DashboardInfoCardPercentageDisplay;
  /**
   * How the progress ring treats values over 100. Forwarded to `CircularProgress`.
   * Default: `'clamp'` — existing behavior (clamped to 0–100).
   * Use `'wrap'` for overage/overflow semantics (excess rendered as a red arc).
   */
  progressOverflow?: CircularProgressOverflow;
  /**
   * Size of the circular progress ring. Defaults to the Figma spec
   * `{ base: 24, md: 56 }` — 24px on mobile, 56px on tablet and desktop. A
   * number changes only the tablet/desktop size (mobile stays 24px); use
   * `{ base, md?, lg? }` for full control. Stroke width scales proportionally
   * with the size.
   */
  progressSize?: DashboardInfoCardProgressSize;
  className?: string;
  /**
   * Navigation URL — renders the card as a Next.js Link
   * When provided, cursor becomes pointer and hover accent styles are applied
   */
  href?: string;
  /** Tooltip content shown on a question-mark icon next to the value */
  tooltip?: ReactNode;
  /** Override the value text className (default: `text-h3 content-md:text-h2` per Figma) */
  valueClassName?: string;
  /** Secondary text rendered beside the value (e.g. an entry/item count). */
  subValue?: ReactNode;
  /**
   * One line UNDER the value (what the number counts). A card with a caption
   * grows to fit it instead of holding the fixed stat-tile height.
   */
  caption?: ReactNode;
  /**
   * The figure is still being fetched: the SAME card, so the loaded card replaces it in
   * place. `title` / `titleSlot` / `titleTag` / `icon` are drawn as they are (they are known
   * before the data; with neither title a bar holds the title line), the value and caption are
   * bars of their own line heights, the progress ring is held when `showProgress` is set, and
   * the percentage when `loadingShowsPercentage` is set, the sub-value when `loadingShowsSubValue` is set.
   */
  loading?: boolean;
  /**
   * While `loading`: hold the percentage's box (plain "(NN%)" text, or a `Tag` when
   * `percentageDisplay` / `progressVariant` would draw one), because the loaded card will show
   * a percentage. Default `false`.
   */
  loadingShowsPercentage?: boolean;
  /**
   * While `loading`: hold the `subValue`'s box (one `text-h6` line beside the value) for a card
   * whose loaded state will carry one. Default `false`.
   */
  loadingShowsSubValue?: boolean;
  /**
   * While `loading`: the title is read too, so its line is a bar even when a `title` is passed (an empty `title`
   * already draws the bar). `titleSlot` and `titleTag` are left as given. Default `false`.
   */
  titleLoading?: boolean;
  /**
   * While `loading`: the icon is read too (it depends on the figure), so the icon slot is a skeleton of the slot's
   * own box, whether or not an `icon` is passed. Default `false`.
   */
  iconLoading?: boolean;
}

/** The icon slot's box (Figma "icon" variant): 32px on mobile, 56px from `md` up. Read by the slot and its skeleton. */
const DASHBOARD_INFO_CARD_ICON_BOX_CLASS = 'size-8 shrink-0 rounded-sm content-md:size-14';

export function DashboardInfoCard({
  title,
  titleSlot,
  titleTag,
  icon,
  value,
  percentage,
  showProgress = false,
  progressVariant,
  percentageDisplay = 'auto',
  progressOverflow,
  progressSize,
  className,
  href,
  tooltip,
  valueClassName,
  subValue,
  caption,
  loading: loadingProp = false,
  loadingShowsPercentage = false,
  loadingShowsSubValue = false,
  titleLoading = false,
  iconLoading = false,
}: DashboardInfoCardProps) {
  // In a page's loading state the figure is read: the card is its skeleton (`loading`).
  const inScope = useLoadingScope();
  const loading = loadingProp || inScope;
  // A caption still being read is empty while loading: its two lines are kept whenever one is passed.
  const hasCaption = loading ? caption != null : Boolean(caption);
  const formattedValue = typeof value === 'number' ? value.toLocaleString() : value;

  const percentageAsTag =
    percentageDisplay === 'tag' ||
    (percentageDisplay === 'auto' && (progressVariant === 'warning' || progressVariant === 'error'));

  const renderPercentage = () => {
    if (loading) {
      if (!loadingShowsPercentage) return null;
      // The box the loaded percentage takes: a `Tag` (h-8) or one `text-h4` line.
      return percentageAsTag ? (
        <TagSkeleton className="w-12" />
      ) : (
        <p className="text-h4">
          <TextLineSkeleton type="inherit" as="span" className="w-12" />
        </p>
      );
    }
    if (percentage === undefined) return null;

    if (percentageAsTag) {
      const tagVariant =
        progressVariant === 'warning' || progressVariant === 'error'
          ? progressVariant
          : progressVariant === 'success'
            ? 'success'
            : 'grey';
      return <Tag variant={tagVariant} label={`${percentage}%`} />;
    }

    return <p className="text-ods-text-secondary text-h4">({percentage}%)</p>;
  };

  const renderProgress = () => {
    if (!showProgress || (percentage === undefined && !loading)) return null;

    // Keep the ring proportionally weighted (10px stroke at the 56px default).
    const strokeFor = (size: number) => Math.max(2, Math.round((size * 10) / 56));

    const common = {
      percentage: percentage ?? 0,
      variant: progressVariant,
      overflow: progressOverflow,
      showLabel: false,
    };

    // Figma spec: the mobile ring is always 24px. The default is 56px from
    // `md` (800px) up; a numeric `progressSize` overrides only that md+ size.
    const size =
      typeof progressSize === 'number' ? { base: 24, md: progressSize } : (progressSize ?? { base: 24, md: 56 });

    // Responsive: one ring per provided breakpoint, toggled with Tailwind
    // display utilities so only one shows at a time. The class names must stay
    // static string literals — Tailwind's JIT scanner can't see
    // dynamically-built names (e.g. `${bp}:hidden`).
    const { base, md, lg } = size;

    const rings: Array<{ key: string; size: number; className: string }> = [
      {
        key: 'base',
        size: base,
        className: md !== undefined ? 'content-md:hidden' : lg !== undefined ? 'content-lg:hidden' : '',
      },
    ];
    if (md !== undefined) {
      rings.push({
        key: 'md',
        size: md,
        className: lg !== undefined ? 'hidden content-md:block content-lg:hidden' : 'hidden content-md:block',
      });
    }
    if (lg !== undefined) {
      rings.push({ key: 'lg', size: lg, className: 'hidden content-lg:block' });
    }

    if (loading) {
      // The ring's own box at each breakpoint, as a circle.
      return (
        <>
          {rings.map(ring => (
            <UnifiedSkeleton
              key={ring.key}
              variant="circular"
              width={ring.size}
              height={ring.size}
              className={cn('shrink-0', ring.className)}
            />
          ))}
        </>
      );
    }

    return (
      <>
        {rings.map(ring => (
          <CircularProgress
            key={ring.key}
            {...common}
            size={ring.size}
            strokeWidth={strokeFor(ring.size)}
            className={ring.className}
          />
        ))}
      </>
    );
  };

  const cardContent = (
    <>
      {/* Icon slot (Figma "icon" variant): 32px box / 16px content on mobile,
          56px box / 24px content from `md` up. */}
      {loading && iconLoading ? (
        <UnifiedSkeleton className={DASHBOARD_INFO_CARD_ICON_BOX_CLASS} />
      ) : (
        icon && (
          <div
            className={cn(
              DASHBOARD_INFO_CARD_ICON_BOX_CLASS,
              'flex items-center justify-center border border-ods-border bg-ods-bg p-[var(--spacing-system-xxs)] text-ods-text-primary',
            )}
          >
            <span className="flex size-4 items-center justify-center content-md:size-6 [&>*]:size-full">{icon}</span>
          </div>
        )
      )}

      {/* Content section */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Title row: caption and/or tag (Figma "status" variant) */}
        <div className="flex items-center gap-[var(--spacing-system-xxs)]">
          {titleSlot ??
            // A title still being read (empty while loading) is a bar of its line, like no title.
            (title !== undefined && !(loading && (!title || titleLoading)) ? (
              <p className="truncate text-ods-text-secondary text-h5">{title}</p>
            ) : (
              loading && (
                <p className="text-h5">
                  <TextLineSkeleton type="inherit" as="span" className="w-20" />
                </p>
              )
            ))}
          {titleTag}
        </div>

        {/* Value and percentage */}
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <p className={cn('truncate text-ods-text-primary text-h3 content-md:text-h2', valueClassName)}>
            {loading ? <TextLineSkeleton type="inherit" as="span" className="w-24" /> : formattedValue}
          </p>
          {loading
            ? loadingShowsSubValue && (
                <p className="text-h6">
                  <TextLineSkeleton type="inherit" as="span" className="w-16" />
                </p>
              )
            : subValue && <p className="text-ods-text-secondary text-h6">{subValue}</p>}
          {renderPercentage()}
          {tooltip && (
            <FloatingTooltip content={tooltip} side="top">
              <span className="cursor-help text-ods-text-secondary">
                <QuestionCircleIcon size={20} />
              </span>
            </FloatingTooltip>
          )}
        </div>

        {/* Two lines kept for the caption, loading or loaded, so a narrow tile is one height. */}
        {hasCaption && (
          <p className="line-clamp-2 min-h-[2lh] text-ods-text-secondary text-h6">
            {loading ? <TextLineSkeleton type="inherit" as="span" className="w-32" /> : caption}
          </p>
        )}
      </div>

      {/* Progress indicator */}
      {renderProgress()}
    </>
  );

  // Figma spec: mobile 8px padding / 8px gap / exactly 64px tall; tablet+ 16px
  // padding / 16px gap / exactly 104px tall; 6px radius. Fixed height (not
  // min-h) — with a 32px titleTag the natural content height slightly exceeds
  // the spec, and Figma's frame is fixed; items-center absorbs the difference.
  const baseClassName =
    'bg-ods-card border border-ods-border rounded-md p-[var(--spacing-system-xsf)] content-md:p-[var(--spacing-system-m)] h-16 content-md:h-[104px] flex gap-[var(--spacing-system-s)] content-md:gap-[var(--spacing-system-m)] items-center transition-all';

  // A caption is a third line: the fixed stat-tile height would clip it.
  const captionClassName = hasCaption ? 'h-auto content-md:h-auto' : undefined;

  // While loading the card is not yet a link: a skeleton is never focusable.
  if (href && !loading) {
    return (
      <Link
        href={href}
        aria-busy={loading || undefined}
        className={cn(
          baseClassName,
          captionClassName,
          'group cursor-pointer',
          'hover:border-ods-border-hover hover:bg-ods-card-hover',
          className,
        )}
      >
        {cardContent}
      </Link>
    );
  }

  // Loading, the card is busy: one card announces nothing of its own (a grid of them would say it once per
  // card); the region it sits in does.
  return (
    <div aria-busy={loading || undefined} className={cn(baseClassName, captionClassName, className)}>
      {cardContent}
    </div>
  );
}

/**
 * A DashboardInfoCard while its figure is read: the same card with `loading` set, so it is the loaded card's box.
 * The title, title slot, tag and icon it is given are the page's own and draw as they are.
 */
export function DashboardInfoCardSkeleton(props: Omit<DashboardInfoCardProps, 'value' | 'loading'>) {
  return <DashboardInfoCard {...props} value="" loading />;
}
