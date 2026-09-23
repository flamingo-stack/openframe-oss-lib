'use client';

import { Button } from '../../ui/button';
import { cn } from '../../../utils/cn';

export interface BackToLoginLinkProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

/** Underlined "Back to Login" text link used across the auth screens. */
export function BackToLoginLink({ onClick, label = 'Back to Login', className }: BackToLoginLinkProps) {
  return (
    <Button
      type="button"
      variant="link"
      onClick={onClick}
      className={cn('text-ods-text-secondary underline text-h4', className)}
    >
      {label}
    </Button>
  );
}
