'use client';

import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { InteractiveSkeleton, MediaSkeleton, TextLineSkeleton } from '../loading/unified-skeleton';
import { BUTTON_KIND_CLASS, Button } from '../ui/button';
import { InertWhileLoading, LoadingItems, loadingItemProps, useLoadingScope } from '../ui/loading-scope';
import { SKELETON_TITLE_WIDTHS } from './chat-nav-sidebar';

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
  /** The commands are still loading: the card draws its loading form (its known actions real and inert). Inside a
   *  `LoadingScope` it does so whatever this says. */
  loading?: boolean;
  /** The card's place in its list: picks the loading state's bar widths, so a list of loading cards is irregular. */
  skeletonIndex?: number;
  /** Optional className appended to the root element. */
  className?: string;
}

/** The card's frame, loaded and loading. */
const CARD_BASE_CLASS =
  'flex w-full items-start border-b border-ods-border bg-ods-card p-[var(--spacing-system-s)] text-left last:border-b-0';
const CARD_BODY_CLASS = 'flex w-full flex-col gap-[var(--spacing-system-xxs)]';
const CARD_TITLE_ROW_CLASS = 'flex w-full items-center gap-[var(--spacing-system-xxs)]';
const CARD_ICON_CLASS = 'flex size-4 shrink-0 items-center justify-center text-ods-text-secondary';
const CARD_ACTIONS_CLASS = 'mt-[var(--spacing-system-xs)] flex flex-wrap items-center gap-[var(--spacing-system-xxs)]';

/** Action chips a loading card draws while it knows none of its actions: the typical `Recent / Search / Find` row. */
const MINGO_ONBOARDING_CARD_SKELETON_ACTIONS = 3;

/**
 * Per-card loading shapes, cycled by index so a list of loading cards is irregular and the same list draws the same
 * bars (the title's width is the chat lists' shared {@link SKELETON_TITLE_WIDTHS}). Slashes range from `/docs` to
 * `/getting-started`.
 */
const ROW_VARIANTS: ReadonlyArray<{ slashWidth: string; descriptionLines: 1 | 2 }> = [
  { slashWidth: 'w-20', descriptionLines: 2 },
  { slashWidth: 'w-16', descriptionLines: 2 },
  { slashWidth: 'w-24', descriptionLines: 2 },
  { slashWidth: 'w-28', descriptionLines: 2 },
  { slashWidth: 'w-24', descriptionLines: 1 },
  { slashWidth: 'w-16', descriptionLines: 2 },
];

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
  loading: loadingProp = false,
  skeletonIndex = 0,
  className,
  ...props
}: MingoOnboardingCardProps) {
  // ONE switch: while the commands are read the SAME card draws its icon box, title, slash command and description as
  // bars; the actions it knows are drawn real and inert, and the typical three chips only when it knows none yet.
  const loading = useLoadingScope() || loadingProp;
  const hasActions = !!actions && actions.length > 0;
  // The card's markers (`data-loading-item` for a card of a read list), on the loaded and the loading card alike.
  const itemProps = loadingItemProps(props);
  const variant = ROW_VARIANTS[skeletonIndex % ROW_VARIANTS.length];
  const isInteractive = !loading && !hasActions && !!onClick;

  const actionButtons = hasActions
    ? actions.map(action => (
        <Button
          key={action.id}
          data-loading-item
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
      ))
    : null;

  const body = (
    <div className={CARD_BODY_CLASS}>
      <div className={CARD_TITLE_ROW_CLASS}>
        {loading ? (
          <span className={CARD_ICON_CLASS}>
            <MediaSkeleton.Icon size="sm" />
          </span>
        ) : icon ? (
          // Icon slot — monochrome `ods-text-secondary` (≈ #888) so
          // consumers can drop any `icons-v2-generated` glyph (they use
          // `currentColor`) without per-card styling. Brand multi-color
          // SVGs ignore this color.
          <span className={CARD_ICON_CLASS}>{icon}</span>
        ) : null}
        {loading ? (
          <>
            <span className="min-w-0 flex-1">
              <TextLineSkeleton
                type="h6"
                className={SKELETON_TITLE_WIDTHS[skeletonIndex % SKELETON_TITLE_WIDTHS.length]}
              />
            </span>
            <TextLineSkeleton type="h6" className={cn('shrink-0', variant.slashWidth)} />
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h6">{title}</span>
            {slashCommand ? (
              <span className="whitespace-nowrap text-ods-text-secondary text-h6">{slashCommand}</span>
            ) : null}
          </>
        )}
      </div>
      {loading ? (
        <TextLineSkeleton type="h6" lines={variant.descriptionLines} className="w-full" />
      ) : description ? (
        <p className="w-full text-ods-text-secondary text-h6">{description}</p>
      ) : null}
      {loading && actions === undefined ? (
        // The commands are not read yet: the typical card's three action chips.
        <div className={CARD_ACTIONS_CLASS}>
          <LoadingItems count={MINGO_ONBOARDING_CARD_SKELETON_ACTIONS}>
            {() => <InteractiveSkeleton.Button data-loading-item size="small" className="w-16" />}
          </LoadingItems>
        </div>
      ) : hasActions ? (
        <div className={CARD_ACTIONS_CLASS}>
          {loading ? <InertWhileLoading className="contents">{actionButtons}</InertWhileLoading> : actionButtons}
        </div>
      ) : null}
    </div>
  );

  // A card that is one click target is a list ROW Button; its loading form is the same row box. A card with its own
  // actions (or none at all) is a static card.
  const rowCard = !!onClick && !hasActions;
  const baseClass = cn(rowCard ? BUTTON_KIND_CLASS.row : CARD_BASE_CLASS, className);

  if (isInteractive) {
    return (
      <Button variant="row" type="button" onClick={onClick} className={className} {...itemProps}>
        {body}
      </Button>
    );
  }

  return (
    <div className={baseClass} aria-hidden={loading || undefined} {...itemProps}>
      {body}
    </div>
  );
}

/** Slash-command cards the loading state draws: a typical list, since the commands list has no page size of its own. */
export const MINGO_ONBOARDING_SKELETON_ROWS = ROW_VARIANTS.length;
