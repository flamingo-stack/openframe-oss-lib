"use client"

import { forwardRef } from "react"

import { cn } from "../../utils/cn"
import { CompassIcon } from "../icons-v2-generated"
import type { GuideDisplayProps } from "./types"

const GUIDE_LABEL = "OpenFrame Guide"

/**
 * `GUIDE` segment — the assistant's how-to/documentation answer, framed as a
 * titled card instead of a bare paragraph.
 *
 * Chrome only: the caller renders the markdown body and passes it as children,
 * so a guide goes through the SAME body pipeline as a text segment
 * (`[card://]` splitting + hoisted entity cards + mention chips). Rendering the
 * raw markdown here instead would bypass that plan and degrade every card
 * marker inside a guide to a bare title.
 */
const GuideDisplay = forwardRef<HTMLDivElement, GuideDisplayProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-m)]",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-[var(--spacing-system-xs)]">
          <CompassIcon size={16} className="shrink-0 text-ods-open-yellow" />
          <span className="text-h5 text-ods-open-yellow">{GUIDE_LABEL}</span>
        </div>
        <div className="min-w-0 w-full break-words text-h4 text-ods-text-primary">{children}</div>
      </div>
    )
  }
)

GuideDisplay.displayName = "GuideDisplay"

export { GuideDisplay }
