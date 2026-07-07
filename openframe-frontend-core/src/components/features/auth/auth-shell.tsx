'use client'

import * as React from 'react'
import { cn } from '../../../utils/cn'
import { OpenFrameLogo } from '../../icons'
import { FlamingoLogoIcon } from '../../icons-v2-generated/logos/flamingo-logo-icon'
import { AuthBenefitsPanel } from './auth-benefits-panel'

export interface AuthShellProps {
  /** Tab selector (Sign Up / Login) rendered above the form. */
  tabs?: React.ReactNode
  /** Main form content (Create Organization, Login, …). */
  children: React.ReactNode
  /** Marketing panel. Defaults to <AuthBenefitsPanel />. */
  benefits?: React.ReactNode
  /** Tagline shown under the logo on mobile only. */
  mobileTagline?: React.ReactNode
  /** Pinned to the bottom-left of the form column on desktop only (e.g. "Back to Login"). */
  footer?: React.ReactNode
  className?: string
}

function OpenFrameWordmark() {
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

function PoweredByFlamingo() {
  return (
    <div className="flex items-center gap-[var(--spacing-system-xs)] text-ods-text-secondary">
      <span className="text-h6">Powered by</span>
      {/* logo is 416×120 (≈3.47:1) — set explicit w/h so it isn't squashed to a square.
          Mobile uses the smaller 56×16; tablet & desktop share 83×24. */}
      <FlamingoLogoIcon className="h-4 w-14 md:h-6 md:w-[83px]" />
    </div>
  )
}

/**
 * Responsive layout shell for the auth pages. Desktop shows a two-column split
 * (form left, marketing right); tablet and mobile stack into a single centered
 * column (logo → tabs → form → benefits → powered-by). Content is top-aligned.
 */
export function AuthShell({ tabs, children, benefits, mobileTagline, footer, className }: AuthShellProps) {
  const benefitsNode = benefits ?? <AuthBenefitsPanel />

  return (
    <div className={cn('min-h-screen w-full bg-ods-bg lg:flex lg:h-screen lg:overflow-hidden', className)}>
      {/* Main column — form */}
      <div className="flex min-h-screen w-full flex-col items-center p-[var(--spacing-system-l)] lg:h-full lg:min-h-0 lg:w-1/2 lg:justify-start lg:overflow-y-auto lg:px-[var(--spacing-system-xl)] lg:py-[var(--spacing-system-xxl)]">
        <div
          className={cn(
            'flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-l)]',
            footer && 'lg:min-h-full',
          )}
        >
          {/* Logo + tagline — narrow screens only (desktop shows the logo in the right column) */}
          <div className="flex w-full flex-col items-center gap-[var(--spacing-system-l)] lg:hidden">
            <OpenFrameWordmark />
            {/* Tagline is mobile-only; tablet & desktop hide it. Each line stays on one
                line and truncates with an ellipsis if it overflows (per the mockup). */}
            {mobileTagline && (
              <div className="w-full text-center text-h4 text-ods-text-primary [&>p]:truncate md:hidden">
                {mobileTagline}
              </div>
            )}
          </div>

          {/* Full width on mobile; fixed 320px from tablet up (matches desktop) */}
          {tabs && <div className="w-full md:max-w-[320px]">{tabs}</div>}
          <div className="w-full">{children}</div>

          {/* Benefits + powered-by — narrow screens only */}
          <div className="flex w-full flex-col items-center gap-[var(--spacing-system-l)] lg:hidden">
            {benefitsNode}
            <PoweredByFlamingo />
          </div>

          {/* Footer — pinned to the bottom-left of the column on desktop only */}
          {footer && <div className="hidden w-full self-start lg:mt-auto lg:block">{footer}</div>}
        </div>
      </div>

      {/* Marketing column — desktop only */}
      <div className="hidden border-l border-ods-border bg-ods-card lg:flex lg:h-full lg:w-1/2 lg:flex-col lg:items-center lg:justify-start lg:gap-[var(--spacing-system-xxl)] lg:overflow-y-auto lg:px-[var(--spacing-system-xl)] lg:py-[var(--spacing-system-xxl)]">
        <OpenFrameWordmark />
        <div className="w-full max-w-lg">{benefitsNode}</div>
        <PoweredByFlamingo />
      </div>
    </div>
  )
}
