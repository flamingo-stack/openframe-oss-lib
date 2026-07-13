'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { useDeferredError } from '../../../hooks/ui/use-deferred-error'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { PasswordInput } from '../../ui/password-input'

export interface OpenFrameSsoSignUpFormProps {
  /** Controlled field values */
  email: string
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
  onEmailChange: (value: string) => void
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  /** Primary submit ("Continue") */
  onSubmit: () => void
  onForgotPassword: () => void
  /** Locks the email field, e.g. when it was verified on a previous step. */
  emailReadOnly?: boolean
  submitDisabled?: boolean
  loading?: boolean
  disabled?: boolean
  errors?: {
    email?: string
    firstName?: string
    lastName?: string
    password?: string
    confirmPassword?: string
  }
  title?: string
  subtitle?: string
  emailLabel?: string
  submitLabel?: string
  forgotPasswordLabel?: string
  className?: string
}

/**
 * OpenFrame SSO sign-up form. Presentational + controlled — create OpenFrame SSO
 * credentials (email, name, password).
 */
export function OpenFrameSsoSignUpForm({
  email,
  firstName,
  lastName,
  password,
  confirmPassword,
  onEmailChange,
  onFirstNameChange,
  onLastNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onForgotPassword,
  emailReadOnly = false,
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  title = 'OpenFrame Single Sign-On',
  subtitle = 'Enter your email and password to access your organization.',
  emailLabel = 'Email',
  submitLabel = 'Continue',
  forgotPasswordLabel = 'Forgot Password?',
  className,
}: OpenFrameSsoSignUpFormProps) {
  const fieldsDisabled = disabled || loading

  // Validation messages are deferred while the user is typing (shown on blur or after a pause).
  const emailErr = useDeferredError(errors?.email, email)
  const firstNameErr = useDeferredError(errors?.firstName, firstName)
  const lastNameErr = useDeferredError(errors?.lastName, lastName)
  const passwordErr = useDeferredError(errors?.password, password)
  const confirmErr = useDeferredError(errors?.confirmPassword, confirmPassword)

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
        placeholder="username@mail.com"
        value={email}
        error={emailErr.error}
        disabled={fieldsDisabled || emailReadOnly}
        onBlur={emailErr.onBlur}
        onChange={(event) => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Name + password fields — single column on every breakpoint */}
      <Input
        label="First Name"
        placeholder="Enter First Name"
        value={firstName}
        error={firstNameErr.error}
        disabled={fieldsDisabled}
        onBlur={firstNameErr.onBlur}
        onChange={(event) => onFirstNameChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Input
        label="Last Name"
        placeholder="Enter Last Name"
        value={lastName}
        error={lastNameErr.error}
        disabled={fieldsDisabled}
        onBlur={lastNameErr.onBlur}
        onChange={(event) => onLastNameChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <PasswordInput
        label="Password"
        placeholder="Enter Password"
        value={password}
        error={passwordErr.error}
        disabled={fieldsDisabled}
        onBlur={passwordErr.onBlur}
        onChange={(event) => onPasswordChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <PasswordInput
        label="Confirm Password"
        placeholder="Confirm Password"
        value={confirmPassword}
        error={confirmErr.error}
        disabled={fieldsDisabled}
        onBlur={confirmErr.onBlur}
        onChange={(event) => onConfirmPasswordChange(event.target.value)}
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
