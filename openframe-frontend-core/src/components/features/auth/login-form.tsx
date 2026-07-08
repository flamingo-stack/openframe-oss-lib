'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import type { AuthSsoProvider } from './sso-providers'
import { SsoProviderButtons } from './sso-providers'

export interface LoginFormProps {
  /** Controlled email value */
  email: string
  onEmailChange: (value: string) => void
  /** Primary submit ("Continue") */
  onSubmit: () => void
  emailPlaceholder?: string
  submitLabel?: string
  /** Disables just the primary submit (field stays editable). */
  submitDisabled?: boolean
  loading?: boolean
  disabled?: boolean
  errors?: {
    email?: string
  }
  /**
   * SSO providers to offer. When non-empty the form switches to SSO mode:
   * the primary submit is replaced by a stack of provider buttons.
   */
  ssoProviders?: AuthSsoProvider[]
  onSsoClick?: (provider: AuthSsoProvider) => void
  /** Verb prefix for provider buttons, e.g. "Sign Up with". Ignored for "openframe". */
  ssoActionLabel?: string
  className?: string
}

/**
 * Login form (Login tab). Presentational + controlled — the consumer owns
 * state, validation and submission. Covers the empty and SSO states from the
 * auth redesign: enter an email, then Continue or pick an SSO provider.
 */
export function LoginForm({
  email,
  onEmailChange,
  onSubmit,
  emailPlaceholder = 'username@mail.com',
  submitLabel = 'Continue',
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  ssoProviders,
  onSsoClick,
  ssoActionLabel = 'Sign Up with',
  className,
}: LoginFormProps) {
  const isSsoMode = !!ssoProviders && ssoProviders.length > 0
  const fieldDisabled = disabled || loading || isSsoMode

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !fieldDisabled) {
      onSubmit()
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
        error={errors?.email}
        disabled={fieldDisabled}
        onChange={(event) => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Actions */}
      {isSsoMode ? (
        <SsoProviderButtons
          providers={ssoProviders!}
          onSsoClick={onSsoClick}
          actionLabel={ssoActionLabel}
          disabled={disabled || loading}
        />
      ) : (
        <div className="flex items-center gap-[var(--spacing-system-l)]">
          {/* Spacer keeps the button on the right half, matching the design */}
          <div className="hidden flex-1 md:block" />
          <Button
            type="button"
            variant="accent"
            fullWidth
            className="md:flex-1"
            loading={loading}
            disabled={disabled || submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  )
}
