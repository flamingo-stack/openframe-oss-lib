"use client"

import type { MouseEvent } from "react"
import { cn } from "../../utils/cn"
import { Card } from "../ui/card"
import type {
  SlashCommandSourceMeta,
  SlashCommandSummary,
} from "./types"

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
  /** Optional source-icon resolver. Looks up `primarySourceId` on a
   *  command summary and returns an icon + label so the row carries the
   *  same visual identity as the empty-state chip for that source. */
  resolveSourceIcon?: (sourceId: string) => SlashCommandSourceMeta | undefined
  /** Optional Recent action handler — rendered as a button when provided. */
  onActionRecent?: (cmd: SlashCommandSummary) => void
  /** Optional Search action handler — rendered as a button when provided.
   *  Functionally identical to `onSelect` (both pre-fill the command for
   *  refinement), but exposing it as an explicit button makes the three
   *  modes (Recent / Search / Find) discoverable without users having to
   *  know that clicking the row equals Search. */
  onActionSearch?: (cmd: SlashCommandSummary) => void
  /** Optional Find action handler — rendered as a button ONLY when the
   *  command's `supportsSingular` flag is true (ILIKE-by-name only makes
   *  sense for commands with `singularLookup`). */
  onActionFind?: (cmd: SlashCommandSummary) => void
  /** Optional className override for positioning (e.g. `absolute bottom-full`). */
  className?: string
}

/**
 * Slash-command autocomplete dropdown.
 *
 * Each row is a card-shaped option with three regions:
 *   - LEFT: source icon (from `resolveSourceIcon`, when available)
 *   - MIDDLE: source label + slash id + argument hint + description (2-line clamp)
 *   - RIGHT: up to three action buttons (Recent / Search / Find), per
 *     2026 chat UX best practice (3-5 quick-action buttons per row).
 *     The Find button is gated on `supportsSingular`.
 *
 * Clicking the row body fires `onSelect` (the host typically maps this to
 * Search-mode pre-fill so the user can refine). Clicking an action button
 * fires the corresponding `onAction*` handler and stops propagation so the
 * row click doesn't double-fire.
 *
 * Accessibility: the outer container is `role="menu"`; each row is
 * `role="menuitem"` with `aria-current` for the highlighted row. We use
 * menu (not listbox) because ARIA 1.2 forbids interactive descendants
 * inside `role="option"`, and our rows host inline action buttons. The
 * action buttons are real `<button>` elements with `aria-label`s, but
 * `tabIndex={-1}` keeps them out of Tab order — Tab dismisses the popup
 * as standard combobox UX expects, while click + arrow-key highlight
 * still work for mouse and keyboard users.
 */
export function SlashCommandSuggestions({
  commands,
  highlightedIdx,
  onHover,
  onSelect,
  resolveSourceIcon,
  onActionRecent,
  onActionSearch,
  onActionFind,
  className,
}: SlashCommandSuggestionsProps) {
  if (commands.length === 0) return null
  return (
    <Card
      role="menu"
      aria-label="Slash command suggestions"
      className={cn(
        "absolute bottom-full mb-2 left-0 right-0 max-h-96 overflow-auto",
        "bg-ods-card text-ods-text-primary border-ods-border",
        "z-50 p-1 flex flex-col gap-0.5",
        className,
      )}
    >
      {commands.map((cmd, idx) => {
        const meta = cmd.primarySourceId && resolveSourceIcon
          ? resolveSourceIcon(cmd.primarySourceId)
          : undefined
        const Icon = meta?.Icon
        const sourceLabel = meta?.label
        const isHighlighted = idx === highlightedIdx
        return (
          <div
            key={cmd.id}
            role="menuitem"
            aria-current={isHighlighted ? "true" : undefined}
            onMouseEnter={() => onHover(idx)}
            onClick={() => onSelect(cmd)}
            className={cn(
              "flex items-start gap-3 rounded-md px-3 py-2 cursor-pointer transition-colors",
              "border border-transparent",
              isHighlighted
                ? "bg-ods-card-hover"
                : "bg-transparent hover:bg-ods-card-hover",
            )}
          >
            {Icon && (
              <Icon className="h-5 w-5 mt-0.5 shrink-0 text-ods-text-primary" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                {sourceLabel && (
                  <span className="text-sm font-medium text-ods-text-primary">
                    {sourceLabel}
                  </span>
                )}
                <span className="font-mono text-xs text-ods-text-muted">
                  /{cmd.id}
                </span>
                {cmd.argumentHint && (
                  <span className="font-mono text-xs text-ods-text-muted">
                    {cmd.argumentHint}
                  </span>
                )}
              </div>
              <p className="text-xs text-ods-text-secondary leading-snug line-clamp-2 mt-0.5">
                {cmd.description}
              </p>
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              {onActionRecent && (
                <SuggestionActionButton
                  label="Recent"
                  ariaLabel={`Show recent ${cmd.id}`}
                  title="Show recent items"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionRecent(cmd)
                  }}
                />
              )}
              {onActionSearch && (
                <SuggestionActionButton
                  label="Search"
                  ariaLabel={`Search ${cmd.id}`}
                  title="Search by keywords"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionSearch(cmd)
                  }}
                />
              )}
              {onActionFind && cmd.supportsSingular && (
                <SuggestionActionButton
                  label="Find"
                  ariaLabel={`Find specific ${cmd.id} by id or exact name`}
                  title="Find a specific item by id or exact name"
                  onClick={(e) => {
                    e.stopPropagation()
                    onActionFind(cmd)
                  }}
                />
              )}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

/**
 * Per-row action button. Shared styling hoisted so all three (Recent /
 * Search / Find) stay visually synced. ODS tokens throughout; intentionally
 * smaller than UI-Kit `<Button size="small">` because these are chip-density
 * action buttons inside a compact dropdown row.
 */
function SuggestionActionButton({
  label,
  ariaLabel,
  title,
  onClick,
}: {
  label: string
  ariaLabel: string
  title: string
  onClick: (e: MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      title={title}
      onClick={onClick}
      className={cn(
        "text-[11px] font-medium text-ods-text-secondary",
        "hover:text-ods-text-primary",
        "bg-transparent hover:bg-ods-card border border-ods-border rounded-md",
        "px-2 py-0.5 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-focus",
      )}
    >
      {label}
    </button>
  )
}
