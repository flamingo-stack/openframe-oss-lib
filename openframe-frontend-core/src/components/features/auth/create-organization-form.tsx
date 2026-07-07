'use client'

import * as React from 'react'
import { cn } from '../../../utils/cn'
import { OpenFrameLogo } from '../../icons'
import { GoogleLogoIcon } from '../../icons-v2-generated/brand-logos/google-logo-icon'
import { MicrosoftLogoIcon } from '../../icons-v2-generated/brand-logos/microsoft-logo-icon'
import { Button } from '../../ui/button'
import { CheckboxBlock } from '../../ui/checkbox-block'
import { Input } from '../../ui/input'

/** SSO providers offered on the Create Organization form. */
export type AuthSsoProvider = 'openframe' | 'google' | 'microsoft'

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
  /**
   * SSO providers to offer. When non-empty the form switches to SSO mode:
   * fields and the terms checkbox are disabled and the primary submit is
   * replaced by a stack of provider buttons.
   */
  ssoProviders?: AuthSsoProvider[]
  onSsoClick?: (provider: AuthSsoProvider) => void
  /** Verb prefix for provider buttons, e.g. "Sign Up with". Ignored for "openframe". */
  ssoActionLabel?: string
  className?: string
}

const PROVIDER_META: Record<AuthSsoProvider, { name: string; Icon: React.ComponentType<{ className?: string }> }> = {
  openframe: {
    name: 'OpenFrame SSO',
    Icon: ({ className }) => (
      <OpenFrameLogo
        className={className}
        lowerPathColor="var(--color-accent-primary)"
        upperPathColor="var(--color-text-primary)"
      />
    ),
  },
  google: { name: 'Google', Icon: GoogleLogoIcon },
  microsoft: { name: 'Microsoft', Icon: MicrosoftLogoIcon },
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
  ssoProviders,
  onSsoClick,
  ssoActionLabel = 'Sign Up with',
  className,
}: CreateOrganizationFormProps) {
  const isSsoMode = !!ssoProviders && ssoProviders.length > 0
  const fieldsDisabled = disabled || loading || isSsoMode

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !fieldsDisabled) {
      onSubmit()
    }
  }

  const termsLabel = (
    <span className="text-h4 text-ods-text-primary">
      {'Agree to '}
      <a
        href={termsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ods-text-secondary underline"
        onClick={(event) => event.stopPropagation()}
      >
        Terms
      </a>
      {' & '}
      <a
        href={privacyPolicyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ods-text-secondary underline"
        onClick={(event) => event.stopPropagation()}
      >
        Privacy Policy
      </a>
      {/* "by signing up" is dropped on mobile to keep the label on one line */}
      <span className="hidden md:inline"> by signing up</span>
      {'.'}
    </span>
  )

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

      {/* Email + Organization Name — side by side on every breakpoint */}
      <div className="flex gap-[var(--spacing-system-l)]">
        <div className="min-w-0 flex-1">
          <Input
            type="email"
            label="Email"
            placeholder="username@mail.com"
            value={email}
            error={errors?.email}
            disabled={fieldsDisabled}
            onChange={(event) => onEmailChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Input
            label="Organization Name"
            placeholder="Your Company Name"
            value={organizationName}
            error={errors?.organizationName}
            disabled={fieldsDisabled}
            onChange={(event) => onOrganizationNameChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      {/* Domain */}
      <Input
        label="Domain"
        placeholder={domainPlaceholder}
        value={domain}
        error={errors?.domain}
        disabled={fieldsDisabled}
        endAdornment={domainSuffix ? <span className="whitespace-nowrap">{domainSuffix}</span> : undefined}
        onChange={(event) => onDomainChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Terms & Privacy */}
      <CheckboxBlock
        id="create-org-terms"
        label={termsLabel}
        checked={agreedToTerms}
        disabled={fieldsDisabled}
        error={errors?.terms}
        onCheckedChange={onAgreedToTermsChange}
      />

      {/* Actions */}
      {isSsoMode ? (
        <div className="flex flex-col gap-[var(--spacing-system-s)]">
          {ssoProviders!.map((provider) => {
            const meta = PROVIDER_META[provider]
            const Icon = meta.Icon
            return (
              <Button
                key={provider}
                type="button"
                variant="outline"
                fullWidth
                disabled={disabled || loading}
                leftIcon={<Icon className="h-5 w-5" />}
                onClick={() => onSsoClick?.(provider)}
              >
                {provider === 'openframe' ? meta.name : `${ssoActionLabel} ${meta.name}`}
              </Button>
            )
          })}
        </div>
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
