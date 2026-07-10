'use client'

import * as React from 'react'
import { cn } from '../../../utils/cn'
import { useDeferredError } from '../../../hooks/ui/use-deferred-error'
import { Button } from '../../ui/button'
import { CheckboxBlock } from '../../ui/checkbox-block'
import { Input } from '../../ui/input'
import type { AuthSsoProvider } from './sso-providers'
import { SsoProviderButtons } from './sso-providers'
import { TermsAgreementLabel } from './terms-agreement-label'

export interface CreateOrganizationFormProps {
  /** Controlled field values */
  email: string
  organizationName: string
  domain: string
  agreedToTerms: boolean
  /** Change handlers */
  onEmailChange: (value: string) => void
  onOrganizationNameChange: (value: string) => void
  onDomainChange: (value: string) => void
  onAgreedToTermsChange: (checked: boolean) => void
  /** Primary submit ("Continue") */
  onSubmit: () => void
  /** Suffix rendered inside the domain input, e.g. ".openframe.ai" */
  domainSuffix?: string
  domainPlaceholder?: string
  termsUrl?: string
  privacyPolicyUrl?: string
  submitLabel?: string
  /** Disables just the primary submit (fields stay editable). */
  submitDisabled?: boolean
  loading?: boolean
  disabled?: boolean
  errors?: {
    email?: string
    organizationName?: string
    domain?: string
    terms?: string
  }
  /** Informational status under the email field (e.g. live availability). `errors.email` wins. */
  emailStatus?: { message: string; variant: 'error' | 'warning' | 'success' | 'muted' }
  /** Informational status under the domain field (e.g. live availability). `errors.domain` wins. */
  domainStatus?: { message: string; variant: 'error' | 'warning' | 'success' | 'muted' }
  /** Extra content rendered under the domain field, e.g. suggested available domains. */
  domainSlot?: React.ReactNode
  /**
   * SSO providers to offer. When non-empty the form switches to SSO mode:
   * fields and the terms checkbox are disabled and the primary submit is
   * replaced by a stack of provider buttons.
   */
  ssoProviders?: AuthSsoProvider[]
  onSsoClick?: (provider: AuthSsoProvider) => void
  /** Verb prefix for provider buttons, e.g. "Continue with". Ignored for "openframe". */
  ssoActionLabel?: string
  className?: string
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
  domainSuffix,
  domainPlaceholder = 'company-name',
  termsUrl = '#',
  privacyPolicyUrl = '#',
  submitLabel = 'Continue',
  submitDisabled = false,
  loading = false,
  disabled = false,
  errors,
  emailStatus,
  domainStatus,
  domainSlot,
  ssoProviders,
  onSsoClick,
  ssoActionLabel = 'Continue with',
  className,
}: CreateOrganizationFormProps) {
  const isSsoMode = !!ssoProviders && ssoProviders.length > 0
  const fieldsDisabled = disabled || loading || isSsoMode

  // Validation messages are deferred while the user is typing (shown on blur or after a pause).
  const emailErr = useDeferredError(errors?.email, email)
  const orgNameErr = useDeferredError(errors?.organizationName, organizationName)
  const domainErr = useDeferredError(errors?.domain, domain)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !fieldsDisabled) {
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
        <h1 className="text-h2 text-ods-text-primary tracking-[-0.64px]">Create Organization</h1>
        <p className="text-h4 text-ods-text-secondary">Start your journey with OpenFrame.</p>
      </div>

      {/* Email + Organization Name — single column on every breakpoint */}
      <Input
        type="email"
        label="Email"
        placeholder="username@mail.com"
        value={email}
        error={emailErr.error ?? emailStatus?.message}
        errorVariant={emailErr.error ? 'error' : emailStatus?.variant}
        disabled={fieldsDisabled}
        onBlur={emailErr.onBlur}
        onChange={(event) => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <Input
        label="Organization Name"
        placeholder="Your Company Name"
        value={organizationName}
        error={orgNameErr.error}
        disabled={fieldsDisabled}
        onBlur={orgNameErr.onBlur}
        onChange={(event) => onOrganizationNameChange(event.target.value)}
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
          onChange={(event) => onDomainChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        {domainSlot && <div className="pt-[var(--spacing-system-s)]">{domainSlot}</div>}
      </div>

      {/* Terms & Privacy */}
      <CheckboxBlock
        id="create-org-terms"
        label={<TermsAgreementLabel termsUrl={termsUrl} privacyPolicyUrl={privacyPolicyUrl} />}
        truncateLabel
        checked={agreedToTerms}
        disabled={fieldsDisabled}
        error={errors?.terms}
        onCheckedChange={onAgreedToTermsChange}
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
