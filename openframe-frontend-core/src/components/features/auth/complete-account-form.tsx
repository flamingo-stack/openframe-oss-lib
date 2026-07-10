'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { PasswordInput } from '../../ui/password-input'
import type { AuthSsoProvider } from './sso-providers'
import { SsoProviderButtons } from './sso-providers'

export interface CompleteAccountFormProps {
  /** Controlled field values */
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  /** Primary submit ("Start Free Trial") */
  onSubmit: () => void
  /** Secondary action rendered left of the submit (e.g. "Back to Organization"). */
  onBack?: () => void
  /** SSO alternatives offered above the fields ("Continue with …"). */
  ssoProviders?: AuthSsoProvider[]
  onSsoClick?: (provider: AuthSsoProvider) => void
  title?: string
  subtitle?: string
  dividerLabel?: string
  submitLabel?: string
  backLabel?: string
  ssoActionLabel?: string
  submitDisabled?: boolean
  loading?: boolean
  disabled?: boolean
  errors?: {
    firstName?: string
    lastName?: string
    password?: string
    confirmPassword?: string
  }
  className?: string
}

/**
 * Account details form shared by the Sign Up ("Complete your Account") and
 * Accept Invitation screens. Presentational + controlled — SSO shortcuts on
 * top, then name + password fields ("or create account").
 */
export function CompleteAccountForm({
  firstName,
  lastName,
  password,
  confirmPassword,
  onFirstNameChange,
  onLastNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onBack,
  ssoProviders,
  onSsoClick,
  title = 'Complete your Account',
  subtitle = 'Fill in the details below to get started',
  dividerLabel = 'or create account',
  submitLabel = 'Start Free Trial',
  backLabel = 'Back to Organization',
  ssoActionLabel = 'Continue with',
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  className,
}: CompleteAccountFormProps) {
  const fieldsDisabled = disabled || loading

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !fieldsDisabled && !submitDisabled) {
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
        <h1 className="text-h2 text-ods-text-primary tracking-[-0.64px]">{title}</h1>
        <p className="text-h4 text-ods-text-secondary">{subtitle}</p>
      </div>

      {/* SSO shortcuts + divider */}
      {ssoProviders && ssoProviders.length > 0 && (
        <>
          <SsoProviderButtons
            providers={ssoProviders}
            onSsoClick={onSsoClick}
            actionLabel={ssoActionLabel}
            disabled={fieldsDisabled}
          />
          <div className="flex items-center gap-[var(--spacing-system-s)]">
            <div className="h-px flex-1 bg-ods-border" />
            <span className="text-h6 text-ods-text-secondary">{dividerLabel}</span>
            <div className="h-px flex-1 bg-ods-border" />
          </div>
        </>
      )}

      {/* Name + password fields — single column on every breakpoint */}
      <Input
        label="First Name"
        placeholder="Enter First Name"
        value={firstName}
        error={errors?.firstName}
        disabled={fieldsDisabled}
        onChange={(event) => onFirstNameChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Input
        label="Last Name"
        placeholder="Enter Last Name"
        value={lastName}
        error={errors?.lastName}
        disabled={fieldsDisabled}
        onChange={(event) => onLastNameChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <PasswordInput
        label="Password"
        placeholder="Enter Password"
        value={password}
        error={errors?.password}
        disabled={fieldsDisabled}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <PasswordInput
        label="Confirm Password"
        placeholder="Confirm Password"
        value={confirmPassword}
        error={errors?.confirmPassword}
        disabled={fieldsDisabled}
        onChange={(event) => onConfirmPasswordChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Actions — optional back + submit */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        {onBack ? (
          <Button
            type="button"
            variant="transparent"
            fullWidth
            className="flex-1"
            disabled={fieldsDisabled}
            onClick={onBack}
          >
            {backLabel}
          </Button>
        ) : (
          // Spacer keeps the button on the right half, matching the design
          <div className="flex-1" />
        )}
        <Button
          type="button"
          variant="accent"
          fullWidth
          className="flex-1"
          loading={loading}
          disabled={disabled || submitDisabled}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}
