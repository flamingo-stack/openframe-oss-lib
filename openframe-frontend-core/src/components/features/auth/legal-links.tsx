'use client';

import { PolicyLink } from '../../ui/policy-link';

export interface LegalLinksProps {
  termsUrl: string;
  privacyPolicyUrl: string;
}

/**
 * "Terms of Service • Privacy Policy" — the quiet legal row at the foot of an auth card, for the
 * screens that have no consent checkbox to carry the links (Login, the email step of Sign Up).
 */
export function LegalLinks({ termsUrl, privacyPolicyUrl }: LegalLinksProps) {
  return (
    <div className="flex justify-center gap-[var(--spacing-system-xs)] text-ods-text-secondary text-h6">
      <PolicyLink href={termsUrl} tone="secondary">
        Terms of Service
      </PolicyLink>
      <span aria-hidden="true">•</span>
      <PolicyLink href={privacyPolicyUrl} tone="secondary">
        Privacy Policy
      </PolicyLink>
    </div>
  );
}
