'use client';

import type { KeyboardEvent } from 'react';
import { useDeferredError } from '../../../hooks/ui/use-deferred-error';
import { Input } from '../../ui/input';
import { PasswordInput } from '../../ui/password-input';

export interface AccountDetailsFieldsProps {
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  errors?: {
    firstName?: string;
    lastName?: string;
    password?: string;
    confirmPassword?: string;
  };
  disabled?: boolean;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  /**
   * `paired` puts the two names on one row and the two passwords on another; `stacked` gives each
   * field its own row. Paired is unconditional, with no breakpoint — the approved design pairs
   * them at ~514px and Tailwind's `sm` is 640px, which would stack them on every phone.
   */
  layout?: 'stacked' | 'paired';
}

/**
 * The name-and-password block every account-creating form collects.
 *
 * Shared so the four fields cannot drift apart across the forms that render them — they already
 * had, with one copy wiring `useDeferredError` for blur and another not, so the same field
 * surfaced its error at a different moment depending on which screen you reached it from.
 */
export function AccountDetailsFields({
  firstName,
  lastName,
  password,
  confirmPassword,
  onFirstNameChange,
  onLastNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  errors,
  disabled = false,
  onKeyDown,
  layout = 'stacked',
}: AccountDetailsFieldsProps) {
  const firstNameErr = useDeferredError(errors?.firstName, firstName);
  const lastNameErr = useDeferredError(errors?.lastName, lastName);
  const passwordErr = useDeferredError(errors?.password, password);
  const confirmErr = useDeferredError(errors?.confirmPassword, confirmPassword);

  const names = [
    <Input
      key="firstName"
      label="First Name"
      placeholder="Enter First Name"
      value={firstName}
      error={firstNameErr.error}
      disabled={disabled}
      onBlur={firstNameErr.onBlur}
      onChange={event => onFirstNameChange(event.target.value)}
      onKeyDown={onKeyDown}
    />,
    <Input
      key="lastName"
      label="Last Name"
      placeholder="Enter Last Name"
      value={lastName}
      error={lastNameErr.error}
      disabled={disabled}
      onBlur={lastNameErr.onBlur}
      onChange={event => onLastNameChange(event.target.value)}
      onKeyDown={onKeyDown}
    />,
  ];

  const passwords = [
    <PasswordInput
      key="password"
      label="Password"
      placeholder="Enter Password"
      value={password}
      error={passwordErr.error}
      disabled={disabled}
      onBlur={passwordErr.onBlur}
      onChange={event => onPasswordChange(event.target.value)}
      onKeyDown={onKeyDown}
    />,
    <PasswordInput
      key="confirmPassword"
      label="Confirm Password"
      placeholder="Confirm Password"
      value={confirmPassword}
      error={confirmErr.error}
      disabled={disabled}
      onBlur={confirmErr.onBlur}
      onChange={event => onConfirmPasswordChange(event.target.value)}
      onKeyDown={onKeyDown}
    />,
  ];

  if (layout === 'stacked') {
    return (
      <>
        {names}
        {passwords}
      </>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-[var(--spacing-system-l)]">{names}</div>
      <div className="grid grid-cols-2 gap-[var(--spacing-system-l)]">{passwords}</div>
    </>
  );
}
