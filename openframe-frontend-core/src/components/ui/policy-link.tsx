import type { ReactNode } from 'react';

/**
 * A link to a policy page inside consent copy (Terms, Privacy) — opens in a
 * new tab and does NOT toggle the checkbox whose label it sits in.
 */
export function PolicyLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      className="text-ods-accent underline"
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
    >
      {children}
    </a>
  );
}
