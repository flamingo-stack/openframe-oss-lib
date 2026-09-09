'use client';

import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

const TONE_CLASS = {
  /** Consent rows: the accent, as every form's policy links draw it. */
  accent: 'text-ods-accent underline underline-offset-2 hover:text-ods-accent/80',
  /** Quiet copy (the sign-up agreement line): secondary text, plain underline. */
  secondary: 'text-ods-text-secondary underline',
} as const;

/**
 * A link to a policy page inside consent copy (Terms, Privacy) — opens in a
 * new tab and does NOT toggle the checkbox whose label it sits in.
 */
export function PolicyLink({
  href,
  tone = 'accent',
  children,
}: {
  href: string;
  tone?: keyof typeof TONE_CLASS;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(TONE_CLASS[tone])}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </a>
  );
}
