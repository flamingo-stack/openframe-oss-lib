'use client';

import { cn } from '../../../utils/cn';

export interface BackToLoginLinkProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

/** Underlined "Back to Login" text link used across the auth screens. */
export function BackToLoginLink({ onClick, label = 'Back to Login', className }: BackToLoginLinkProps) {
  return (
    <button type="button" onClick={onClick} className={cn('text-ods-text-secondary underline text-h4', className)}>
      {label}
    </button>
  );
}
