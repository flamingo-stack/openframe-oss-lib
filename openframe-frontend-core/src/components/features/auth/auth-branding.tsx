'use client'

import { OpenFrameLogo } from '../../icons'
import { FlamingoLogoIcon } from '../../icons-v2-generated/logos/flamingo-logo-icon'

/** OpenFrame logo + wordmark, shown at the top of the auth screens. */
export function OpenFrameWordmark() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)]">
      <OpenFrameLogo
        className="h-10 w-10"
        lowerPathColor="var(--color-accent-primary)"
        upperPathColor="var(--color-text-primary)"
      />
      <span className="text-h2 text-ods-text-primary tracking-[-0.64px]">OpenFrame</span>
    </div>
  )
}

export interface PoweredByFlamingoProps {
  /** Keep the small 56×16 logo at every breakpoint (default grows to 83×24 from tablet up). */
  compact?: boolean
}

/** "Powered by Flamingo" footer mark. */
export function PoweredByFlamingo({ compact = false }: PoweredByFlamingoProps) {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)] text-ods-text-secondary">
      <span className="text-h6">Powered by</span>
      {/* logo is 416×120 (≈3.47:1) — set explicit w/h so it isn't squashed to a square. */}
      <FlamingoLogoIcon className={compact ? 'h-4 w-14' : 'h-4 w-14 md:h-6 md:w-[83px]'} />
    </div>
  )
}
