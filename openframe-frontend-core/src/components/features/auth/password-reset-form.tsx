'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { BackToLoginLink } from './back-to-login-link'

export interface PasswordResetFormProps {
  /** Controlled field values */
  password: string
  confirmPassword: string
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  /** Primary submit ("Reset Password") */
  onSubmit: () => void
  /** Secondary action ("Cancel") */
  onCancel: () => void
  /** In-card "Back to Login" shown on tablet/mobile; desktop uses the shell footer. */
  onBackToLogin?: () => void
  /** Disables just the primary submit (fields stay editable). */
  submitDisabled?: boolean
  loading?: boolean
  disabled?: boolean
  errors?: {
    password?: string
    confirmPassword?: string
  }
  title?: string
  subtitle?: string
  newPasswordLabel?: string
  confirmPasswordLabel?: string
  newPasswordPlaceholder?: string
  confirmPasswordPlaceholder?: string
  submitLabel?: string
  cancelLabel?: string
  className?: string
}

/**
 * Password Reset form. Presentational + controlled — the consumer owns state,
 * validation and submission. Covers the empty and filled states from the auth
 * redesign. "Back to Login" is provided by the AuthShell footer (desktop).
 */
export function PasswordResetForm({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onCancel,
  onBackToLogin,
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  title = 'Reset your Password',
  subtitle = 'Enter your new password below',
  newPasswordLabel = 'New Password',
  confirmPasswordLabel = 'Confirm Password',
  newPasswordPlaceholder = 'Enter your Password',
  confirmPasswordPlaceholder = 'Enter your Password',
  submitLabel = 'Reset Password',
  cancelLabel = 'Cancel',
  className,
}: PasswordResetFormProps) {
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

      {/* New password */}
      <Input
        type="password"
        label={newPasswordLabel}
        placeholder={newPasswordPlaceholder}
        value={password}
        error={errors?.password}
        disabled={fieldsDisabled}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Confirm password */}
      <Input
        type="password"
        label={confirmPasswordLabel}
        placeholder={confirmPasswordPlaceholder}
        value={confirmPassword}
        error={errors?.confirmPassword}
        disabled={fieldsDisabled}
        onChange={(event) => onConfirmPasswordChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Actions — Cancel + Reset, side by side on every breakpoint */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        <Button
          type="button"
          variant="outline"
          fullWidth
          className="flex-1"
          disabled={fieldsDisabled}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
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

      {/* Back to Login — in-card on tablet/mobile; desktop shows it in the shell footer */}
      {onBackToLogin && <BackToLoginLink onClick={onBackToLogin} className="self-start lg:hidden" />}
    </div>
  )
}
