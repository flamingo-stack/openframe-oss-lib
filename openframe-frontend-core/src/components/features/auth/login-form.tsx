'use client';

import type { KeyboardEvent, ReactNode } from 'react';
import { useDeferredError } from '../../../hooks/ui/use-deferred-error';
import { cn } from '../../../utils/cn';
import { AlertTriangleIcon } from '../../icons-v2-generated/interface/alert-triangle-icon';
import { accentSentenceMarks } from '../../layout/page-heading';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { LabeledDivider } from './labeled-divider';
import { LegalLinks } from './legal-links';
import type { AuthSsoProvider } from './sso-providers';
import { SsoProviderButtons } from './sso-providers';

/** The sign-in methods of the organization an email resolved to. */
export interface LoginFormTenantMethods {
  /** Names the block ("Sign-in methods for <name>") and tags the organization's own providers. */
  name?: string;
  /**
   * What the organization offers itself. `openframe` is its built-in login and always comes first;
   * every other entry is an identity provider it configured with its own credentials, tagged with
   * `name` so it cannot be mistaken for the generic button of the same provider.
   */
  providers: AuthSsoProvider[];
}

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
   * A message too long for the field's one-line status, shown in a notice row under the field.
   */
  notice?: string;
  /**
   * The generic providers, under the email field behind `dividerLabel`. They need nothing typed: the
   * server resolves the organization from the identity the provider asserts. With `tenantMethods`
   * they follow the organization's own methods; pass `[]` to offer only those.
   */
  ssoProviders: AuthSsoProvider[];
  onSsoClick?: (provider: AuthSsoProvider) => void;
  /** Disables every provider button (e.g. while the typed email is being looked up). */
  ssoDisabled?: boolean;
  /** When set, only these generic providers are clickable; the rest stay disabled. */
  ssoEnabledProviders?: AuthSsoProvider[];
  /** Verb prefix for provider buttons, e.g. "Continue with". */
  ssoActionLabel?: string;
  /** Label on the divider above the generic providers. */
  dividerLabel?: string;
  /**
   * The organization the typed email resolved to. Its methods take the place of the generic block
   * under the field, headed by its name, so the switch from "any account" to "this organization's
   * sign-in" is visible rather than a silent change of what the same buttons do.
   */
  tenantMethods?: LoginFormTenantMethods;
  /** Primary submit under the email field. Omit the handler to hide the button. */
  onSubmitClick?: () => void;
  submitLabel?: string;
  /** Disables just the primary submit (fields stay editable). */
  submitDisabled?: boolean;
  /**
   * Enter in the email field when there is no submit button, e.g. to look the address up now
   * instead of after a typing pause. With `onSubmitClick` set, Enter drives that instead.
   */
  onEmailEnter?: () => void;
  /** Overrides the default heading. */
  title?: string;
  /** Overrides the default sub-heading. */
  subtitle?: ReactNode;
  /**
   * Public legal pages, linked in a quiet "Terms of Service • Privacy Policy" row at the foot of
   * the card. Both are needed for the row to render: this screen has no consent checkbox to carry
   * the links, so the row is the only place they appear.
   */
  termsUrl?: string;
  privacyPolicyUrl?: string;
  className?: string;
}

/**
 * Login form (Login tab). Presentational + controlled — the consumer owns state, validation and
 * discovery. Email first, sign-in methods under it: everything that changes once the email is known
 * sits below the field, and the block changes as a whole. Before that the generic providers are
 * there and need nothing typed; whether they are gated is the consumer's call via `ssoDisabled`.
 */
export function LoginForm({
  email,
  onEmailChange,
  emailPlaceholder = 'username@mail.com',
  loading = false,
  disabled = false,
  errors,
  emailStatus,
  notice,
  ssoProviders,
  onSsoClick,
  ssoDisabled = false,
  ssoEnabledProviders,
  ssoActionLabel = 'Continue with',
  dividerLabel = 'or continue with',
  tenantMethods,
  onSubmitClick,
  submitLabel = 'Continue',
  submitDisabled = false,
  onEmailEnter,
  title = 'Login to OpenFrame',
  subtitle = 'Enter your email to access your organization.',
  termsUrl,
  privacyPolicyUrl,
  className,
}: LoginFormProps) {
  const fieldDisabled = disabled || loading;
  const providersDisabled = disabled || loading || ssoDisabled;

  // Validation messages are deferred while the user is typing (shown on blur or after a pause).
  const emailErr = useDeferredError(errors?.email, email);

  // Enter drives the same action as the visible button, under the same gate.
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || fieldDisabled) return;
    if (onSubmitClick) {
      if (!submitDisabled) onSubmitClick();
      return;
    }
    onEmailEnter?.();
  };

  // The built-in login is not configured with anyone's credentials, so it carries no tag.
  const tenantOpenframe = tenantMethods?.providers.filter(provider => provider === 'openframe') ?? [];
  const tenantOwn = tenantMethods?.providers.filter(provider => provider !== 'openframe') ?? [];
  const hasTenantButtons = tenantOpenframe.length + tenantOwn.length > 0;

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]',
        className,
      )}
    >
      {/* Header */}
      <div className="flex flex-col">
        <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">{accentSentenceMarks(title)}</h1>
        <p className="text-ods-text-secondary text-h4">{subtitle}</p>
      </div>

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

      {notice && (
        // Tokens are the design's: soft-grey surface, grey text and icon, the bold-body step, a 24px
        // icon, and 12/16 for the inset and the gap.
        <div
          role="status"
          // A minimum, not a fixed height: the notice can run to several lines at phone width.
          className="flex min-h-11 w-full items-center gap-[var(--spacing-system-m)] rounded-md bg-ods-bg-surface px-[var(--spacing-system-s)] py-[var(--spacing-system-s)] text-ods-text-secondary text-h3 md:min-h-12"
        >
          <AlertTriangleIcon className="h-6 w-6 shrink-0" />
          {notice}
        </div>
      )}

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

      {tenantMethods && (
        <>
          <LabeledDivider label={`Sign-in methods for ${tenantMethods.name || 'your organization'}`} />
          {tenantOpenframe.length > 0 && (
            <SsoProviderButtons
              providers={tenantOpenframe}
              onSsoClick={onSsoClick}
              actionLabel={ssoActionLabel}
              disabled={providersDisabled}
            />
          )}
          {tenantOwn.length > 0 && (
            <SsoProviderButtons
              providers={tenantOwn}
              onSsoClick={onSsoClick}
              actionLabel={ssoActionLabel}
              disabled={providersDisabled}
              tag={tenantMethods.name}
            />
          )}
        </>
      )}

      {ssoProviders.length > 0 && (
        <>
          {/* Under an organization heading with nothing above it, a second divider would only
              separate the heading from its own buttons. */}
          {(!tenantMethods || hasTenantButtons) && <LabeledDivider label={dividerLabel} />}
          <SsoProviderButtons
            providers={ssoProviders}
            onSsoClick={onSsoClick}
            actionLabel={ssoActionLabel}
            disabled={providersDisabled}
            enabledProviders={ssoEnabledProviders}
          />
        </>
      )}

      {termsUrl && privacyPolicyUrl && <LegalLinks termsUrl={termsUrl} privacyPolicyUrl={privacyPolicyUrl} />}
    </div>
  );
}
