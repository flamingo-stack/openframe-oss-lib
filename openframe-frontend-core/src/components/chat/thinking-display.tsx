"use client"

import { forwardRef, useState } from "react"

import { cn } from "../../utils/cn"
import { DotsLoaderIcon } from "../icons-v2-generated"
import { SimpleMarkdownRenderer } from "../ui/markdown/simple-markdown-renderer"
import { ExpandChevron } from "./expand-chevron"
import { useCollapsible } from "./hooks/use-collapsible"
import type { ThinkingDisplayProps } from "./types"

// Tame SimpleMarkdownRenderer for the muted "thought" aesthetic:
//  - all text in secondary tone with small size
//  - bold pops back to primary so emphasis still reads
//  - tighter paragraph/list/heading spacing (renderer ships with mt-8 mb-4)
//  - flatter horizontal rules
//  - inline-code visually quieter inside thoughts
//  - fenced code blocks (`.code-block-container`) lose the renderer's `my-6`
//    and inner `p-4` so they sit flush with surrounding paragraphs
const thoughtMdClasses = [
  // Body & lists — muted grey, never white.
  "[&_p]:!text-sm [&_p]:!text-ods-text-secondary [&_p]:!leading-snug [&_p]:!my-2 [&_p:first-child]:!mt-0 [&_p:last-child]:!mb-0",
  "[&_li]:!text-sm [&_li]:!text-ods-text-secondary [&_li]:!leading-snug",
  "[&_ul]:!my-2 [&_ol]:!my-2 [&_ul]:!pl-5 [&_ol]:!pl-5",
  // Inline emphasis stays grey too. Bold pops via weight (no color shift),
  // italic via slant — neither is allowed to brighten into white.
  "[&_strong]:!text-ods-text-secondary [&_strong]:!font-semibold",
  "[&_em]:!text-ods-text-secondary",
  // Headings — SimpleMarkdownRenderer paints them `text-ods-text-primary`
  // by default. Override every level back to secondary grey so headings
  // don't suddenly turn white inside a thought block.
  "[&_h1]:!text-sm [&_h1]:!text-ods-text-secondary [&_h1]:!font-semibold [&_h1]:!mt-3 [&_h1]:!mb-1 [&_h1]:!pb-0 [&_h1]:!border-0",
  "[&_h2]:!text-sm [&_h2]:!text-ods-text-secondary [&_h2]:!font-semibold [&_h2]:!mt-3 [&_h2]:!mb-1 [&_h2]:!pb-0 [&_h2]:!border-0",
  "[&_h3]:!text-sm [&_h3]:!text-ods-text-secondary [&_h3]:!font-semibold [&_h3]:!mt-3 [&_h3]:!mb-1",
  "[&_h4]:!text-sm [&_h4]:!text-ods-text-secondary [&_h4]:!font-semibold [&_h4]:!mt-2 [&_h4]:!mb-1",
  "[&_h5]:!text-sm [&_h5]:!text-ods-text-secondary [&_h5]:!font-semibold [&_h5]:!mt-2 [&_h5]:!mb-1",
  "[&_h6]:!text-sm [&_h6]:!text-ods-text-secondary [&_h6]:!font-semibold [&_h6]:!mt-2 [&_h6]:!mb-1",
  // Rules
  "[&_hr]:!my-3 [&_hr]:!border-ods-border [&_hr]:!opacity-40",
  // Inline code — Cursor-style chip: no border, background a notch
  // LIGHTER than the surrounding thought card (`bg-ods-border` is the
  // brightest neutral grey in the palette and sits above `bg-ods-card`),
  // small rounded corners, tight padding. Reads as a clearly raised token
  // without the loud bordered chip of the default renderer.
  "[&_code]:!text-[12px] [&_code]:!text-ods-text-secondary",
  "[&_code]:!border-0 [&_code]:!bg-ods-border [&_code]:!rounded",
  "[&_code]:!px-1.5 [&_code]:!py-0.5",
  "[&_.code-block-container]:!my-2",
  "[&_.code-block-container_.code-header]:!py-1 [&_.code-block-container_.code-header]:!px-3",
  "[&_.code-block-container_>div:last-child]:!p-3",
].join(" ")

const ThinkingDisplay = forwardRef<HTMLDivElement, ThinkingDisplayProps>(
  ({ className, text, isStreaming = false, ...props }, ref) => {
    const [expanded, setExpanded] = useState(false)
    // 26px ≈ one line of `text-sm leading-snug` (~19px) + space for the
    // bordered/padded `<code>` badges that markdown renders inline. With
    // exact 1lh the bottom of those badges gets clipped.
    const { innerRef, isOverflowing, containerStyle } = useCollapsible({
      expanded,
      collapsedHeight: 19,
      disableTransition: isStreaming,
    })
    const label = isStreaming ? "Thinking" : "Thought"
    const canToggle = isOverflowing || expanded

    const toggle = () => canToggle && setExpanded(!expanded)
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!canToggle) return
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        setExpanded(!expanded)
      }
    }

    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border p-1.5 rounded-[6px]",
          className
        )}
        {...props}
      >
        <div
          role="button"
          tabIndex={canToggle ? 0 : -1}
          aria-expanded={expanded}
          onClick={toggle}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-full flex items-start gap-3 text-left",
            canToggle ? "cursor-pointer" : "cursor-default"
          )}
        >
          <div className="flex items-center gap-1 shrink-0 h-[19px]">
            <span className="text-sm font-medium leading-snug text-ods-text-secondary">
              {label}:
            </span>
            {isStreaming && <DotsLoaderIcon size={16} className="text-ods-text-secondary" />}
          </div>

          <div className="flex-1 min-w-0" style={containerStyle}>
            <div
              ref={innerRef}
              className={cn("text-sm leading-snug text-ods-text-secondary", thoughtMdClasses)}
            >
              <SimpleMarkdownRenderer content={text} textSize="compact" />
            </div>
          </div>

          {canToggle && (
            <div className="h-[19px] flex items-center shrink-0">
              <ExpandChevron expanded={expanded} />
            </div>
          )}
        </div>
      </div>
    )
  }
)

ThinkingDisplay.displayName = "ThinkingDisplay"

export { ThinkingDisplay }
