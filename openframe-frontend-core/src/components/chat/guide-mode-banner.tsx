'use client'

import * as React from 'react'
import { cn } from '../../utils/cn'
import { CompassIcon } from '../icons-v2-generated/map-and-travel/compass-icon'
import { QuestionCircleIcon } from '../icons-v2-generated/signs-and-symbols/question-circle-icon'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip'

const DEFAULT_LABEL = 'Guide Mode Chat'

const DEFAULT_TOOLTIP =
  'A quick session chat for exploring OpenFrame. Mingo answers how-to ' +
  'questions and guides you through configuration, but won’t touch devices, ' +
  'run scripts, or perform any actions.'

export interface GuideModeBannerProps {
  /** Banner label (uppercased by the `text-h5` style). */
  label?: React.ReactNode
  /** Help-icon tooltip copy. `null` hides the help icon entirely. */
  tooltip?: React.ReactNode | null
  className?: string
}

/**
 * Guide-mode indicator banner — Figma node `7532:328222`. A full-bleed accent
 * (yellow) strip below the chat header: leading compass icon, the "Guide Mode
 * Chat" label, and a trailing help icon whose tooltip explains the temporary,
 * read-only nature of Guide mode.
 */
export function GuideModeBanner({
  label = DEFAULT_LABEL,
  tooltip = DEFAULT_TOOLTIP,
  className,
}: GuideModeBannerProps) {
  return (
    <div
      className={cn(
        'flex h-8 w-full shrink-0 items-center gap-[var(--spacing-system-xs)] bg-ods-accent px-[var(--spacing-system-m)] py-[var(--spacing-system-xsf)]',
        className,
      )}
    >
      <CompassIcon size={16} className="shrink-0 text-ods-text-on-accent" />
      <p className="flex-1 truncate text-h5 uppercase text-ods-text-on-accent">
        {label}
      </p>
      {tooltip != null && (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="About Guide Mode"
                className="shrink-0 rounded-sm text-ods-text-on-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ods-text-on-accent"
              >
                <QuestionCircleIcon size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="end"
              className="max-w-[280px] text-h6 normal-case"
            >
              {tooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
