'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'

export interface MingoOnboardingCardAction {
  /** Stable React key. */
  id: string
  /** Button label (e.g. "Recent", "Search", "Find"). Rendered as-is. */
  label: React.ReactNode
  /** Click handler — receives the original mouse event so callers that
   *  also have a card-level `onClick` can `stopPropagation`. */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export interface MingoOnboardingCardProps {
  /** Leading 16×16 icon rendered to the left of the title row. */
  icon?: React.ReactNode
  /** Card title (DM Sans Medium 14px, white). Truncates on overflow. */
  title: React.ReactNode
  /** Slash-command label rendered right-aligned in the title row (e.g. `/roadmap`). */
  slashCommand?: React.ReactNode
  /** Optional description rendered below the title row. */
  description?: React.ReactNode
  /** Optional row of small outline action buttons rendered below the
   *  description (e.g. `Recent`, `Search`, `Find`). When supplied, the
   *  card itself stays a non-interactive `<div>` — each action button
   *  owns its own click contract. */
  actions?: ReadonlyArray<MingoOnboardingCardAction>
  /** Optional click handler — when set AND `actions` is empty/undefined,
   *  the card renders as a `<button>` with hover/focus affordances.
   *  Ignored when `actions` is non-empty. */
  onClick?: () => void
  /** Optional className appended to the root element. */
  className?: string
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
  const hasActions = !!actions && actions.length > 0
  const isInteractive = !hasActions && !!onClick

  const body = (
    <div className="flex flex-col gap-[var(--spacing-system-xxs)] w-full">
      <div className="flex items-center gap-[var(--spacing-system-xxs)] w-full">
        {icon ? (
          // Icon slot — monochrome `ods-text-secondary` (≈ #888) so
          // consumers can drop any `icons-v2-generated` glyph (they use
          // `currentColor`) without per-card styling. Brand multi-color
          // SVGs ignore this color.
          <span className="flex shrink-0 size-4 items-center justify-center text-ods-text-secondary">
            {icon}
          </span>
        ) : null}
        <span className="flex-1 min-w-0 truncate text-h6 text-ods-text-primary">
          {title}
        </span>
        {slashCommand ? (
          <span className="text-h6 text-ods-text-secondary whitespace-nowrap">
            {slashCommand}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="text-h6 text-ods-text-secondary w-full">{description}</p>
      ) : null}
      {hasActions ? (
        <div className="flex flex-wrap items-center gap-[var(--spacing-system-xxs)] mt-[var(--spacing-system-xs)]">
          {actions!.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                action.onClick(e)
              }}
              className={cn(
                'inline-flex h-7 items-center justify-center px-[var(--spacing-system-xs)] rounded-md',
                'border border-ods-border bg-transparent text-h6 text-ods-text-primary',
                'transition-colors hover:bg-ods-bg-hover hover:border-ods-text-secondary',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )

  const baseClass = cn(
    'flex w-full items-start p-[var(--spacing-system-s)] bg-ods-card border-b border-ods-border last:border-b-0 text-left',
    isInteractive &&
      'transition-colors hover:bg-ods-bg-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ods-accent cursor-pointer',
    className,
  )

  if (isInteractive) {
    return (
      <button type="button" onClick={onClick} className={baseClass}>
        {body}
      </button>
    )
  }

  return <div className={baseClass}>{body}</div>
}
