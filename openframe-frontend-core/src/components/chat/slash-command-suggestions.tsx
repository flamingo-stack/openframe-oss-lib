'use client'

import type { KeyboardEvent } from 'react'
import { cn } from '../../utils/cn'
import { MingoOnboardingCard } from './mingo-onboarding-card'
import { resolveIcon } from './utils/icon-library'
import type {
  SlashCommandActionId,
  SlashCommandSourceMeta,
  SlashCommandSummary,
} from './types'

interface SlashCommandSuggestionsProps {
  /** Filtered command list to render. Empty list → component renders null. */
  commands: SlashCommandSummary[]
  /** Index of the currently-highlighted suggestion (keyboard cursor or hover). */
  highlightedIdx: number
  /** Hover callback so keyboard + mouse stay in sync. */
  onHover: (idx: number) => void
  /** Click / Enter callback — the row's "default" action (clicking
   *  anywhere on the row body, NOT one of the explicit action buttons).
   *  The host typically maps this to "Search-mode pre-fill" (setValue
   *  `/<cmd> ` with cursor at end). */
  onSelect: (cmd: SlashCommandSummary) => void
  /** Legacy `primarySourceId` → icon resolver. Used as a FALLBACK only
   *  when `cmd.iconName` is missing. Newer command summaries carry
   *  `iconName` directly and route through `resolveIcon` so
   *  the dropdown row uses the same icon registry as the empty-state
   *  onboarding cards. */
  resolveSourceIcon?: (sourceId: string) => SlashCommandSourceMeta | undefined
  /** Generic action handler — fires when the user clicks any of the
   *  command's action buttons. The action's id discriminates the
   *  dispatch behavior (browse / search / find / …); the host owns
   *  the mapping. When undefined, NO action buttons render. */
  onAction?: (cmd: SlashCommandSummary, actionId: SlashCommandActionId) => void
  /** Optional className override for positioning (e.g. `absolute bottom-full`). */
  className?: string
}

/**
 * Slash-command autocomplete dropdown.
 *
 * Visually mirrors the empty-state onboarding list: each row is rendered
 * via `MingoOnboardingCard` (Figma node `7363:205939`) so the dropdown
 * and the empty-state share one card design. Rows are stacked inside a
 * `rounded-md` container whose `overflow-hidden` clips each card's
 * `border-b` divider into a clean 1-px frame.
 *
 * Icon resolution priority:
 *   1. `cmd.iconName` → `resolveIcon` (production path —
 *      matches the keys returned by `/api/docs/commands`).
 *   2. `cmd.primarySourceId` → consumer-provided `resolveSourceIcon`
 *      (legacy fallback for command feeds without `iconName`).
 *   3. `FileIcon` (default inside `resolveIcon`).
 *
 * Clicking the row body fires `onSelect` (the host typically maps this
 * to Search-mode pre-fill so the user can refine). Clicking an action
 * button fires `onAction(cmd, actionId)` — the card's action buttons
 * already `stopPropagation` so the row click doesn't double-fire.
 *
 * Accessibility: the outer container is `role="menu"`; each row is
 * `role="menuitem"` with `aria-current` for the highlighted row. The
 * menu (not listbox) is used because ARIA 1.2 forbids interactive
 * descendants inside `role="option"`, and our rows host inline action
 * buttons.
 */
export function SlashCommandSuggestions({
  commands,
  highlightedIdx,
  onHover,
  onSelect,
  resolveSourceIcon,
  onAction,
  className,
}: SlashCommandSuggestionsProps) {
  if (commands.length === 0) return null
  return (
    <div
      role="menu"
      aria-label="Slash command suggestions"
      className={cn(
        'absolute bottom-full mb-2 left-0 right-0 z-50 max-h-96 overflow-y-auto overscroll-contain',
        'rounded-md border border-ods-border bg-ods-card shadow-lg',
        className,
      )}
    >
      {commands.map((cmd, idx) => {
        const Icon = resolveIcon(cmd.iconName)
        // Legacy resolver runs ONLY when `iconName` is missing — otherwise
        // the v2 registry above is authoritative.
        const legacyMeta =
          !cmd.iconName && cmd.primarySourceId && resolveSourceIcon
            ? resolveSourceIcon(cmd.primarySourceId)
            : undefined
        const LegacyIcon = legacyMeta?.Icon
        // Display label priority — single source of truth, same field
        // that drives the empty-state chip title so the dropdown row
        // and the chip never drift:
        //   1. `cmd.label` — DB-projected per-command label.
        //   2. `legacyMeta.label` — legacy resolver fallback.
        //   3. `cmd.id` — raw slug, last-resort identifier.
        const title = cmd.label ?? legacyMeta?.label ?? cmd.id
        const isHighlighted = idx === highlightedIdx
        // `/cmd [arg-hint]` rendered in the slashCommand slot so the
        // card's existing right-rail typography (h6 / secondary text)
        // applies uniformly to both segments.
        const slashLabel = cmd.argumentHint
          ? `/${cmd.id} ${cmd.argumentHint}`
          : `/${cmd.id}`
        const cardActions =
          onAction && cmd.actions.length > 0
            ? cmd.actions.map((action) => ({
                id: action.id,
                label: action.label,
                onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation()
                  onAction(cmd, action.id)
                },
              }))
            : undefined
        return (
          <div
            key={cmd.id}
            role="menuitem"
            aria-current={isHighlighted ? 'true' : undefined}
            tabIndex={-1}
            onMouseEnter={() => onHover(idx)}
            onClick={() => onSelect(cmd)}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
              // Enter/Space activate; arrow keys are owned by the
              // parent input (which manages `highlightedIdx`).
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onSelect(cmd)
              }
            }}
            className="cursor-pointer outline-none"
          >
            <MingoOnboardingCard
              icon={
                LegacyIcon ? (
                  <LegacyIcon className="size-4" />
                ) : (
                  <Icon size={16} />
                )
              }
              title={title}
              slashCommand={slashLabel}
              description={cmd.description}
              actions={cardActions}
              className={cn(
                'transition-colors',
                isHighlighted && 'bg-ods-bg-hover',
              )}
            />
          </div>
        )
      })}
    </div>
  )
}
