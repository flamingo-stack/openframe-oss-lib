'use client';

import { Alert } from '../../ui/alert';
import { Button } from '../../ui/button';

/**
 * A reload that failed while an earlier answer for the same list is still on screen (after a block, or when the host
 * stopped answering): the list stays, and this says it may be out of date, with a retry. A list that never loaded
 * shows `LoadError` in its place instead.
 */
export function ReloadFailedNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Alert variant="error" className="flex flex-wrap items-center justify-between gap-[var(--spacing-system-sf)]">
      <span className="text-h5">{message} What is shown may be out of date.</span>
      <Button variant="outline" size="small" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}
