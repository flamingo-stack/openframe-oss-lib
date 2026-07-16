'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { useDeferredError } from '../../../hooks/ui/use-deferred-error'
import { Input } from '../../ui/input'
import type { AuthSsoProvider } from './sso-providers'
import { SsoProviderButtons } from './sso-providers'

export interface LoginFormProps {
  /** Controlled email value */
  email: string
  onEmailChange: (value: string) => void
  /** Enter-key handler on the email field (optional). */
  onSubmit?: () => void
  emailPlaceholder?: string
  loading?: boolean
  disabled?: boolean
  errors?: {
    email?: string
  }
  /** Informational status under the email field (e.g. live tenant discovery). `errors.email` wins. */
  emailStatus?: { message: string; variant: 'error' | 'warning' | 'success' | 'muted' }
  /**
   * SSO providers rendered below the email field. Always visible; gate
   * clickability with `ssoDisabled` / `ssoEnabledProviders`.
   */
  ssoProviders: AuthSsoProvider[]
  onSsoClick?: (provider: AuthSsoProvider) => void
  /** Disables every provider button (e.g. until the email passes discovery). */
  ssoDisabled?: boolean
  /** When set, only these providers are clickable; the rest stay disabled. */
  ssoEnabledProviders?: AuthSsoProvider[]
  /** Verb prefix for provider buttons, e.g. "Continue with". Ignored for "openframe". */
  ssoActionLabel?: string
  className?: string
}

/**
 * Login form (Login tab). Presentational + controlled — the consumer owns
 * state, validation and discovery. Single-screen design: the email field and
 * the SSO provider buttons are always visible; the buttons unlock once the
 * consumer validates the email (real-time tenant discovery).
 */
export function LoginForm({
  email,
  onEmailChange,
  onSubmit,
  emailPlaceholder = 'username@mail.com',
  loading = false,
  disabled = false,
  errors,
  emailStatus,
  ssoProviders,
  onSsoClick,
  ssoDisabled = false,
  ssoEnabledProviders,
  ssoActionLabel = 'Continue with',
  className,
}: LoginFormProps) {
  const fieldDisabled = disabled || loading

  // Validation messages are deferred while the user is typing (shown on blur or after a pause).
  const emailErr = useDeferredError(errors?.email, email)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !fieldDisabled) {
      onSubmit?.()
    }
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-col">
        <h1 className="text-h2 text-ods-text-primary tracking-[-0.64px]">Login to OpenFrame</h1>
        <p className="text-h4 text-ods-text-secondary">Enter your email to access your organization.</p>
      </div>

      {/* Email */}
      <Input
        type="email"
        label="Email"
        placeholder={emailPlaceholder}
        value={email}
        error={emailErr.error ?? emailStatus?.message}
        errorVariant={emailErr.error ? 'error' : emailStatus?.variant}
        disabled={fieldDisabled}
        onBlur={emailErr.onBlur}
        onChange={(event) => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* SSO providers — always visible, unlocked by the consumer */}
      <SsoProviderButtons
        providers={ssoProviders}
        onSsoClick={onSsoClick}
        actionLabel={ssoActionLabel}
        disabled={disabled || loading || ssoDisabled}
        enabledProviders={ssoEnabledProviders}
      />
    </div>
  )
}
