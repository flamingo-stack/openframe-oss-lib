'use client';

import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { InteractiveSkeleton, MediaSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { Button } from '../ui/button';
import { loadingItemProps, useLoadingScope } from '../ui/loading-scope';

export interface MingoOnboardingCardAction {
  /** Stable React key. */
  id: string;
  /** Button label (e.g. "Recent", "Search", "Find"). Rendered as-is. */
  label: ReactNode;
  /** Click handler — receives the original mouse event so callers that
   *  also have a card-level `onClick` can `stopPropagation`. */
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export interface MingoOnboardingCardProps {
  /** Leading 16×16 icon rendered to the left of the title row. */
  icon?: ReactNode;
  /** Card title (DM Sans Medium 14px, white). Truncates on overflow. */
  title: ReactNode;
  /** Slash-command label rendered right-aligned in the title row (e.g. `/roadmap`). */
  slashCommand?: ReactNode;
  /** Optional description rendered below the title row. */
  description?: ReactNode;
  /** Optional row of small outline action buttons rendered below the
   *  description (e.g. `Recent`, `Search`, `Find`). When supplied, the
   *  card itself stays a non-interactive `<div>` — each action button
   *  owns its own click contract. */
  actions?: ReadonlyArray<MingoOnboardingCardAction>;
  /** Optional click handler — when set AND `actions` is empty/undefined,
   *  the card renders as a `<button>` with hover/focus affordances.
   *  Ignored when `actions` is non-empty. */
  onClick?: () => void;
  /** The commands are still loading: the card draws its own skeleton. Inside a `LoadingScope` it does so whatever
   *  this says. */
  loading?: boolean;
  /** The card's place in its list: picks the loading state's bar widths, so a list of loading cards is irregular. */
  skeletonIndex?: number;
  /** Optional className appended to the root element. */
  className?: string;
}

/** The card's frame, read by the card and its skeleton. */
const CARD_BASE_CLASS =
  'flex w-full items-start border-b border-ods-border bg-ods-card p-[var(--spacing-system-s)] text-left last:border-b-0';
const CARD_BODY_CLASS = 'flex w-full flex-col gap-[var(--spacing-system-xxs)]';
const CARD_TITLE_ROW_CLASS = 'flex w-full items-center gap-[var(--spacing-system-xxs)]';
const CARD_ICON_CLASS = 'flex size-4 shrink-0 items-center justify-center text-ods-text-secondary';
const CARD_ACTIONS_CLASS = 'mt-[var(--spacing-system-xs)] flex flex-wrap items-center gap-[var(--spacing-system-xxs)]';

/**
 * MingoOnboardingCard — Figma node `7363:205939`.
 *
 * A single onboarding/slash-command row card used inside the chat
 * empty-state list. Background `ods-card` (#212121), `border-b` (#3a3a3a)
 * acts as a 1-px divider between stacked cards; the consumer is expected
 * to render multiple cards in a column inside a `rounded-md` container so
 * the bottom-most card's `last:border-b-0` keeps the visual frame clean.
 *
 * Typography mirrors Figma's `h6 - captions` (DM Sans Medium 14px,
 * letter-spacing 0). Title uses `text-ods-text-primary`, the right-rail
 * `/cmd` label and the description use `text-ods-text-secondary`.
 *
 * Optional `actions` row renders small outline-chip buttons below the
 * description (Recent / Search / Find pattern from the legacy chip-grid)
 * so each row can expose multiple affordances without leaving the card.
 */
export function MingoOnboardingCard({
  icon,
  title,
  slashCommand,
  description,
  actions,
  onClick,
  loading = false,
  skeletonIndex = 0,
  className,
  ...props
}: MingoOnboardingCardProps) {
  const hasActions = !!actions && actions.length > 0;
  // The card's markers (`data-loading-item` for a card of a read list), on the loaded and the loading card alike.
  const itemProps = loadingItemProps(props);
  if (useLoadingScope() || loading) {
    return (
      <MingoOnboardingCardSkeleton
        {...mingoOnboardingSkeletonVariant(skeletonIndex)}
        // A card known to have no actions draws no chip row; while the commands load, the typical card has them.
        chipWidths={actions && actions.length === 0 ? [] : undefined}
        className={className}
        {...itemProps}
      />
    );
  }
  const isInteractive = !hasActions && !!onClick;

  const body = (
    <div className={CARD_BODY_CLASS}>
      <div className={CARD_TITLE_ROW_CLASS}>
        {icon ? (
          // Icon slot — monochrome `ods-text-secondary` (≈ #888) so
          // consumers can drop any `icons-v2-generated` glyph (they use
          // `currentColor`) without per-card styling. Brand multi-color
          // SVGs ignore this color.
          <span className={CARD_ICON_CLASS}>{icon}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h6">{title}</span>
        {slashCommand ? (
          <span className="whitespace-nowrap text-ods-text-secondary text-h6">{slashCommand}</span>
        ) : null}
      </div>
      {description ? <p className="w-full text-ods-text-secondary text-h6">{description}</p> : null}
      {hasActions ? (
        <div className={CARD_ACTIONS_CLASS}>
          {actions.map(action => (
            <Button
              key={action.id}
              type="button"
              variant="outline"
              size="small"
              onClick={e => {
                e.stopPropagation();
                action.onClick(e);
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );

  const baseClass = cn(
    CARD_BASE_CLASS,
    isInteractive &&
      'cursor-pointer transition-colors hover:bg-ods-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent',
    className,
  );

  if (isInteractive) {
    return (
      <button type="button" onClick={onClick} className={baseClass} {...itemProps}>
        {body}
      </button>
    );
  }

  return (
    <div className={baseClass} {...itemProps}>
      {body}
    </div>
  );
}

interface MingoOnboardingCardSkeletonProps {
  /** Title bar width (a Tailwind width utility). Defaults to `w-32`. */
  titleWidth?: string;
  /** Slash-command bar width (a Tailwind width utility). Defaults to `w-20`. */
  slashWidth?: string;
  /** Description lines (1 or 2). Defaults to 2, the typical card. */
  descriptionLines?: 1 | 2;
  /** Chip widths for the action row (the `Recent / Search / Find` triad by default); an empty array draws no row. */
  chipWidths?: ReadonlyArray<string>;
  className?: string;
}

/**
 * `MingoOnboardingCard` while its command is read: the card's own frame and rows (its class constants), the icon a
 * 16px box, the title, the slash command and the description as text-h6 lines, and the actions as small buttons.
 */
function MingoOnboardingCardSkeleton({
  titleWidth = 'w-32',
  slashWidth = 'w-20',
  descriptionLines = 2,
  chipWidths = ['w-16', 'w-16', 'w-12'],
  className,
  ...props
}: MingoOnboardingCardSkeletonProps) {
  return (
    <div className={cn(CARD_BASE_CLASS, className)} {...props}>
      <div className={CARD_BODY_CLASS}>
        <div className={CARD_TITLE_ROW_CLASS}>
          <span className={CARD_ICON_CLASS}>
            <MediaSkeleton.Icon size="sm" />
          </span>
          <span className="min-w-0 flex-1">
            <TextLineSkeleton type="h6" className={titleWidth} />
          </span>
          <TextLineSkeleton type="h6" className={cn('shrink-0', slashWidth)} />
        </div>
        <TextLineSkeleton type="h6" lines={descriptionLines} className="w-full" />
        {chipWidths.length > 0 ? (
          <div className={CARD_ACTIONS_CLASS}>
            {chipWidths.map((width, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton chips never reorder
              <InteractiveSkeleton.Button key={i} size="small" className={width} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Per-card bar widths, cycled by index so a list of loading cards is irregular and the same list draws the same bars.
 * Titles range from short ("Webinars") to long ("OpenFrame Pull Requests"), slashes from `/docs` to
 * `/getting-started`.
 */
const ROW_VARIANTS: ReadonlyArray<{
  titleWidth: string;
  slashWidth: string;
  descriptionLines: 1 | 2;
}> = [
  { titleWidth: 'w-32', slashWidth: 'w-20', descriptionLines: 2 },
  { titleWidth: 'w-28', slashWidth: 'w-16', descriptionLines: 2 },
  { titleWidth: 'w-40', slashWidth: 'w-24', descriptionLines: 2 },
  { titleWidth: 'w-44', slashWidth: 'w-28', descriptionLines: 2 },
  { titleWidth: 'w-36', slashWidth: 'w-24', descriptionLines: 1 },
  { titleWidth: 'w-24', slashWidth: 'w-16', descriptionLines: 2 },
];

/** Slash-command cards the loading state draws: a typical list, since the commands list has no page size of its own. */
export const MINGO_ONBOARDING_SKELETON_ROWS = ROW_VARIANTS.length;

/** The bar widths of the loading card at `index` in its list (cycled, so the same list draws the same bars). */
export function mingoOnboardingSkeletonVariant(
  index: number,
): Pick<MingoOnboardingCardSkeletonProps, 'titleWidth' | 'slashWidth' | 'descriptionLines'> {
  return ROW_VARIANTS[index % ROW_VARIANTS.length];
}
