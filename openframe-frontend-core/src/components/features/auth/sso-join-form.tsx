'use client';

import type { ReactNode } from 'react';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/button';
import { CheckboxBlock } from '../../ui/checkbox-block';
import { SquareAvatar } from '../../ui/square-avatar';
import { Tag } from '../../ui/tag';
import { TermsAgreementLabel } from './terms-agreement-label';

export interface SsoJoinFormProps {
  /** Display name of the identity the provider asserted, e.g. "Roman Smith". Falls back to `email`. */
  name?: string;
  /** The asserted address. Stands in for the name when the provider gave none. */
  email?: string;
  /** Provider picture, when there is one; the initials of the name otherwise. */
  avatarUrl?: string;
  /** The organization being joined. */
  organizationName: string;
  /** Role names as the server reports them (`ADMIN`), one tag each. Nothing is drawn for a plain member. */
  roles?: string[];
  agreedToTerms: boolean;
  onAgreedToTermsChange: (checked: boolean) => void;
  /** Primary action ("Create Account"). Only reachable once the terms are agreed. */
  onSubmit: () => void;
  /** Leaves without creating anything ("Back to Login"). */
  onBack: () => void;
  title?: string;
  subtitle?: ReactNode;
  submitLabel?: string;
  backLabel?: string;
  termsUrl?: string;
  privacyPolicyUrl?: string;
  /** Held while the submit navigates away: everything locks and the submit spins. */
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * "One Last Step" - the consent gate an SSO flow shows before it creates a user (accepting an
 * invitation, or a first login through a shared domain). Presentational + controlled: the consumer
 * loads the pending identity, owns the checkbox state and performs the submit navigation.
 *
 * The identity row is read-only on purpose. The server reads the identity from its own session
 * and would ignore anything edited here; the row exists so the person can see WHICH account and
 * WHICH organization they are about to be joined with - and walk away if it is the wrong one.
 */
export function SsoJoinForm({
  name,
  email,
  avatarUrl,
  organizationName,
  roles = [],
  agreedToTerms,
  onAgreedToTermsChange,
  onSubmit,
  onBack,
  title = 'One Last Step',
  subtitle = "Confirm the account you're joining with.",
  submitLabel = 'Create Account',
  backLabel = 'Back to Login',
  termsUrl,
  privacyPolicyUrl,
  loading = false,
  disabled = false,
  className,
}: SsoJoinFormProps) {
  const fieldsDisabled = disabled || loading;
  const displayName = name?.trim() || email?.trim() || '';

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

      {/* Identity row: who is joining, where, as what. Page-background surface inside the card, per design. */}
      <div className="flex items-center gap-[var(--spacing-system-s)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-m)]">
        <SquareAvatar
          size="lg"
          variant="round"
          src={avatarUrl}
          alt={displayName}
          fallback={displayName}
          initialsClassName="text-ods-text-secondary text-h6"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-ods-text-primary text-h4">{displayName}</span>
          <span className="truncate text-ods-text-secondary text-h6">{organizationName}</span>
        </div>
        {roles.length > 0 && (
          <div className="flex shrink-0 items-center gap-[var(--spacing-system-xs)]">
            {roles.map(role => (
              <Tag key={role} variant="grey" label={role} />
            ))}
          </div>
        )}
      </div>

      <CheckboxBlock
        id="sso-join-terms"
        label={<TermsAgreementLabel termsUrl={termsUrl} privacyPolicyUrl={privacyPolicyUrl} />}
        checked={agreedToTerms}
        disabled={fieldsDisabled}
        onCheckedChange={onAgreedToTermsChange}
      />

      {/* Actions - back + submit, half the row each, on every breakpoint */}
      <div className="flex items-center gap-[var(--spacing-system-l)]">
        <Button type="button" variant="outline" fullWidth className="flex-1" disabled={fieldsDisabled} onClick={onBack}>
          {backLabel}
        </Button>
        <Button
          type="button"
          variant="accent"
          fullWidth
          className="flex-1"
          loading={loading}
          disabled={fieldsDisabled || !agreedToTerms}
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
