"use client"

import { cn } from '../../utils'
import { OpenFrameLogo, OpenFrameText } from '../icons'

export interface NavigationSidebarHeaderProps {
  minimized: boolean
}

export function NavigationSidebarHeader({ minimized }: NavigationSidebarHeaderProps) {
  return (
    <div className="flex items-center justify-start h-14 p-[var(--spacing-system-m)] border-b border-ods-border">
      <div className="flex-shrink-0">
        <OpenFrameLogo
          className="w-6 h-6"
          upperPathColor="var(--color-text-primary)"
          lowerPathColor="var(--color-accent-primary)"
        />
      </div>

      <div
        className={cn(
          "flex-1 min-w-0 overflow-hidden transition-[opacity,margin-left] duration-300",
          minimized ? "opacity-0 ml-0" : "opacity-100 ml-[var(--spacing-system-xs)]",
        )}
        aria-hidden={minimized}
      >
        <OpenFrameText textColor="var(--color-text-primary)" />
      </div>
    </div>
  )
}
