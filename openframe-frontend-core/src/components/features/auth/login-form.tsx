'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useDeferredError } from '../../../hooks/ui/use-deferred-error';
import { cn } from '../../../utils/cn';
import { AlertTriangleIcon } from '../../icons-v2-generated/interface/alert-triangle-icon';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { LabeledDivider } from './labeled-divider';
import type { AuthSsoProvider } from './sso-providers';
import { SsoProviderButtons } from './sso-providers';

export interface LoginFormProps {
  /** Controlled email value */
  email: string;
  onEmailChange: (value: string) => void;
  emailPlaceholder?: string;
  loading?: boolean;
  disabled?: boolean;
  errors?: {
    email?: string;
  };
  /** Informational status under the email field (e.g. live tenant discovery). `errors.email` wins. */
  emailStatus?: { message: string; variant: 'error' | 'warning' | 'success' | 'muted' };
  /**
   * SSO providers, rendered ABOVE the email field with a divider between the two. Always visible;
   * gate clickability with `ssoDisabled` / `ssoEnabledProviders`.
   */
  ssoProviders: AuthSsoProvider[];
  onSsoClick?: (provider: AuthSsoProvider) => void;
  /** Disables every provider button (e.g. until the email passes discovery). */
  ssoDisabled?: boolean;
  /** When set, only these providers are clickable; the rest stay disabled. */
  ssoEnabledProviders?: AuthSsoProvider[];
  /** Verb prefix for provider buttons, e.g. "Continue with". */
  ssoActionLabel?: string;
  /** Label on the divider between the provider buttons and the email field. */
  dividerLabel?: string;
  /**
   * The discovered tenant's own SSO options, rendered UNDER the email field — unlike `ssoProviders`
   * above, these depend on knowing the tenant, so they cannot be offered before an address is
   * typed. Shares `onSsoClick`.
   *
   * Three states, and the empty array is not the same as nothing: `undefined` means discovery has
   * not resolved a tenant yet and the slot stays empty, while `[]` means it resolved and the tenant
   * has none — which is an answer worth showing rather than silence.
   */
  customSsoProviders?: AuthSsoProvider[];
  /** Shown in place of the custom SSO buttons when the resolved tenant has none configured. */
  noCustomSsoLabel?: string;
  /** Primary submit under the email field. Omit the handler to hide the button. */
  onSubmitClick?: () => void;
  submitLabel?: string;
  /** Disables just the primary submit (fields stay editable). */
  submitDisabled?: boolean;
  /** Overrides the default heading. */
  title?: string;
  /** Overrides the default sub-heading. */
  subtitle?: ReactNode;
  className?: string;
}

/**
 * Login form (Login tab). Presentational + controlled — the consumer owns
 * state, validation and discovery. Single-screen design: the provider buttons come first and need
 * nothing typed, then the email field below them. Whether the providers are gated is the
 * consumer's call via `ssoDisabled`; the identity-first flows leave them open, because the server
 * resolves the tenant from the identity the provider asserts.
 */
export function LoginForm({
  email,
  onEmailChange,
  emailPlaceholder = 'username@mail.com',
  loading = false,
  disabled = false,
  errors,
  emailStatus,
  ssoProviders,
  onSsoClick,
  ssoDisabled = false,
  ssoEnabledProviders,
  ssoActionLabel = 'Continue with',
  dividerLabel = 'or continue with OpenFrame SSO',
  customSsoProviders,
  noCustomSsoLabel = 'No additional SSO configurations for this domain',
  onSubmitClick,
  submitLabel = 'Continue',
  submitDisabled = false,
  title = 'Login to OpenFrame',
  subtitle = 'Enter your email to access your organization.',
  className,
}: LoginFormProps) {
  const fieldDisabled = disabled || loading;

  // Validation messages are deferred while the user is typing (shown on blur or after a pause).
  const emailErr = useDeferredError(errors?.email, email);

  // Enter drives the same action as the visible button, under the same gate. A form with no
  // submit (the Login tab, where the providers are the only way on) simply does nothing.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || fieldDisabled || submitDisabled) return;
    onSubmitClick?.();
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

      {/* Providers come FIRST. They need nothing typed, and putting the email above them taught
          people to fill it in before tapping one — the behaviour that made a provider button look
          broken while it waited on a field it never needed. */}
      {ssoProviders.length > 0 && (
        <SsoProviderButtons
          providers={ssoProviders}
          onSsoClick={onSsoClick}
          actionLabel={ssoActionLabel}
          disabled={disabled || loading || ssoDisabled}
          enabledProviders={ssoEnabledProviders}
        />
      )}

      {ssoProviders.length > 0 && <LabeledDivider label={dividerLabel} />}

      {/* Email */}
      <Input
        type="email"
        label="Email"
        placeholder={emailPlaceholder}
        value={email}
        error={emailErr.error ?? emailStatus?.message}
        errorVariant={emailErr.error ? 'error' : emailStatus?.variant}
        disabled={fieldDisabled}
        onBlur={emailErr.onBlur}
        onChange={event => onEmailChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />

      {customSsoProviders &&
        (customSsoProviders.length > 0 ? (
          <SsoProviderButtons
            providers={customSsoProviders}
            onSsoClick={onSsoClick}
            actionLabel={ssoActionLabel}
            disabled={disabled || loading}
          />
        ) : (
          // Same footprint as the button it stands in for, so nothing shifts when a tenant does
          // have options. Tokens are the design's: soft-grey surface, grey text and icon, the
          // bold-body step, a 24px icon, and 12/16 for the inset and the gap.
          <div
            role="status"
            className="flex h-11 w-full items-center gap-[var(--spacing-system-m)] rounded-md bg-ods-bg-surface px-[var(--spacing-system-s)] text-ods-text-secondary text-h3 md:h-12"
          >
            <AlertTriangleIcon className="h-6 w-6 shrink-0" />
            {noCustomSsoLabel}
          </div>
        ))}

      {onSubmitClick && (
        // Full width on a phone, half the row and right-aligned from `md` up, matching the design.
        // The spacer, rather than a width on the button, keeps it flush with the fields' right edge.
        <div className="flex items-center gap-[var(--spacing-system-l)]">
          <div className="hidden flex-1 md:block" />
          <Button
            type="button"
            variant="accent"
            fullWidth
            className="md:flex-1"
            loading={loading}
            disabled={submitDisabled || fieldDisabled}
            onClick={onSubmitClick}
          >
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
