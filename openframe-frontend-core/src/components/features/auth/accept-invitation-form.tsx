'use client'

import { cn } from '../../../utils/cn'
import { Input } from '../../ui/input'
import { BackToLoginLink } from './back-to-login-link'
import type { AuthSsoProvider } from './sso-providers'
import { SsoProviderButtons } from './sso-providers'

export interface AcceptInvitationFormProps {
  /** Invited email — shown read-only (prefilled from the invitation link). */
  email: string
  /** SSO providers offered to accept the invitation. */
  ssoProviders: AuthSsoProvider[]
  onSsoClick: (provider: AuthSsoProvider) => void
  onBackToLogin: () => void
  /** Verb prefix for provider buttons, e.g. "Sign Up with". Ignored for "openframe". */
  ssoActionLabel?: string
  emailLabel?: string
  title?: string
  subtitle?: string
  loading?: boolean
  disabled?: boolean
  className?: string
}

/**
 * Accept Invitation form. Presentational + controlled — the invited email is
 * read-only; the user picks an SSO provider to join the organization.
 */
export function AcceptInvitationForm({
  email,
  ssoProviders,
  onSsoClick,
  onBackToLogin,
  ssoActionLabel = 'Sign Up with',
  emailLabel = 'Email',
  title = 'Accept Invitation',
  subtitle = 'Complete your registration to join the organization',
  loading = false,
  disabled = false,
  className,
}: AcceptInvitationFormProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-col">
        <h1 className="text-h2 text-ods-text-primary tracking-[-0.64px]">{title}</h1>
        <p className="text-h4 text-ods-text-secondary">{subtitle}</p>
      </div>

      {/* Invited email — read-only */}
      <Input type="email" label={emailLabel} value={email} disabled readOnly />

      {/* SSO providers */}
      <SsoProviderButtons
        providers={ssoProviders}
        onSsoClick={onSsoClick}
        actionLabel={ssoActionLabel}
        disabled={disabled || loading}
      />

      {/* Back to Login — in-card on tablet/mobile; desktop shows it in the shell footer */}
      <BackToLoginLink onClick={onBackToLogin} className="self-start lg:hidden" />
    </div>
  )
}
