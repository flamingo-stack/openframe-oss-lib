'use client';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/button';

export interface NoAccountNoticeProps {
  onBackToLogin: () => void;
  title?: string;
  description?: string;
  backLabel?: string;
  className?: string;
}

/**
 * Terminal notice for an identity that authenticated but has no account, on a surface that must not
 * offer to create one. One card centered on the page background; the only way on is back to login.
 */
export function NoAccountNotice({
  onBackToLogin,
  title = 'No account found',
  description = "OpenFrame accounts are created by your organization's administrator. Ask them for an invitation.",
  backLabel = 'Back to Login',
  className,
}: NoAccountNoticeProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen w-full items-center justify-center bg-ods-bg p-[var(--spacing-system-l)]',
        className,
      )}
    >
      <div className="flex w-full max-w-[600px] flex-col gap-[var(--spacing-system-l)] rounded-md border border-ods-border bg-ods-card p-[var(--spacing-system-xl)]">
        <div className="flex flex-col">
          <h1 className="tracking-[-0.64px] text-ods-text-primary text-h2">{title}</h1>
          <p className="text-ods-text-secondary text-h4">{description}</p>
        </div>
        <Button type="button" variant="outline" fullWidth onClick={onBackToLogin}>
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
