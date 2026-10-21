import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { TextLineSkeleton, UnifiedSkeleton } from '../loading/unified-skeleton';
import { loadingItemProps, useLoadingScope } from './loading-scope';

export interface LeaderRowProps {
  label: ReactNode;
  value: ReactNode;
  /** After the value, at 16px (a check, a warning). */
  status?: ReactNode;
  /** The row's element. Default `div`; `li` inside a list. */
  as?: 'div' | 'li';
  /** The label's tone: `secondary` (default, the quiet label) or `primary` (a label that reads as body copy, as a
   *  billing summary's rows). */
  labelTone?: LeaderRowLabelTone;
  /** The label may shrink to at most half the row and clips with an ellipsis (a long read key, such as a script
   *  parameter's name). Default: the label keeps its whole width and the value clips. Same in both forms. */
  labelShrink?: boolean;
  /** The value's tone: `primary` (default), `secondary` (a value that is not in effect), `warning`, `success` (a check
   *  that passed: "Enabled") or `error` (one that failed: "Disabled"). */
  valueTone?: LeaderRowValueTone;
  /** The value is still being read: the row keeps its structure, the label real (a bar when empty), the value and the
   *  status bars. A loading scope does the same for a row whose value is empty. */
  loading?: boolean;
  className?: string;
  /** Markers for the page's height gate (`data-loading-item` on a row of a read list): forwarded in both forms. */
  [marker: `data-${string}`]: unknown;
}

export type LeaderRowLabelTone = 'secondary' | 'primary';
export type LeaderRowValueTone = 'primary' | 'secondary' | 'warning' | 'success' | 'error';

/** The row's layout, loaded and loading. */
const LEADER_ROW_CLASS = 'flex min-w-0 items-center gap-[var(--spacing-system-xsf)] text-h4';
const LEADER_LABEL_CLASS = 'shrink-0 whitespace-nowrap';
/** A label that may shrink (`labelShrink`): at most half the row, clipped. */
const LEADER_LABEL_SHRINK_CLASS = 'min-w-0 max-w-[50%] truncate whitespace-nowrap';
const LABEL_TONE_CLASS: Record<LeaderRowLabelTone, string> = {
  secondary: 'text-ods-text-secondary',
  primary: 'text-ods-text-primary',
};
const VALUE_TONE_CLASS: Record<LeaderRowValueTone, string> = {
  primary: 'text-ods-text-primary',
  secondary: 'text-ods-text-secondary',
  warning: 'text-ods-warning',
  success: 'text-ods-success',
  error: 'text-ods-error',
};
const LEADER_LINE_CLASS = 'h-px min-w-4 flex-1 bg-ods-border';
const STATUS_BOX_CLASS = 'flex shrink-0 items-center';

/**
 * A label and its value joined by a leader line (Figma `info-card` row): the
 * quiet label, a hairline that takes the free space, the value, and a status
 * mark at the end. One line, always: a long value clips.
 */
/** Whether a slot holds something to draw: a read value that is not here yet is empty. */
const isGiven = (node: ReactNode) => node !== null && node !== undefined && node !== false && node !== '';

export function LeaderRow(props: LeaderRowProps) {
  const {
    label,
    value,
    status,
    as: Row = 'div',
    labelTone = 'secondary',
    labelShrink = false,
    valueTone = 'primary',
    loading = false,
    className,
  } = props;
  const labelClass = labelShrink ? LEADER_LABEL_SHRINK_CLASS : LEADER_LABEL_CLASS;
  // ONE switch: while the host reads the value, or in a loading scope when the value is not here yet (empty), the row
  // draws its read parts as bars in the same boxes; a row the page states in full (config copy, values already known)
  // is drawn as it is.
  const inScope = useLoadingScope();
  const isLoading = loading || (inScope && !isGiven(value));
  return (
    <Row className={cn(LEADER_ROW_CLASS, className)} aria-hidden={isLoading || undefined} {...loadingItemProps(props)}>
      {isLoading && !isGiven(label) ? (
        <TextLineSkeleton as="span" type="inherit" className={cn('inline-block w-24', labelClass)} />
      ) : (
        <span className={cn(labelClass, LABEL_TONE_CLASS[labelTone])}>{label}</span>
      )}
      <span className={LEADER_LINE_CLASS} aria-hidden />
      {isLoading ? (
        <TextLineSkeleton as="span" type="inherit" className="inline-block w-16 shrink-0" />
      ) : (
        <span className={cn('min-w-0 truncate', VALUE_TONE_CLASS[valueTone])}>{value}</span>
      )}
      {status && (
        <span className={STATUS_BOX_CLASS}>{isLoading ? <UnifiedSkeleton className="size-4" /> : status}</span>
      )}
    </Row>
  );
}

/**
 * @deprecated Render `<LeaderRow loading … />` (or the row in a loading scope): the row draws its own loading form from
 * its one structure. This alias renders exactly that: the label real when the page states it (else a bar), the
 * hairline real, a bar for the value, a status box when `status`. Every bar is one line of the ROW's type step, so a
 * row sized with `className="text-h6"` keeps its height.
 */
export function LeaderRowSkeleton({
  status = false,
  label,
  labelTone = 'secondary',
  as,
  className,
}: {
  status?: boolean;
  /** The row's label, when the page states it. */
  label?: ReactNode;
  labelTone?: LeaderRowLabelTone;
  as?: 'div' | 'li';
  className?: string;
}) {
  return (
    <LeaderRow
      loading
      label={label}
      value={null}
      status={status || undefined}
      labelTone={labelTone}
      as={as}
      className={className}
    />
  );
}
