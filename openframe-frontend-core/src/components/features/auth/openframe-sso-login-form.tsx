'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { PasswordInput } from '../../ui/password-input'

export interface OpenFrameSsoLoginFormProps {
  /** Controlled field values */
  email: string
  password: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  /** Primary submit ("Continue") */
  onSubmit: () => void
  onForgotPassword: () => void
  submitDisabled?: boolean
  loading?: boolean
  disabled?: boolean
  errors?: {
    email?: string
    password?: string
  }
  title?: string
  subtitle?: string
  emailLabel?: string
  passwordLabel?: string
  emailPlaceholder?: string
  passwordPlaceholder?: string
  forgotPasswordLabel?: string
  submitLabel?: string
  className?: string
}

/**
 * OpenFrame SSO login form. Presentational + controlled — email + password to
 * sign in via OpenFrame's own SSO. Rendered inside SsoAuthShell.
 */
export function OpenFrameSsoLoginForm({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  title = 'OpenFrame Single Sign-On',
  subtitle = 'Enter your email and password to access your organization.',
  emailLabel = 'Email',
  passwordLabel = 'Password',
  emailPlaceholder = 'username@mail.com',
  passwordPlaceholder = 'Enter Your Password',
  forgotPasswordLabel = 'Forgot Password?',
  submitLabel = 'Continue',
  className,
}: OpenFrameSsoLoginFormProps) {
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
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <h1 className="text-h2 text-ods-text-primary tracking-[-0.64px]">{title}</h1>
        <p className="text-h4 text-ods-text-secondary">{subtitle}</p>
      </div>

      <Input
        type="email"
        label={emailLabel}
        placeholder={emailPlaceholder}
        value={email}
        error={errors?.email}
        disabled={fieldsDisabled}
        onChange={(event) => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <PasswordInput
        label={passwordLabel}
        placeholder={passwordPlaceholder}
        value={password}
        error={errors?.password}
        disabled={fieldsDisabled}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Forgot password + Continue */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        <Button
          type="button"
          variant="transparent"
          fullWidth
          className="flex-1"
          disabled={fieldsDisabled}
          onClick={onForgotPassword}
        >
          {forgotPasswordLabel}
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
    </div>
  )
}
