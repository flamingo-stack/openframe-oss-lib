'use client'

import { cn } from '../../../utils/cn'
import { XmarkIcon } from '../../icons-v2-generated/signs-and-symbols/xmark-icon'
import { Button } from '../../ui/button'

export interface InviteLinkInvalidModalProps {
  onBackToLogin: () => void
  /** Dismiss (X). Defaults to onBackToLogin. */
  onClose?: () => void
  title?: string
  description?: string
  backLabel?: string
  className?: string
}

/**
 * Centered notice shown when an invitation link is expired or invalid. Full-screen
 * dark backdrop with a single card; both the X and the button return to login.
 */
export function InviteLinkInvalidModal({
  onBackToLogin,
  onClose,
  title = 'Invite link not valid',
  description = 'This invitation link has expired or is no longer valid. Contact your administrator for a new invitation.',
  backLabel = 'Back to Login',
  className,
}: InviteLinkInvalidModalProps) {
  return (
    <div className={cn('flex min-h-screen w-full items-center justify-center bg-ods-bg p-[var(--spacing-system-l)]', className)}>
      <div className="flex w-full max-w-[600px] flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
        {/* Title + close */}
        <div className="flex items-center gap-[var(--spacing-system-mf)]">
          <h1 className="flex-1 text-h2 text-ods-text-primary tracking-[-0.64px]">{title}</h1>
          <button type="button" aria-label="Close" onClick={onClose ?? onBackToLogin} className="shrink-0 text-ods-text-primary">
            <XmarkIcon className="h-6 w-6" />
          </button>
        </div>

        <p className="text-h4 text-ods-text-primary">{description}</p>

        {/* Action — right half, matching the design */}
        <div className="flex items-center gap-[var(--spacing-system-l)]">
          <div className="hidden flex-1 md:block" />
          <Button type="button" variant="accent" fullWidth className="md:flex-1" onClick={onBackToLogin}>
            {backLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
