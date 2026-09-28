'use client';

import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';

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
  /** Optional className appended to the root element. */
  className?: string;
}

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
  className,
}: MingoOnboardingCardProps) {
  const hasActions = !!actions && actions.length > 0;
  const isInteractive = !hasActions && !!onClick;

  const body = (
    <div className="flex w-full flex-col gap-[var(--spacing-system-xxs)]">
      <div className="flex w-full items-center gap-[var(--spacing-system-xxs)]">
        {icon ? (
          // Icon slot — monochrome `ods-text-secondary` (≈ #888) so
          // consumers can drop any `icons-v2-generated` glyph (they use
          // `currentColor`) without per-card styling. Brand multi-color
          // SVGs ignore this color.
          <span className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary">{icon}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-ods-text-primary text-h6">{title}</span>
        {slashCommand ? (
          <span className="whitespace-nowrap text-ods-text-secondary text-h6">{slashCommand}</span>
        ) : null}
      </div>
      {description ? <p className="w-full text-ods-text-secondary text-h6">{description}</p> : null}
      {hasActions ? (
        <div className="mt-[var(--spacing-system-xs)] flex flex-wrap items-center gap-[var(--spacing-system-xxs)]">
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
    'flex w-full items-start border-b border-ods-border bg-ods-card p-[var(--spacing-system-s)] text-left last:border-b-0',
    isInteractive &&
      'cursor-pointer transition-colors hover:bg-ods-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent',
    className,
  );

  if (isInteractive) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {body}
      </button>
    );
  }

  return <div className={baseClass}>{body}</div>;
}
