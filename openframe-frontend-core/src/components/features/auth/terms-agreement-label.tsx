'use client'

export interface TermsAgreementLabelProps {
  termsUrl?: string
  privacyPolicyUrl?: string
}

/** "Agree to Terms & Privacy Policy by signing up." — shared checkbox label. */
export function TermsAgreementLabel({ termsUrl = '#', privacyPolicyUrl = '#' }: TermsAgreementLabelProps) {
  return (
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
}
