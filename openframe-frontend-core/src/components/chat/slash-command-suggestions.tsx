"use client"

import { cn } from "../../utils/cn"
import { Card } from "../ui/card"
import { Button } from "../ui/button"
import type { SlashCommandSummary } from "./types"

interface SlashCommandSuggestionsProps {
  /** Filtered command list to render. Empty list → component renders null. */
  commands: SlashCommandSummary[]
  /** Index of the currently-highlighted suggestion (keyboard cursor or hover). */
  highlightedIdx: number
  /** Hover callback so keyboard + mouse stay in sync. */
  onHover: (idx: number) => void
  /** Click / Enter callback — passes the chosen command to the parent. */
  onSelect: (cmd: SlashCommandSummary) => void
  /** Optional className override for positioning (e.g. `absolute bottom-full`). */
  className?: string
}

/**
 * Inline slash-command autocomplete dropdown.
 *
 * Pure presentation: takes the suggestion list + highlight index from the
 * parent, renders a UI-Kit `<Card>` with one `<Button variant="transparent">`
 * row per suggestion. ODS tokens throughout — NO primitive `<ul>` / `<li>` /
 * raw `<button>` allowed inside.
 *
 * Keyboard handling stays in the parent (`<ChatInput>`) because the keys
 * (ArrowUp / Down / Tab / Enter / Esc) need to hook into the textarea's
 * `onKeyDown`. This component just exposes the rendering contract: hover
 * to highlight, click to accept.
 */
export function SlashCommandSuggestions({
  commands,
  highlightedIdx,
  onHover,
  onSelect,
  className,
}: SlashCommandSuggestionsProps) {
  if (commands.length === 0) return null
  return (
    <Card
      role="listbox"
      aria-label="Slash command suggestions"
      className={cn(
        "absolute bottom-full mb-2 left-0 right-0 max-h-72 overflow-auto",
        "bg-ods-card text-ods-text-primary border-ods-border",
        "z-50 p-1",
        className,
      )}
    >
      {commands.map((cmd, idx) => (
        <Button
          key={cmd.id}
          variant="transparent"
          size="small"
          fullWidth
          type="button"
          role="option"
          aria-selected={idx === highlightedIdx}
          onMouseEnter={() => onHover(idx)}
          onClick={() => onSelect(cmd)}
          className={cn(
            "justify-start text-left h-auto py-2 px-3",
            "text-ods-text-primary",
            idx === highlightedIdx
              ? "bg-ods-card-hover"
              : "bg-transparent",
          )}
        >
          <span className="font-mono text-h5 mr-2 text-ods-text-primary">
            /{cmd.id}
          </span>
          {cmd.argumentHint && (
            <span className="font-mono text-h5 mr-2 text-ods-text-muted shrink-0">
              {cmd.argumentHint}
            </span>
          )}
          <span className="text-h5 text-ods-text-secondary truncate">
            — {cmd.description}
          </span>
        </Button>
      ))}
    </Card>
  )
}
