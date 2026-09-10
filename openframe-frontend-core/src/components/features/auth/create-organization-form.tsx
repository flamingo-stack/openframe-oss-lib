'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useDeferredError } from '../../../hooks/ui/use-deferred-error';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/button';
import { CheckboxBlock } from '../../ui/checkbox-block';
import { Input } from '../../ui/input';
import { AccountDetailsFields } from './account-details-fields';
import { LabeledDivider } from './labeled-divider';
import type { AuthSsoProvider } from './sso-providers';
import { SsoProviderButtons } from './sso-providers';
import { TermsAgreementLabel } from './terms-agreement-label';

export interface CreateOrganizationFormProps {
  /**
   * Controlled field values. Omit `email` entirely for flows that neither collect nor show an
   * address — the native Apple signup, where the provider asserted it and may only have handed the
   * app a relay alias the user has never seen. Pass it with `emailReadOnly` to show it uneditable.
   */
  email?: string;
  organizationName: string;
  domain: string;
  agreedToTerms: boolean;
  // Change handlers
  /** Omit together with `email` when the form collects no address. */
  onEmailChange?: (value: string) => void;
  onOrganizationNameChange: (value: string) => void;
  onDomainChange: (value: string) => void;
  onAgreedToTermsChange: (checked: boolean) => void;
  /** Primary submit ("Continue") */
  onSubmit: () => void;
  /**
   * Personal details and credentials, collected on the same screen as the organization. Supply the
   * four handlers to render them; omit them and the form stays organization-only (the SSO paths,
   * where the provider is the credential and there is no password to set).
   */
  firstName?: string;
  lastName?: string;
  password?: string;
  confirmPassword?: string;
  onFirstNameChange?: (value: string) => void;
  onLastNameChange?: (value: string) => void;
  onPasswordChange?: (value: string) => void;
  onConfirmPasswordChange?: (value: string) => void;
  /**
   * Renders the email as a read-only field instead of an input, for flows where the address was
   * fixed by an earlier step and this form cannot change it — a signup that collected it on a
   * previous step, or an SSO login where the provider asserted it and the server reads it from the
   * session. `onEmailChange` is not called in this mode.
   */
  emailReadOnly?: boolean;
  /** Label above the read-only email, e.g. "Signed in with Google". Ignored unless `emailReadOnly`. */
  emailReadOnlyLabel?: string;
  /** Overrides the default heading. */
  title?: string;
  /** Overrides the default sub-heading. */
  subtitle?: ReactNode;
  /** Suffix rendered inside the domain input, e.g. ".openframe.ai" */
  domainSuffix?: string;
  domainPlaceholder?: string;
  termsUrl?: string;
  privacyPolicyUrl?: string;
  submitLabel?: string;
  /**
   * Extra fields, rendered after the account block and before the terms — the same slot
   * CompleteAccountForm offers, for inputs a deployment adds conditionally (a dev-only PR number).
   */
  children?: ReactNode;
  /** Renders a back action beside the submit when supplied (e.g. to return to an earlier step). */
  onBack?: () => void;
  backLabel?: string;
  /** Disables just the primary submit (fields stay editable). */
  submitDisabled?: boolean;
  loading?: boolean;
  disabled?: boolean;
  errors?: {
    email?: string;
    organizationName?: string;
    domain?: string;
    terms?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    confirmPassword?: string;
  };
  /** Informational status under the email field (e.g. live availability). `errors.email` wins. */
  emailStatus?: { message: string; variant: 'error' | 'warning' | 'success' | 'muted' };
  /** Informational status under the domain field (e.g. live availability). `errors.domain` wins. */
  domainStatus?: { message: string; variant: 'error' | 'warning' | 'success' | 'muted' };
  /** Extra content rendered under the domain field, e.g. suggested available domains. */
  domainSlot?: ReactNode;
  /**
   * SSO registration alternatives rendered below the primary submit behind an
   * "or continue with" divider. The form fields stay editable — gate the
   * buttons with `ssoDisabled` (e.g. until the form validates).
   */
  ssoProviders?: AuthSsoProvider[];
  onSsoClick?: (provider: AuthSsoProvider) => void;
  /** Disables the provider buttons (e.g. until the form validates). */
  ssoDisabled?: boolean;
  /** Verb prefix for provider buttons, e.g. "Continue with". */
  ssoActionLabel?: string;
  /** Divider text between the primary submit and the SSO buttons. */
  dividerLabel?: string;
  className?: string;
}

/**
 * Create Organization form (Sign Up tab). Presentational + controlled — the
 * consumer owns state, validation and submission. Covers the empty, filled and
 * SSO states from the auth redesign.
 */
