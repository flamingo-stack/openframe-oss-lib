'use client'

import * as React from 'react'
import { cn } from '../../../utils/cn'
import { OpenFrameWordmark, PoweredByFlamingo } from './auth-branding'
import { AuthBenefitsPanel } from './auth-benefits-panel'

export interface AuthShellProps {
  /** Tab selector (Sign Up / Login) rendered above the form. */
  tabs?: React.ReactNode
  /** Main form content (Create Organization, Login, …). */
  children: React.ReactNode
  /** Marketing panel. Defaults to <AuthBenefitsPanel />. */
  benefits?: React.ReactNode
  /** Pinned to the bottom-left of the form column on desktop only (e.g. "Back to Login"). */
  footer?: React.ReactNode
  className?: string
}

/**
 * Responsive layout shell for the auth pages. Desktop shows a two-column split
 * (form left, marketing right); tablet and mobile stack into a single centered
 * column (tabs → form → benefits → powered-by). Content is top-aligned. The
 * wordmark appears only in the desktop marketing column — narrow screens go
 * without it (in the native mobile shell a top logo sat under the status bar
 * and was clipped inconsistently across devices).
 *
 * `of-auth-shell` on the root is a stable hook for shell/consumer CSS (the
 * native mobile shell pads it by the top safe-area inset).
 */
export function AuthShell({ tabs, children, benefits, footer, className }: AuthShellProps) {
  const benefitsNode = benefits ?? <AuthBenefitsPanel />

  return (
    <div className={cn('of-auth-shell min-h-screen w-full bg-ods-bg lg:flex lg:h-screen lg:overflow-hidden', className)}>
      {/* Main column — form */}
      <div className="flex min-h-screen w-full flex-col items-center p-[var(--spacing-system-l)] lg:h-full lg:min-h-0 lg:w-1/2 lg:justify-start lg:overflow-y-auto lg:px-[var(--spacing-system-xl)] lg:py-[var(--spacing-system-xxl)]">
        <div
          className={cn(
            'flex w-full max-w-[600px] flex-col items-center gap-[var(--spacing-system-l)]',
            footer && 'lg:min-h-full',
          )}
        >
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
