'use client';

import { PolicyLink } from '../../ui/policy-link';

export interface TermsAgreementLabelProps {
  termsUrl?: string;
  privacyPolicyUrl?: string;
}

/** "Agree to Terms & Privacy Policy by signing up." — shared checkbox label. */
export function TermsAgreementLabel({ termsUrl = '#', privacyPolicyUrl = '#' }: TermsAgreementLabelProps) {
  return (
    <span className="text-ods-text-primary text-h4">
      {'Agree to '}
      <PolicyLink href={termsUrl} tone="secondary">
        Terms
      </PolicyLink>
      {' & '}
      <PolicyLink href={privacyPolicyUrl} tone="secondary">
        Privacy Policy
      </PolicyLink>
      {' by signing up.'}
    </span>
  );
}
