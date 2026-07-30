"use client"

import { cn } from '../../utils'
import { Chevrons03LeftIcon } from '../icons-v2-generated'

export interface NavigationSidebarToggleProps {
  minimized: boolean
  showLabel: boolean
  onToggle: () => void
}

export function NavigationSidebarToggle({
  minimized,
  showLabel,
  onToggle,
}: NavigationSidebarToggleProps) {
 
  return (
    <div className="border-t border-ods-border">
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-start relative",
          "h-14 p-[var(--spacing-system-m)]",
          "transition-colors duration-300",
          "[&_svg]:transition-colors [&_svg]:duration-300",
          "hover:bg-ods-bg-hover text-ods-text-primary",
        )}
        title={minimized ? "Hide Menu" : undefined}
        aria-label={"Hide Menu"}
      >
        <div className="flex items-center justify-center flex-shrink-0">
          {/* Direction comes from CSS (`of-navigation-sidebar-chevron` in
              app-globals.css), not from `minimized`: before hydration that prop
              can only carry the server's answer, and a chevron pointing the
              wrong way in a 56px rail is the one piece of sidebar state a user
              actually notices arriving late. */}
          <Chevrons03LeftIcon className="of-navigation-sidebar-chevron text-ods-text-secondary w-6 h-6 transition-transform duration-300" />
        </div>

        <span
          className={cn(
            "text-h4 flex-1 text-left truncate transition-[opacity,margin-left] duration-300",
            showLabel ? "opacity-100 ml-[var(--spacing-system-xs)]" : "opacity-0 ml-0",
          )}
          aria-hidden={!showLabel}
        >
          Hide Menu
        </span>
      </button>
    </div>
  )
}
