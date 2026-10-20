import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { useLoadingScope } from './loading-scope';

export interface LeaderRowProps {
  label: ReactNode;
  value: ReactNode;
  /** After the value, at 16px (a check, a warning). */
  status?: ReactNode;
  /** The row's element. Default `div`; `li` inside a list. */
  as?: 'div' | 'li';
  className?: string;
}

/** The row's layout, read by the row and by its skeleton, so the skeleton is the row's size. */
const LEADER_ROW_CLASS = 'flex min-w-0 items-center gap-[var(--spacing-system-xsf)] text-h4';
const LEADER_LABEL_CLASS = 'shrink-0 whitespace-nowrap text-ods-text-secondary';
const LEADER_LINE_CLASS = 'h-px min-w-4 flex-1 bg-ods-border';
const STATUS_BOX_CLASS = 'flex shrink-0 items-center';

/**
 * A label and its value joined by a leader line (Figma `info-card` row): the
 * quiet label, a hairline that takes the free space, the value, and a status
 * mark at the end. One line, always: a long value clips.
 */
/** Whether a slot holds something to draw: a read value that is not here yet is empty. */
const isGiven = (node: ReactNode) => node !== null && node !== undefined && node !== false && node !== '';

export function LeaderRow({ label, value, status, as: Row = 'div', className }: LeaderRowProps) {
  // In a loading scope a row whose value is not here yet (empty) is its skeleton; a row the page states in full
  // (config copy, values already known) is drawn as it is.
  if (useLoadingScope() && !isGiven(value)) {
    return (
      <LeaderRowSkeleton status={!!status} label={isGiven(label) ? label : undefined} as={Row} className={className} />
    );
  }
  return (
    <Row className={cn(LEADER_ROW_CLASS, className)}>
      <span className={LEADER_LABEL_CLASS}>{label}</span>
      <span className={LEADER_LINE_CLASS} aria-hidden />
      <span className="min-w-0 truncate text-ods-text-primary">{value}</span>
      {status && <span className={STATUS_BOX_CLASS}>{status}</span>}
    </Row>
  );
}

/**
 * A row while it is read: the label (drawn as it is when the page states it, else a bar), the hairline drawn for
 * real, a bar for the value, a status box. Every bar is one line of the ROW's type step, so a row sized with
 * `className="text-h6"` keeps its height.
 */
export function LeaderRowSkeleton({
  status = false,
  label,
  as: Row = 'div',
  className,
}: {
  status?: boolean;
  /** The row's label, when the page states it. */
  label?: ReactNode;
  as?: 'div' | 'li';
  className?: string;
}) {
  return (
    <Row className={cn(LEADER_ROW_CLASS, className)} aria-hidden>
      {label !== undefined ? (
        <span className={LEADER_LABEL_CLASS}>{label}</span>
      ) : (
        <TextLineSkeleton as="span" type="inherit" className="inline-block w-24 shrink-0" />
      )}
      <span className={LEADER_LINE_CLASS} />
      <TextLineSkeleton as="span" type="inherit" className="inline-block w-16 shrink-0" />
      {status && (
        <span className={STATUS_BOX_CLASS}>
          <UnifiedSkeleton className="size-4" />
        </span>
      )}
    </Row>
  );
}
