'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { OpenFrameWordmark, PoweredByFlamingo } from './auth-branding'

export interface SsoAuthShellProps {
  /** Centered card content (OpenFrame SSO login / sign-up form). */
  children: React.ReactNode
  className?: string
}

/**
 * Centered single-column layout for the OpenFrame SSO (IdP) screens: logo on top,
 * the form card centered, "Powered by Flamingo" at the bottom. No marketing panel.
 */
export function SsoAuthShell({ children, className }: SsoAuthShellProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen w-full flex-col items-center justify-between gap-[var(--spacing-system-xl)] bg-ods-bg p-[var(--spacing-system-xl)]',
        className,
      )}
    >
      <OpenFrameWordmark />
      <div className="flex w-full max-w-[600px] flex-col items-center">{children}</div>
      <PoweredByFlamingo compact />
    </div>
  )
}
