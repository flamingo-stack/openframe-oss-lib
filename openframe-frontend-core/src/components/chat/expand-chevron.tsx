"use client"

import { cn } from "../../utils/cn"
import { Chevron02DownIcon } from "../icons-v2-generated"

interface ExpandChevronProps {
  expanded: boolean
  className?: string
}

export function ExpandChevron({ expanded, className }: ExpandChevronProps) {
  return (
    <Chevron02DownIcon
      className={cn(
        "w-4 h-4 text-ods-text-secondary shrink-0 transition-transform duration-200",
        expanded && "rotate-180",
        className
      )}
    />
  )
}
