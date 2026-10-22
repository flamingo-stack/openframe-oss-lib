'use client';

import { Button } from '../../ui/button';

export interface BackToLoginLinkProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

/** Underlined "Back to Login" text link used across the auth screens. */
export function BackToLoginLink({ onClick, label = 'Back to Login', className }: BackToLoginLinkProps) {
  return (
    <Button variant="link" size="compact" noPaddingX type="button" onClick={onClick} className={className}>
      {label}
    </Button>
  );
}
