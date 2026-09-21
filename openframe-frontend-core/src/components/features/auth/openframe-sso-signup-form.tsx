'use client';

import type { KeyboardEvent } from 'react';
import { useDeferredError } from '../../../hooks/ui/use-deferred-error';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { AccountDetailsFields } from './account-details-fields';

export interface OpenFrameSsoSignUpFormProps {
  /** Controlled field values */
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  onEmailChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  /** Primary submit ("Continue") */
  onSubmit: () => void;
  onForgotPassword: () => void;
  /** Locks the email field, e.g. when it was verified on a previous step. */
  emailReadOnly?: boolean;
  submitDisabled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  errors?: {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    confirmPassword?: string;
  };
  title?: string;
  subtitle?: string;
  emailLabel?: string;
  submitLabel?: string;
  forgotPasswordLabel?: string;
  className?: string;
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
  const fieldsDisabled = disabled || loading;

  // Validation messages are deferred while the user is typing (shown on blur or after a pause).
  const emailErr = useDeferredError(errors?.email, email);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !fieldsDisabled && !submitDisabled) {
      onSubmit();
    }
  };

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-col gap-[var(--spacing-system-xs)]">
        <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">{title}</h1>
        <p className="text-ods-text-secondary text-h4">{subtitle}</p>
      </div>

      <Input
        type="email"
        label={emailLabel}
        placeholder="username@mail.com"
        value={email}
        error={emailErr.error}
        disabled={fieldsDisabled || emailReadOnly}
        onBlur={emailErr.onBlur}
        onChange={event => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      <AccountDetailsFields
        firstName={firstName}
        lastName={lastName}
        password={password}
        confirmPassword={confirmPassword}
        onFirstNameChange={onFirstNameChange}
        onLastNameChange={onLastNameChange}
        onPasswordChange={onPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
        errors={errors}
        disabled={fieldsDisabled}
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
  );
}
