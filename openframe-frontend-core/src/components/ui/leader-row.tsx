import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export interface LeaderRowProps {
  label: ReactNode;
  value: ReactNode;
  /** After the value, at 16px (a check, a warning). */
  status?: ReactNode;
  /** The row's element. Default `div`; `li` inside a list. */
  as?: 'div' | 'li';
  className?: string;
}

/**
 * A label and its value joined by a leader line (Figma `info-card` row): the
 * quiet label, a hairline that takes the free space, the value, and a status
 * mark at the end. One line, always: a long value clips.
 */
export function LeaderRow({ label, value, status, as: Row = 'div', className }: LeaderRowProps) {
  return (
    <Row className={cn('flex min-w-0 items-center gap-[var(--spacing-system-xsf)] text-h4', className)}>
      <span className="shrink-0 whitespace-nowrap text-ods-text-secondary">{label}</span>
      <span className="h-px min-w-4 flex-1 bg-ods-border" aria-hidden />
      <span className="min-w-0 truncate text-ods-text-primary">{value}</span>
      {status && <span className="flex shrink-0 items-center">{status}</span>}
    </Row>
  );
}
