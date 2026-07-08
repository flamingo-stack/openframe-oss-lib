'use client'

import type * as React from 'react'
import { cn } from '../../../utils/cn'
import { Button } from '../../ui/button'
import { CheckboxBlock } from '../../ui/checkbox-block'
import { Input } from '../../ui/input'
import { PasswordInput } from '../../ui/password-input'
import { TermsAgreementLabel } from './terms-agreement-label'

export interface OpenFrameSsoSignUpFormProps {
  /** Controlled field values */
  email: string
  firstName: string
  lastName: string
  password: string
  confirmPassword: string
  agreedToTerms: boolean
  onEmailChange: (value: string) => void
  onFirstNameChange: (value: string) => void
  onLastNameChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onAgreedToTermsChange: (checked: boolean) => void
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
    terms?: string
  }
  termsUrl?: string
  privacyPolicyUrl?: string
  title?: string
  subtitle?: string
  emailLabel?: string
  submitLabel?: string
  forgotPasswordLabel?: string
  className?: string
}

/**
 * OpenFrame SSO sign-up form. Presentational + controlled — create OpenFrame SSO
 * credentials (email, name, password) with a Terms gate. Rendered inside SsoAuthShell.
 */
export function OpenFrameSsoSignUpForm({
  email,
  firstName,
  lastName,
  password,
  confirmPassword,
  agreedToTerms,
  onEmailChange,
  onFirstNameChange,
  onLastNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onAgreedToTermsChange,
  onSubmit,
  onForgotPassword,
  emailReadOnly = false,
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  termsUrl = '#',
  privacyPolicyUrl = '#',
  title = 'OpenFrame Single Sign-On',
  subtitle = 'Enter your email and password to access your organization.',
  emailLabel = 'Email',
  submitLabel = 'Continue',
  forgotPasswordLabel = 'Forgot Password?',
  className,
}: OpenFrameSsoSignUpFormProps) {
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
        placeholder="username@mail.com"
        value={email}
        error={errors?.email}
        disabled={fieldsDisabled || emailReadOnly}
        readOnly={emailReadOnly}
        onChange={(event) => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* First + Last name */}
      <div className="flex gap-[var(--spacing-system-l)]">
        <div className="min-w-0 flex-1">
          <Input
            label="First Name"
            placeholder="Enter First Name"
            value={firstName}
            error={errors?.firstName}
            disabled={fieldsDisabled}
            onChange={(event) => onFirstNameChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Input
            label="Last Name"
            placeholder="Enter Last Name"
            value={lastName}
            error={errors?.lastName}
            disabled={fieldsDisabled}
            onChange={(event) => onLastNameChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {/* Password + Confirm */}
      <div className="flex gap-[var(--spacing-system-l)]">
        <div className="min-w-0 flex-1">
          <PasswordInput
            label="Password"
            placeholder="Enter Password"
            value={password}
            error={errors?.password}
            disabled={fieldsDisabled}
            onChange={(event) => onPasswordChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="min-w-0 flex-1">
          <PasswordInput
            label="Confirm Password"
            placeholder="Confirm Password"
            value={confirmPassword}
            error={errors?.confirmPassword}
            disabled={fieldsDisabled}
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {/* Terms & Privacy gate */}
      <CheckboxBlock
        id="sso-signup-terms"
        label={<TermsAgreementLabel termsUrl={termsUrl} privacyPolicyUrl={privacyPolicyUrl} />}
        truncateLabel
        checked={agreedToTerms}
        disabled={fieldsDisabled}
        error={errors?.terms}
        onCheckedChange={onAgreedToTermsChange}
      />

      {/* Forgot password + Continue */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        <button
          type="button"
          onClick={onForgotPassword}
          className="flex-1 text-left text-h4 text-ods-text-secondary"
        >
          {forgotPasswordLabel}
        </button>
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