export function CreateOrganizationForm({
  email,
  organizationName,
  domain,
  agreedToTerms,
  onEmailChange,
  onOrganizationNameChange,
  onDomainChange,
  onAgreedToTermsChange,
  onSubmit,
  firstName = '',
  lastName = '',
  password = '',
  confirmPassword = '',
  onFirstNameChange,
  onLastNameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  emailReadOnly = false,
  emailReadOnlyLabel = 'Email',
  title = 'Create Organization',
  subtitle = 'Start your journey with OpenFrame.',
  domainSuffix,
  domainPlaceholder = 'company-name',
  termsUrl = '#',
  privacyPolicyUrl = '#',
  submitLabel = 'Continue',
  children,
  onBack,
  backLabel = 'Back',
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  emailStatus,
  domainStatus,
  domainSlot,
  ssoProviders,
  onSsoClick,
  ssoDisabled = false,
  ssoActionLabel = 'Continue with',
  dividerLabel = 'or continue with',
  className,
}: CreateOrganizationFormProps) {
  const hasSso = !!ssoProviders && ssoProviders.length > 0;
  const fieldsDisabled = disabled || loading;

  // Validation messages are deferred while the user is typing (shown on blur or after a pause).
  const emailErr = useDeferredError(errors?.email, email ?? '');
  const orgNameErr = useDeferredError(errors?.organizationName, organizationName);
  const domainErr = useDeferredError(errors?.domain, domain);
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // `submitDisabled` too, not just `fieldsDisabled`: Enter must be the same gate as the button.
    // The fields stay editable while the form is incomplete, so checking only `fieldsDisabled`
    // let Enter submit a form the button was still refusing.
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
      <div className="flex flex-col">
        <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">{title}</h1>
        <p className="text-ods-text-secondary text-h4">{subtitle}</p>
      </div>

      {/* Email + Organization Name — single column on every breakpoint */}
      {email === undefined ? null : emailReadOnly ? (
        <Input type="email" label={emailReadOnlyLabel} value={email} readOnly disabled />
      ) : (
        <Input
          type="email"
          label="Email"
          placeholder="username@mail.com"
          value={email}
          error={emailErr.error ?? emailStatus?.message}
          errorVariant={emailErr.error ? 'error' : emailStatus?.variant}
          disabled={fieldsDisabled}
          onBlur={emailErr.onBlur}
          onChange={event => onEmailChange?.(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      )}
      <Input
        label="Organization Name"
        placeholder="Your Company Name"
        value={organizationName}
        error={orgNameErr.error}
        disabled={fieldsDisabled}
        onBlur={orgNameErr.onBlur}
        onChange={event => onOrganizationNameChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Domain */}
      <div className="flex flex-col">
        <Input
          label="Domain"
          placeholder={domainPlaceholder}
          value={domain}
          error={domainErr.error ?? domainStatus?.message}
          errorVariant={domainErr.error ? 'error' : domainStatus?.variant}
          disabled={fieldsDisabled}
          onBlur={domainErr.onBlur}
          endAdornment={domainSuffix ? <span className="whitespace-nowrap">{domainSuffix}</span> : undefined}
          onChange={event => onDomainChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {domainSlot && <div className="pt-[var(--spacing-system-s)]">{domainSlot}</div>}
      </div>

      {/* All four handlers or none: the account block is one decision, and checking them here
          rather than through a derived boolean is what lets TypeScript narrow them. */}
      {onFirstNameChange && onLastNameChange && onPasswordChange && onConfirmPasswordChange && (
        <AccountDetailsFields
          layout="paired"
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
      )}

      {children}

      {/* Terms & Privacy — deliberately NOT `truncateLabel`. That prop suits a
          one-line value; this label is a sentence carrying the Terms and Privacy
          Policy links, and ellipsizing it clipped the row to "Agree to Terms &
          Privacy Policy by sig…" below ~500px, so on a phone the user could not
          read what they were agreeing to. Wrapping is the only acceptable
          overflow behaviour for consent copy. */}
      <CheckboxBlock
        id="create-org-terms"
        label={<TermsAgreementLabel termsUrl={termsUrl} privacyPolicyUrl={privacyPolicyUrl} />}
        checked={agreedToTerms}
        disabled={fieldsDisabled}
        error={errors?.terms}
        onCheckedChange={onAgreedToTermsChange}
      />

      {/* Actions — optional back + submit */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        {onBack && (
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

      {/* SSO registration alternatives */}
      {hasSso && (
        <>
          <LabeledDivider label={dividerLabel} />
          <SsoProviderButtons
            providers={ssoProviders}
            onSsoClick={onSsoClick}
            actionLabel={ssoActionLabel}
            disabled={disabled || loading || ssoDisabled}
          />
        </>
      )}
    </div>
  );
}
